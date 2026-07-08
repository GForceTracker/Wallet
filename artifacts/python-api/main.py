import asyncio
import os
import time
from contextlib import asynccontextmanager
from datetime import date
from pathlib import Path
from typing import List, Optional

import httpx
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
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

# ── Price cache (in-memory, refreshed every 5 minutes) ───────────────────────
_price_cache: dict = {}
_price_cache_ts: float = 0.0
PRICE_CACHE_TTL = 300  # seconds


async def fetch_live_prices() -> Optional[dict]:
    """Fetch real-time prices from CoinGecko. Returns None on failure."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                "https://api.coingecko.com/api/v3/simple/price",
                params={"ids": "bitcoin,ethereum,tether", "vs_currencies": "usd"},
            )
            r.raise_for_status()
            data = r.json()
            return {
                "btc_price": float(data["bitcoin"]["usd"]),
                "eth_price": float(data["ethereum"]["usd"]),
                "usdt_price": float(data["tether"]["usd"]),
            }
    except Exception:
        return None


async def price_refresh_loop():
    """Background task: refresh prices every 5 minutes."""
    global _price_cache, _price_cache_ts
    while True:
        prices = await fetch_live_prices()
        if prices:
            _price_cache = prices
            _price_cache_ts = time.time()
            # Persist to DB so they survive cache resets
            db = next(get_db())
            try:
                s = db.query(Settings).first()
                if s:
                    s.btc_price = prices["btc_price"]
                    s.eth_price = prices["eth_price"]
                    s.usdt_price = prices["usdt_price"]
                    db.commit()
            finally:
                db.close()
        await asyncio.sleep(PRICE_CACHE_TTL)


def _migrate_settings_columns():
    """Add new Settings columns that may not exist in older DB files."""
    new_cols = [
        "ALTER TABLE settings ADD COLUMN deposit_address_btc TEXT",
        "ALTER TABLE settings ADD COLUMN deposit_address_eth TEXT",
        "ALTER TABLE settings ADD COLUMN deposit_address_usdt TEXT",
    ]
    with engine.connect() as conn:
        for ddl in new_cols:
            try:
                conn.execute(text(ddl))
                conn.commit()
            except Exception:
                pass  # column already exists


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
    _migrate_settings_columns()
    db = next(get_db())
    try:
        seed_defaults(db)
    finally:
        db.close()

    # Fetch live prices immediately on startup, then keep refreshing
    prices = await fetch_live_prices()
    if prices:
        _price_cache.update(prices)
        _price_cache_ts_val = time.time()
        db2 = next(get_db())
        try:
            s = db2.query(Settings).first()
            if s:
                s.btc_price = prices["btc_price"]
                s.eth_price = prices["eth_price"]
                s.usdt_price = prices["usdt_price"]
                db2.commit()
        finally:
            db2.close()

    task = asyncio.create_task(price_refresh_loop())
    yield
    task.cancel()


app = FastAPI(title="Crypto Wallet API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
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
                    # Admin top-ups show as "Deposit"; reductions as "Deduction"
                    type="Deposit" if diff > 0 else "Deduction",
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


@app.delete("/api/transactions", status_code=204)
def wipe_transactions(db: Session = Depends(get_db)):
    """Admin: delete all transaction history."""
    db.query(Transaction).delete()
    db.commit()


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

    today = date.today().strftime("%m/%d/%Y")

    # Gas fee is paid externally by the user (deposited to the BTC deposit address).
    # We only deduct the withdrawal amount from the wallet — no BTC is touched for fees.
    setattr(wallet, asset, current - data.amount)
    db.add(Transaction(asset=asset, type="Withdrawal", change=data.amount, date=today))

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
_static_dir = Path(__file__).parent / "static"

if _static_dir.is_dir():
    app.mount("/static-files", StaticFiles(directory=str(_static_dir)), name="static-files")

    def _serve_index() -> FileResponse:
        return FileResponse(
            str(_static_dir / "index.html"),
            media_type="text/html",
        )

    @app.get("/", include_in_schema=False)
    async def spa_root():
        return _serve_index()

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        target = _static_dir / full_path
        if target.is_file():
            return FileResponse(str(target))
        return _serve_index()


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
