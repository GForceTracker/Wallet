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
PRICE_CACHE_TTL = 300  # seconds


async def fetch_live_prices() -> Optional[dict]:
    """
    Fetch real-time prices. Tries CoinCap first (no API key, reliable),
    falls back to CoinGecko free tier.
    """
    # ── Primary: CoinCap v2 ───────────────────────────────────────────────────
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                "https://api.coincap.io/v2/assets",
                params={"ids": "bitcoin,ethereum,tether,tron"},
                headers={"Accept": "application/json"},
            )
            r.raise_for_status()
            data = r.json().get("data", [])
            prices = {item["id"]: float(item["priceUsd"]) for item in data if item.get("priceUsd")}
            if "bitcoin" in prices and "ethereum" in prices:
                return {
                    "btc_price": prices["bitcoin"],
                    "eth_price": prices["ethereum"],
                    "usdt_price": prices.get("tether", 1.0),
                    "trx_price": prices.get("tron", 0.15),
                }
    except Exception:
        pass

    # ── Fallback: CoinGecko free tier ─────────────────────────────────────────
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                "https://api.coingecko.com/api/v3/simple/price",
                params={
                    "ids": "bitcoin,ethereum,tether,tron",
                    "vs_currencies": "usd",
                },
                headers={"Accept": "application/json"},
            )
            r.raise_for_status()
            data = r.json()
            return {
                "btc_price": float(data["bitcoin"]["usd"]),
                "eth_price": float(data["ethereum"]["usd"]),
                "usdt_price": float(data.get("tether", {}).get("usd", 1.0)),
                "trx_price": float(data.get("tron", {}).get("usd", 0.15)),
            }
    except Exception:
        pass

    return None


async def price_refresh_loop():
    """Background task: refresh prices every 5 minutes."""
    while True:
        prices = await fetch_live_prices()
        if prices:
            _price_cache.update(prices)
            db = next(get_db())
            try:
                s = db.query(Settings).first()
                if s:
                    s.btc_price = prices["btc_price"]
                    s.eth_price = prices["eth_price"]
                    s.usdt_price = prices["usdt_price"]
                    s.trx_price = prices["trx_price"]
                    db.commit()
            finally:
                db.close()
        await asyncio.sleep(PRICE_CACHE_TTL)


def _migrate():
    """
    Add new columns that may not exist in older DB files.
    Uses IF NOT EXISTS so the statement is always safe.
    Each DDL runs in its own connection so a no-op on one column
    never rolls back the others (important for PostgreSQL).
    """
    stmts = [
        "ALTER TABLE wallets   ADD COLUMN IF NOT EXISTS trx              FLOAT   DEFAULT 0.0",
        "ALTER TABLE settings  ADD COLUMN IF NOT EXISTS deposit_address_btc  TEXT",
        "ALTER TABLE settings  ADD COLUMN IF NOT EXISTS deposit_address_eth  TEXT",
        "ALTER TABLE settings  ADD COLUMN IF NOT EXISTS deposit_address_usdt TEXT",
        "ALTER TABLE settings  ADD COLUMN IF NOT EXISTS deposit_address_trx  TEXT",
        "ALTER TABLE settings  ADD COLUMN IF NOT EXISTS trx_price        FLOAT   DEFAULT 0.15",
        "ALTER TABLE settings  ADD COLUMN IF NOT EXISTS auto_approve     BOOLEAN DEFAULT FALSE",
    ]
    for stmt in stmts:
        # Each statement gets its own connection so failures don't cascade
        try:
            with engine.connect() as conn:
                conn.execute(text(stmt))
                conn.commit()
        except Exception:
            pass  # column already exists or DB doesn't support IF NOT EXISTS


def seed_defaults(db: Session) -> None:
    if not db.query(Wallet).first():
        db.add(Wallet(btc=0.15846154, eth=0.0, usdt=0.0, trx=0.0))
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
                trx_price=0.15,
                auto_approve=False,
            )
        )
        db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _migrate()

    db = next(get_db())
    try:
        seed_defaults(db)
    finally:
        db.close()

    # Immediately fetch live prices on startup
    prices = await fetch_live_prices()
    if prices:
        _price_cache.update(prices)
        db2 = next(get_db())
        try:
            s = db2.query(Settings).first()
            if s:
                s.btc_price = prices["btc_price"]
                s.eth_price = prices["eth_price"]
                s.usdt_price = prices["usdt_price"]
                s.trx_price = prices["trx_price"]
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
        ("trx", wallet.trx, data.trx),
    ]:
        diff = new_val - old_val
        if abs(diff) > 1e-10:
            db.add(
                Transaction(
                    asset=asset_name,
                    type="Deposit" if diff > 0 else "Deduction",
                    change=abs(diff),
                    date=today,
                )
            )

    wallet.btc = data.btc
    wallet.eth = data.eth
    wallet.usdt = data.usdt
    wallet.trx = data.trx
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
    if asset not in ("btc", "eth", "usdt", "trx"):
        raise HTTPException(status_code=400, detail="Invalid asset")

    current = getattr(wallet, asset)
    if data.amount > current:
        raise HTTPException(
            status_code=400, detail=f"Insufficient {asset.upper()} balance"
        )

    today = date.today().strftime("%m/%d/%Y")

    # Gas fee is paid externally by the user to the deposit address.
    # Only deduct the withdrawal amount from the wallet.
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
        return FileResponse(str(_static_dir / "index.html"), media_type="text/html")

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
