import os
from contextlib import asynccontextmanager
from datetime import date
from pathlib import Path
from typing import List

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from database import Base, engine, get_db
from models import Settings, Transaction, Wallet
from schemas import (
    SettingsResponse,
    SettingsUpdate,
    TransactionCreate,
    TransactionResponse,
    WalletResponse,
    WalletUpdate,
)


def seed_defaults(db: Session) -> None:
    if not db.query(Wallet).first():
        db.add(Wallet(btc=0.15846154, eth=0.0, usdt=0.0))
        db.commit()
    if not db.query(Transaction).first():
        for tx in [
            Transaction(asset="btc", type="Deposit", change=0.00307692, date="06/28/2026"),
            Transaction(asset="btc", type="Deposit", change=0.07692308, date="07/02/2026"),
            Transaction(asset="btc", type="Deposit", change=0.07846154, date="07/08/2026"),
        ]:
            db.add(tx)
        db.commit()
    if not db.query(Settings).first():
        db.add(
            Settings(
                gas_fee_usd=853.0,
                gas_fee_btc=0.01312308,
                btc_price=65000.0,
                eth_price=3500.0,
                usdt_price=1.0,
            )
        )
        db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = next(get_db())
    try:
        seed_defaults(db)
    finally:
        db.close()
    yield


app = FastAPI(title="Crypto Wallet API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # must be False when allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health ────────────────────────────────────────────────────────────────────


@app.get("/healthz")
def health():
    return {"status": "ok"}


# ── Wallet ────────────────────────────────────────────────────────────────────


@app.get("/api/wallet", response_model=WalletResponse)
def get_wallet(db: Session = Depends(get_db)):
    wallet = db.query(Wallet).first()
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")
    return wallet


@app.put("/api/wallet", response_model=WalletResponse)
def update_wallet(data: WalletUpdate, db: Session = Depends(get_db)):
    wallet = db.query(Wallet).first()
    if not wallet:
        wallet = Wallet()
        db.add(wallet)

    today = date.today().strftime("%m/%d/%Y")
    for asset_name, old_val, new_val in [
        ("btc", wallet.btc, data.btc),
        ("eth", wallet.eth, data.eth),
        ("usdt", wallet.usdt, data.usdt),
    ]:
        diff = new_val - old_val
        if abs(diff) > 1e-10:
            db.add(
                Transaction(
                    asset=asset_name,
                    type="Admin Deposit" if diff > 0 else "Admin Charge",
                    change=abs(diff),
                    date=today,
                )
            )

    wallet.btc = data.btc
    wallet.eth = data.eth
    wallet.usdt = data.usdt
    db.commit()
    db.refresh(wallet)
    return wallet


# ── Transactions ──────────────────────────────────────────────────────────────


@app.get("/api/transactions", response_model=List[TransactionResponse])
def get_transactions(db: Session = Depends(get_db)):
    return db.query(Transaction).order_by(Transaction.id).all()


@app.post("/api/transactions", response_model=WalletResponse)
def send_withdraw(data: TransactionCreate, db: Session = Depends(get_db)):
    wallet = db.query(Wallet).first()
    settings = db.query(Settings).first()

    if not wallet or not settings:
        raise HTTPException(status_code=404, detail="Wallet or settings not found")

    asset = data.asset.lower()
    if asset not in ("btc", "eth", "usdt"):
        raise HTTPException(status_code=400, detail="Invalid asset")

    current = getattr(wallet, asset)
    if data.amount > current:
        raise HTTPException(
            status_code=400, detail=f"Insufficient {asset.upper()} balance"
        )

    btc_after_send = wallet.btc - data.amount if asset == "btc" else wallet.btc
    if btc_after_send < settings.gas_fee_btc:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient BTC to cover network fee (${settings.gas_fee_usd:.2f})",
        )

    setattr(wallet, asset, current - data.amount)
    wallet.btc -= settings.gas_fee_btc

    today = date.today().strftime("%m/%d/%Y")
    db.add(Transaction(asset=asset, type="Withdrawal", change=data.amount, date=today))
    db.add(
        Transaction(
            asset="btc", type="Gas Fee", change=settings.gas_fee_btc, date=today
        )
    )

    db.commit()
    db.refresh(wallet)
    return wallet


# ── Settings ──────────────────────────────────────────────────────────────────


@app.get("/api/settings", response_model=SettingsResponse)
def get_settings(db: Session = Depends(get_db)):
    s = db.query(Settings).first()
    if not s:
        raise HTTPException(status_code=404, detail="Settings not found")
    return s


@app.put("/api/settings", response_model=SettingsResponse)
def update_settings(data: SettingsUpdate, db: Session = Depends(get_db)):
    s = db.query(Settings).first()
    if not s:
        s = Settings()
        db.add(s)

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(s, field, value)

    db.commit()
    db.refresh(s)
    return s


# ── Static / SPA fallback ─────────────────────────────────────────────────────
# Present when running from the Docker image (./static is copied in by the
# multi-stage build).  Skipped in local dev (no ./static dir).
_static_dir = Path(__file__).parent / "static"

if _static_dir.is_dir():
    # Serve Vite's hashed JS/CSS chunks
    _assets_dir = _static_dir / "assets"
    if _assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(_assets_dir)), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        """Serve the file if it exists; otherwise return index.html for SPA routing."""
        target = _static_dir / full_path
        if target.is_file():
            return FileResponse(str(target))
        return FileResponse(str(_static_dir / "index.html"))


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
