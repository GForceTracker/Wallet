import asyncio
import hashlib
import os
import secrets
import time
from contextlib import asynccontextmanager
from datetime import date, datetime
from pathlib import Path
from typing import List, Optional

import httpx
from fastapi import Depends, FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.orm import Session

from database import Base, engine, get_db
from models import Notification, Settings, Transaction, User, Wallet
from schemas import (
    AuthResponse,
    LoginRequest,
    NotificationResponse,
    SettingsResponse,
    SettingsUpdate,
    SignupRequest,
    TransactionCreate,
    TransactionResponse,
    UserWithWallet,
    WalletResponse,
    WalletUpdate,
)

# ── Auth helpers ──────────────────────────────────────────────────────────────

ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "Admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "Admin123")
USER_USERNAME = os.getenv("USER_USERNAME", "Miachen")
USER_PASSWORD = os.getenv("USER_PASSWORD", "GJE8AT2021$")


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 200_000)
    return f"{salt}:{key.hex()}"


def verify_password(password: str, hashed: str) -> bool:
    try:
        salt, key_hex = hashed.split(":", 1)
        new_key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 200_000)
        return secrets.compare_digest(new_key.hex(), key_hex)
    except Exception:
        return False


# ── User helpers ──────────────────────────────────────────────────────────────

def get_or_create_wallet(user: User, db: Session) -> Wallet:
    wallet = db.query(Wallet).filter(Wallet.user_id == user.id).first()
    if not wallet:
        wallet = Wallet(user_id=user.id)
        db.add(wallet)
        db.commit()
        db.refresh(wallet)
    return wallet


def require_user(x_username: Optional[str] = Header(default=None), db: Session = Depends(get_db)) -> User:
    if not x_username:
        raise HTTPException(status_code=401, detail="Authentication required")
    user = db.query(User).filter(User.username == x_username).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ── Price cache ───────────────────────────────────────────────────────────────

_price_cache: dict = {}
PRICE_CACHE_TTL = 60

SELF_URL = os.getenv("SELF_URL", "")
KEEP_ALIVE_INTERVAL = 600


async def fetch_live_prices() -> Optional[dict]:
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

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                "https://api.coingecko.com/api/v3/simple/price",
                params={"ids": "bitcoin,ethereum,tether,tron", "vs_currencies": "usd"},
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


async def keep_alive_loop():
    if not SELF_URL:
        return
    await asyncio.sleep(60)
    while True:
        try:
            async with httpx.AsyncClient() as client:
                await client.get(f"{SELF_URL.rstrip('/')}/healthz", timeout=30)
        except Exception:
            pass
        await asyncio.sleep(KEEP_ALIVE_INTERVAL)


async def price_refresh_loop():
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


# ── Migration ─────────────────────────────────────────────────────────────────

def _migrate():
    stmts = [
        # Wallet / Transaction columns
        "ALTER TABLE wallets   ADD COLUMN IF NOT EXISTS user_id                      INTEGER",
        "ALTER TABLE wallets   ADD COLUMN IF NOT EXISTS trx                          FLOAT   DEFAULT 0.0",
        "ALTER TABLE wallets   ADD COLUMN IF NOT EXISTS usdt_trc20                   FLOAT   DEFAULT 0.0",
        "ALTER TABLE wallets   ADD COLUMN IF NOT EXISTS usdt_bep20                   FLOAT   DEFAULT 0.0",
        "ALTER TABLE wallets   ADD COLUMN IF NOT EXISTS usdt_erc20                   FLOAT   DEFAULT 0.0",
        "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id                   INTEGER",
        # Settings columns
        "ALTER TABLE settings  ADD COLUMN IF NOT EXISTS deposit_address_btc          TEXT",
        "ALTER TABLE settings  ADD COLUMN IF NOT EXISTS deposit_address_eth          TEXT",
        "ALTER TABLE settings  ADD COLUMN IF NOT EXISTS deposit_address_usdt         TEXT",
        "ALTER TABLE settings  ADD COLUMN IF NOT EXISTS deposit_address_usdt_trc20   TEXT",
        "ALTER TABLE settings  ADD COLUMN IF NOT EXISTS deposit_address_usdt_bep20   TEXT",
        "ALTER TABLE settings  ADD COLUMN IF NOT EXISTS deposit_address_usdt_erc20   TEXT",
        "ALTER TABLE settings  ADD COLUMN IF NOT EXISTS deposit_address_trx          TEXT",
        "ALTER TABLE settings  ADD COLUMN IF NOT EXISTS trx_price                    FLOAT   DEFAULT 0.15",
        "ALTER TABLE settings  ADD COLUMN IF NOT EXISTS auto_approve                 BOOLEAN DEFAULT FALSE",
        "ALTER TABLE settings  ADD COLUMN IF NOT EXISTS withdrawal_fee_btc           FLOAT   DEFAULT 0.0",
        "ALTER TABLE settings  ADD COLUMN IF NOT EXISTS withdrawal_fee_eth           FLOAT   DEFAULT 0.0",
        "ALTER TABLE settings  ADD COLUMN IF NOT EXISTS withdrawal_fee_usdt_trc20    FLOAT   DEFAULT 0.0",
        "ALTER TABLE settings  ADD COLUMN IF NOT EXISTS withdrawal_fee_usdt_bep20    FLOAT   DEFAULT 0.0",
        "ALTER TABLE settings  ADD COLUMN IF NOT EXISTS withdrawal_fee_usdt_erc20    FLOAT   DEFAULT 0.0",
        "ALTER TABLE settings  ADD COLUMN IF NOT EXISTS withdrawal_fee_trx           FLOAT   DEFAULT 0.0",
        # Data migrations
        "UPDATE wallets SET usdt_trc20 = usdt WHERE usdt IS NOT NULL AND usdt > 0 AND usdt_trc20 = 0",
        "UPDATE settings SET deposit_address_usdt_trc20 = deposit_address_usdt WHERE deposit_address_usdt IS NOT NULL AND deposit_address_usdt_trc20 IS NULL",
        "UPDATE transactions SET asset = 'usdt_trc20' WHERE asset = 'usdt'",
        # Assign orphaned wallet / transactions to first user
        "UPDATE wallets SET user_id = (SELECT id FROM users ORDER BY id LIMIT 1) WHERE user_id IS NULL AND EXISTS (SELECT 1 FROM users LIMIT 1)",
        "UPDATE transactions SET user_id = (SELECT id FROM users ORDER BY id LIMIT 1) WHERE user_id IS NULL AND EXISTS (SELECT 1 FROM users LIMIT 1)",
        # Admin withdrawal enable flag (default off)
        "ALTER TABLE wallets ADD COLUMN IF NOT EXISTS withdrawal_enabled BOOLEAN DEFAULT FALSE",
    ]
    for stmt in stmts:
        try:
            with engine.connect() as conn:
                conn.execute(text(stmt))
                conn.commit()
        except Exception:
            pass


# ── Seeding ───────────────────────────────────────────────────────────────────

def seed_users(db: Session) -> None:
    if USER_USERNAME and USER_PASSWORD:
        user = db.query(User).filter_by(username=USER_USERNAME).first()
        if not user:
            user = User(username=USER_USERNAME, password_hash=hash_password(USER_PASSWORD), role="user")
            db.add(user)
            db.commit()
            db.refresh(user)
        get_or_create_wallet(user, db)


def seed_defaults(db: Session) -> None:
    if not db.query(Wallet).filter(Wallet.user_id.isnot(None)).first():
        first_user = db.query(User).first()
        if first_user:
            w = db.query(Wallet).filter(Wallet.user_id == first_user.id).first()
            if not w:
                w = Wallet(user_id=first_user.id, btc=0.15846154)
                db.add(w)
                db.commit()
    if not db.query(Transaction).first():
        first_user = db.query(User).first()
        uid = first_user.id if first_user else None
        for tx in [
            Transaction(user_id=uid, asset="btc", type="Deposit", change=0.00307692, date="06/28/2026"),
            Transaction(user_id=uid, asset="btc", type="Deposit", change=0.07692308, date="07/02/2026"),
            Transaction(user_id=uid, asset="btc", type="Deposit", change=0.07846154, date="07/08/2026"),
        ]:
            db.add(tx)
        db.commit()
    if not db.query(Settings).first():
        db.add(Settings(
            gas_fee_usd=853.0, gas_fee_btc=0.01312308,
            btc_price=65000.0, eth_price=3500.0, usdt_price=1.0, trx_price=0.15,
            auto_approve=False,
        ))
        db.commit()


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _migrate()

    db = next(get_db())
    try:
        seed_users(db)
        seed_defaults(db)
    finally:
        db.close()

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

    price_task = asyncio.create_task(price_refresh_loop())
    keep_alive_task = asyncio.create_task(keep_alive_loop())
    yield
    price_task.cancel()
    keep_alive_task.cancel()


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="Crypto Wallet API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Auth ──────────────────────────────────────────────────────────────────────

@app.post("/api/auth/login", response_model=AuthResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    if (ADMIN_USERNAME and ADMIN_PASSWORD
            and data.username == ADMIN_USERNAME
            and data.password == ADMIN_PASSWORD):
        return AuthResponse(username=ADMIN_USERNAME, role="admin", user_id=None)
    user = db.query(User).filter(User.username == data.username).first()
    if user and verify_password(data.password, user.password_hash):
        get_or_create_wallet(user, db)
        return AuthResponse(username=user.username, role=user.role, user_id=user.id)
    raise HTTPException(status_code=401, detail="Invalid username or password")


@app.post("/api/auth/signup", response_model=AuthResponse, status_code=201)
def signup(data: SignupRequest, db: Session = Depends(get_db)):
    if ADMIN_USERNAME and data.username == ADMIN_USERNAME:
        raise HTTPException(status_code=400, detail="Username not available")
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")
    user = User(username=data.username, password_hash=hash_password(data.password), role="user")
    db.add(user)
    db.commit()
    db.refresh(user)
    get_or_create_wallet(user, db)
    return AuthResponse(username=user.username, role=user.role, user_id=user.id)


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/healthz")
def health():
    return {"status": "ok"}


# ── Wallet ────────────────────────────────────────────────────────────────────

@app.get("/api/wallet", response_model=WalletResponse)
def get_wallet(current_user: User = Depends(require_user), db: Session = Depends(get_db)):
    wallet = get_or_create_wallet(current_user, db)
    return wallet


@app.put("/api/wallet", response_model=WalletResponse)
def update_wallet(data: WalletUpdate, current_user: User = Depends(require_user), db: Session = Depends(get_db)):
    wallet = get_or_create_wallet(current_user, db)
    today = date.today().strftime("%m/%d/%Y")
    for asset_name, old_val, new_val in [
        ("btc", wallet.btc, data.btc),
        ("eth", wallet.eth, data.eth),
        ("usdt_trc20", wallet.usdt_trc20, data.usdt_trc20),
        ("usdt_bep20", wallet.usdt_bep20, data.usdt_bep20),
        ("usdt_erc20", wallet.usdt_erc20, data.usdt_erc20),
        ("trx", wallet.trx, data.trx),
    ]:
        diff = new_val - old_val
        if abs(diff) > 1e-10:
            db.add(Transaction(
                user_id=current_user.id,
                asset=asset_name,
                type="Deposit" if diff > 0 else "Deduction",
                change=abs(diff),
                date=today,
            ))
    wallet.btc = data.btc
    wallet.eth = data.eth
    wallet.usdt_trc20 = data.usdt_trc20
    wallet.usdt_bep20 = data.usdt_bep20
    wallet.usdt_erc20 = data.usdt_erc20
    wallet.trx = data.trx
    db.commit()
    db.refresh(wallet)
    return wallet


# ── Admin: User management ────────────────────────────────────────────────────

@app.get("/api/admin/users")
def list_users(db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.id).all()
    result = []
    for u in users:
        wallet = db.query(Wallet).filter(Wallet.user_id == u.id).first()
        result.append({
            "id": u.id,
            "username": u.username,
            "role": u.role,
            "wallet": {
                "id": wallet.id,
                "user_id": wallet.user_id,
                "btc": wallet.btc,
                "eth": wallet.eth,
                "usdt_trc20": wallet.usdt_trc20,
                "usdt_bep20": wallet.usdt_bep20,
                "usdt_erc20": wallet.usdt_erc20,
                "trx": wallet.trx,
            } if wallet else None,
        })
    # Append synthetic admin entry if env admin is configured
    if ADMIN_USERNAME:
        result.append({
            "id": -1,
            "username": ADMIN_USERNAME,
            "role": "admin",
            "wallet": None,
        })
    return result


@app.put("/api/admin/users/{user_id}/wallet", response_model=WalletResponse)
def admin_update_user_wallet(user_id: int, data: WalletUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    wallet = get_or_create_wallet(user, db)
    today = date.today().strftime("%m/%d/%Y")
    now_str = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    deposit_parts = []
    for asset_name, old_val, new_val in [
        ("btc", wallet.btc, data.btc),
        ("eth", wallet.eth, data.eth),
        ("usdt_trc20", wallet.usdt_trc20, data.usdt_trc20),
        ("usdt_bep20", wallet.usdt_bep20, data.usdt_bep20),
        ("usdt_erc20", wallet.usdt_erc20, data.usdt_erc20),
        ("trx", wallet.trx, data.trx),
    ]:
        diff = new_val - old_val
        if abs(diff) > 1e-10:
            db.add(Transaction(
                user_id=user.id,
                asset=asset_name,
                type="Deposit" if diff > 0 else "Deduction",
                change=abs(diff),
                date=today,
            ))
            if diff > 0:
                label = asset_name.upper().replace("_", " ")
                deposit_parts.append(f"+{new_val - old_val:.8g} {label}")
    wallet.btc = data.btc
    wallet.eth = data.eth
    wallet.usdt_trc20 = data.usdt_trc20
    wallet.usdt_bep20 = data.usdt_bep20
    wallet.usdt_erc20 = data.usdt_erc20
    wallet.trx = data.trx
    db.commit()
    db.refresh(wallet)
    if deposit_parts:
        msg = "Deposit credited to your wallet: " + ", ".join(deposit_parts)
        db.add(Notification(user_id=user.id, message=msg, is_read=False, created_at=now_str))
        db.commit()
    return wallet


@app.patch("/api/admin/users/{user_id}/toggle-withdrawal")
def admin_toggle_withdrawal(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    wallet = get_or_create_wallet(user, db)
    wallet.withdrawal_enabled = not wallet.withdrawal_enabled
    db.commit()
    db.refresh(wallet)
    return {"withdrawal_enabled": wallet.withdrawal_enabled}


@app.delete("/api/admin/users/{user_id}/transactions", status_code=204)
def admin_wipe_user_transactions(user_id: int, db: Session = Depends(get_db)):
    db.query(Transaction).filter(Transaction.user_id == user_id).delete()
    db.commit()


# ── Transactions ──────────────────────────────────────────────────────────────

@app.get("/api/transactions", response_model=List[TransactionResponse])
def get_transactions(current_user: User = Depends(require_user), db: Session = Depends(get_db)):
    return db.query(Transaction).filter(Transaction.user_id == current_user.id).order_by(Transaction.id).all()


@app.delete("/api/transactions", status_code=204)
def wipe_all_transactions(db: Session = Depends(get_db)):
    db.query(Transaction).delete()
    db.commit()


@app.post("/api/transactions", response_model=WalletResponse)
def send_withdraw(data: TransactionCreate, current_user: User = Depends(require_user), db: Session = Depends(get_db)):
    wallet = get_or_create_wallet(current_user, db)
    settings = db.query(Settings).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    # Gate 1: admin must have enabled withdrawals for this user
    if not wallet.withdrawal_enabled:
        raise HTTPException(
            status_code=403,
            detail="Withdrawals are not enabled for your account. Please contact admin.",
        )
    asset = data.asset.lower()
    if asset not in ("btc", "eth", "usdt_trc20", "usdt_bep20", "usdt_erc20", "trx"):
        raise HTTPException(status_code=400, detail="Invalid asset")
    current = getattr(wallet, asset)
    if data.amount > current:
        raise HTTPException(status_code=400, detail=f"Insufficient {asset.upper()} balance")
    today = date.today().strftime("%m/%d/%Y")
    setattr(wallet, asset, current - data.amount)
    db.add(Transaction(user_id=current_user.id, asset=asset, type="Withdrawal", change=data.amount, date=today))
    db.commit()
    db.refresh(wallet)
    return wallet


# ── Notifications ─────────────────────────────────────────────────────────────

@app.get("/api/notifications", response_model=List[NotificationResponse])
def get_notifications(current_user: User = Depends(require_user), db: Session = Depends(get_db)):
    return (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read == False)
        .order_by(Notification.id)
        .all()
    )


@app.patch("/api/notifications/{notif_id}/read", status_code=204)
def mark_notification_read(notif_id: int, current_user: User = Depends(require_user), db: Session = Depends(get_db)):
    n = db.query(Notification).filter(Notification.id == notif_id, Notification.user_id == current_user.id).first()
    if n:
        n.is_read = True
        db.commit()


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
