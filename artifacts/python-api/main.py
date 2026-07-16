import asyncio
import hashlib
import logging
import os
import secrets
import shutil
import time
from contextlib import asynccontextmanager
from datetime import date, datetime
from pathlib import Path
from typing import List, Optional

import httpx
from fastapi import Depends, FastAPI, File, HTTPException, Header, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

# ── Upload directory ──────────────────────────────────────────────────────────
UPLOADS_DIR = Path(__file__).parent / "uploads" / "photos"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
from sqlalchemy import func, text
from sqlalchemy.orm import Session

logger = logging.getLogger("uvicorn.error")

from database import Base, engine, get_db
from models import Notification, PendingWithdrawal, Settings, Transaction, User, Wallet
from schemas import (
    AdminResetPasswordRequest,
    AuthResponse,
    ChangePasswordRequest,
    ChangeUsernameRequest,
    DepositRequest,
    LoginRequest,
    NetworkFeeUpdate,
    NotificationResponse,
    PendingWithdrawalResponse,
    SettingsResponse,
    SettingsUpdate,
    SignupRequest,
    TransactionCreate,
    TransactionResponse,
    UserWithWallet,
    WalletResponse,
    WalletUpdate,
    WithdrawalAdminResponse,
    WithdrawalChargeUpdate,
    WithdrawalConfirmBody,
    WithdrawalRejectBody,
    WithdrawalRequestCreate,
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


def require_admin(x_username: Optional[str] = Header(default=None)) -> str:
    if not x_username:
        raise HTTPException(status_code=401, detail="Authentication required")
    if not ADMIN_USERNAME or x_username != ADMIN_USERNAME:
        raise HTTPException(status_code=403, detail="Admin access required")
    return x_username


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
        "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS message                   TEXT",
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
        # Per-user network fee overrides (NULL = inherit the global default above)
        "ALTER TABLE wallets   ADD COLUMN IF NOT EXISTS network_fee_btc              FLOAT",
        "ALTER TABLE wallets   ADD COLUMN IF NOT EXISTS network_fee_eth              FLOAT",
        "ALTER TABLE wallets   ADD COLUMN IF NOT EXISTS network_fee_usdt_trc20       FLOAT",
        "ALTER TABLE wallets   ADD COLUMN IF NOT EXISTS network_fee_usdt_bep20       FLOAT",
        "ALTER TABLE wallets   ADD COLUMN IF NOT EXISTS network_fee_usdt_erc20       FLOAT",
        "ALTER TABLE wallets   ADD COLUMN IF NOT EXISTS network_fee_trx              FLOAT",
        # Legacy "usdt" column (pre-dates usdt_trc20/bep20/erc20 split): on
        # older production databases it's still NOT NULL, which makes every
        # new wallet INSERT fail (new code never sets it). Relax it so
        # signup/login can create wallets again. No-ops (fails silently) on
        # fresh databases where the column was never created.
        "ALTER TABLE wallets ALTER COLUMN usdt DROP NOT NULL",
        "ALTER TABLE wallets ALTER COLUMN usdt SET DEFAULT 0.0",
        "UPDATE wallets SET usdt = 0.0 WHERE usdt IS NULL",
        # Data migrations
        "UPDATE wallets SET usdt_trc20 = usdt WHERE usdt IS NOT NULL AND usdt > 0 AND usdt_trc20 = 0",
        "UPDATE settings SET deposit_address_usdt_trc20 = deposit_address_usdt WHERE deposit_address_usdt IS NOT NULL AND deposit_address_usdt_trc20 IS NULL",
        "UPDATE transactions SET asset = 'usdt_trc20' WHERE asset = 'usdt'",
        # Assign orphaned wallet / transactions to first user
        "UPDATE wallets SET user_id = (SELECT id FROM users ORDER BY id LIMIT 1) WHERE user_id IS NULL AND EXISTS (SELECT 1 FROM users LIMIT 1)",
        "UPDATE transactions SET user_id = (SELECT id FROM users ORDER BY id LIMIT 1) WHERE user_id IS NULL AND EXISTS (SELECT 1 FROM users LIMIT 1)",
        # Admin withdrawal enable flag (default off)
        "ALTER TABLE wallets ADD COLUMN IF NOT EXISTS withdrawal_enabled BOOLEAN DEFAULT FALSE",
        # Wallet name chosen at signup
        "ALTER TABLE wallets ADD COLUMN IF NOT EXISTS wallet_name TEXT",
        # Notifications: type column
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS notif_type TEXT DEFAULT 'deposit'",
        # Per-user withdrawal charges (native asset units). NULL / 0 = no charge.
        "ALTER TABLE wallets ADD COLUMN IF NOT EXISTS withdrawal_charge_btc          FLOAT",
        "ALTER TABLE wallets ADD COLUMN IF NOT EXISTS withdrawal_charge_eth          FLOAT",
        "ALTER TABLE wallets ADD COLUMN IF NOT EXISTS withdrawal_charge_usdt_trc20   FLOAT",
        "ALTER TABLE wallets ADD COLUMN IF NOT EXISTS withdrawal_charge_usdt_bep20   FLOAT",
        "ALTER TABLE wallets ADD COLUMN IF NOT EXISTS withdrawal_charge_usdt_erc20   FLOAT",
        "ALTER TABLE wallets ADD COLUMN IF NOT EXISTS withdrawal_charge_trx          FLOAT",
        # Withdrawal charge snapshotted at request time on pending_withdrawals
        "ALTER TABLE pending_withdrawals ADD COLUMN IF NOT EXISTS charge_amount FLOAT",
        # User profile photo URL
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo TEXT",
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


# Surface unhandled backend errors as JSON (with the real reason) instead of a
# blank "Internal Server Error" page, so a failure can be diagnosed from what
# the app shows on screen instead of needing server log access.
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled error on %s %s", request.method, request.url.path, exc_info=exc)
    return JSONResponse(
        status_code=500,
        content={"detail": f"{type(exc).__name__}: {exc}"},
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
    wallet = get_or_create_wallet(user, db)
    if data.wallet_name and data.wallet_name.strip():
        wallet.wallet_name = data.wallet_name.strip()
        db.commit()
    return AuthResponse(username=user.username, role=user.role, user_id=user.id)


@app.put("/api/auth/change-password", response_model=AuthResponse)
def change_password(data: ChangePasswordRequest, current_user: User = Depends(require_user), db: Session = Depends(get_db)):
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current_user.password_hash = hash_password(data.new_password)
    db.commit()
    db.refresh(current_user)
    return AuthResponse(username=current_user.username, role=current_user.role, user_id=current_user.id)


@app.put("/api/auth/change-username", response_model=AuthResponse)
def change_username(data: ChangeUsernameRequest, current_user: User = Depends(require_user), db: Session = Depends(get_db)):
    if not verify_password(data.password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Password is incorrect")
    # Ensure new username isn't taken
    if data.new_username == ADMIN_USERNAME:
        raise HTTPException(status_code=400, detail="Username not available")
    existing = db.query(User).filter(User.username == data.new_username).first()
    if existing and existing.id != current_user.id:
        raise HTTPException(status_code=400, detail="Username already taken")
    current_user.username = data.new_username
    db.commit()
    db.refresh(current_user)
    return AuthResponse(username=current_user.username, role=current_user.role, user_id=current_user.id)


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

@app.post("/api/profile/photo")
async def upload_profile_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    allowed = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, WEBP or GIF images are supported")
    ext = (file.filename or "photo").rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "jpg"
    filename = f"user_{current_user.id}_{int(time.time())}.{ext}"
    dest = UPLOADS_DIR / filename
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    # Remove old photo file if present
    if current_user.profile_photo:
        old_name = current_user.profile_photo.rsplit("/", 1)[-1]
        old_path = UPLOADS_DIR / old_name
        if old_path.exists() and old_path.is_file():
            old_path.unlink(missing_ok=True)
    photo_url = f"/api/profile/photo/{filename}"
    current_user.profile_photo = photo_url
    db.commit()
    return {"profile_photo": photo_url}


@app.get("/api/profile/photo/{filename}")
async def serve_profile_photo(filename: str):
    path = UPLOADS_DIR / filename
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Photo not found")
    return FileResponse(str(path))


@app.get("/api/admin/users")
def list_users(db: Session = Depends(get_db), _admin: str = Depends(require_admin)):
    users = db.query(User).order_by(User.id).all()
    result = []
    for u in users:
        wallet = db.query(Wallet).filter(Wallet.user_id == u.id).first()
        result.append({
            "id": u.id,
            "username": u.username,
            "role": u.role,
            "profile_photo": u.profile_photo,
            "wallet": {
                "id": wallet.id,
                "user_id": wallet.user_id,
                "btc": wallet.btc,
                "eth": wallet.eth,
                "usdt_trc20": wallet.usdt_trc20,
                "usdt_bep20": wallet.usdt_bep20,
                "usdt_erc20": wallet.usdt_erc20,
                "trx": wallet.trx,
                "withdrawal_enabled": wallet.withdrawal_enabled,
                "wallet_name": wallet.wallet_name,
                "network_fee_btc": wallet.network_fee_btc,
                "network_fee_eth": wallet.network_fee_eth,
                "network_fee_usdt_trc20": wallet.network_fee_usdt_trc20,
                "network_fee_usdt_bep20": wallet.network_fee_usdt_bep20,
                "network_fee_usdt_erc20": wallet.network_fee_usdt_erc20,
                "network_fee_trx": wallet.network_fee_trx,
                "withdrawal_charge_btc": wallet.withdrawal_charge_btc,
                "withdrawal_charge_eth": wallet.withdrawal_charge_eth,
                "withdrawal_charge_usdt_trc20": wallet.withdrawal_charge_usdt_trc20,
                "withdrawal_charge_usdt_bep20": wallet.withdrawal_charge_usdt_bep20,
                "withdrawal_charge_usdt_erc20": wallet.withdrawal_charge_usdt_erc20,
                "withdrawal_charge_trx": wallet.withdrawal_charge_trx,
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
def admin_update_user_wallet(user_id: int, data: WalletUpdate, db: Session = Depends(get_db), _admin: str = Depends(require_admin)):
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
        db.add(Notification(user_id=user.id, message=msg, is_read=False, created_at=now_str, notif_type="deposit"))
        db.commit()
    return wallet


@app.post("/api/admin/users/{user_id}/deposit", response_model=WalletResponse)
def admin_deposit_to_wallet(user_id: int, data: DepositRequest, db: Session = Depends(get_db), _admin: str = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    wallet = get_or_create_wallet(user, db)
    valid_assets = ["btc", "eth", "usdt_trc20", "usdt_bep20", "usdt_erc20", "trx"]
    asset = data.asset.lower()
    if asset not in valid_assets:
        raise HTTPException(status_code=400, detail=f"Invalid asset '{asset}'. Must be one of: {', '.join(valid_assets)}")
    today = date.today().strftime("%m/%d/%Y")
    now_str = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    current = getattr(wallet, asset, 0) or 0
    setattr(wallet, asset, current + data.amount)
    db.add(Transaction(
        user_id=user.id,
        asset=asset,
        type="Deposit",
        change=data.amount,
        date=today,
    ))
    db.commit()
    db.refresh(wallet)
    label = asset.upper().replace("_", " ")
    msg = f"Deposit credited to your wallet: +{data.amount:.8g} {label}"
    db.add(Notification(user_id=user.id, message=msg, is_read=False, created_at=now_str, notif_type="deposit"))
    db.commit()
    return wallet


@app.patch("/api/admin/users/{user_id}/toggle-withdrawal")
def admin_toggle_withdrawal(user_id: int, db: Session = Depends(get_db), _admin: str = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    wallet = get_or_create_wallet(user, db)
    wallet.withdrawal_enabled = not wallet.withdrawal_enabled
    db.commit()
    db.refresh(wallet)
    return {"withdrawal_enabled": wallet.withdrawal_enabled}


@app.put("/api/admin/users/{user_id}/network-fees", response_model=WalletResponse)
def admin_update_network_fees(user_id: int, data: NetworkFeeUpdate, db: Session = Depends(get_db), _admin: str = Depends(require_admin)):
    """Set (or clear, via null) this user's custom network fee for each asset.
    A null field means the user falls back to the global settings default."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    wallet = get_or_create_wallet(user, db)
    wallet.network_fee_btc = data.network_fee_btc
    wallet.network_fee_eth = data.network_fee_eth
    wallet.network_fee_usdt_trc20 = data.network_fee_usdt_trc20
    wallet.network_fee_usdt_bep20 = data.network_fee_usdt_bep20
    wallet.network_fee_usdt_erc20 = data.network_fee_usdt_erc20
    wallet.network_fee_trx = data.network_fee_trx
    db.commit()
    db.refresh(wallet)
    return wallet


@app.put("/api/admin/users/{user_id}/withdrawal-charges", response_model=WalletResponse)
def admin_update_withdrawal_charges(user_id: int, data: WithdrawalChargeUpdate, db: Session = Depends(get_db), _admin: str = Depends(require_admin)):
    """Set per-user withdrawal charges (native asset units) deducted automatically
    at confirmation time on top of the withdrawal amount. Send null or 0 to remove a charge."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    wallet = get_or_create_wallet(user, db)
    wallet.withdrawal_charge_btc = data.withdrawal_charge_btc
    wallet.withdrawal_charge_eth = data.withdrawal_charge_eth
    wallet.withdrawal_charge_usdt_trc20 = data.withdrawal_charge_usdt_trc20
    wallet.withdrawal_charge_usdt_bep20 = data.withdrawal_charge_usdt_bep20
    wallet.withdrawal_charge_usdt_erc20 = data.withdrawal_charge_usdt_erc20
    wallet.withdrawal_charge_trx = data.withdrawal_charge_trx
    db.commit()
    db.refresh(wallet)
    return wallet


@app.delete("/api/admin/users/{user_id}/transactions", status_code=204)
def admin_wipe_user_transactions(user_id: int, db: Session = Depends(get_db), _admin: str = Depends(require_admin)):
    db.query(Transaction).filter(Transaction.user_id == user_id).delete()
    db.query(PendingWithdrawal).filter(PendingWithdrawal.user_id == user_id).delete()
    db.commit()


@app.post("/api/admin/users/{user_id}/reset-password")
def admin_reset_user_password(user_id: int, data: AdminResetPasswordRequest, db: Session = Depends(get_db), _admin: str = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.password_hash = hash_password(data.new_password)
    db.commit()
    return {"success": True, "username": user.username}


# ── Transactions ──────────────────────────────────────────────────────────────

@app.get("/api/transactions", response_model=List[TransactionResponse])
def get_transactions(current_user: User = Depends(require_user), db: Session = Depends(get_db)):
    return db.query(Transaction).filter(Transaction.user_id == current_user.id).order_by(Transaction.id).all()


@app.delete("/api/transactions", status_code=204)
def wipe_all_transactions(db: Session = Depends(get_db), _admin: str = Depends(require_admin)):
    db.query(Transaction).delete()
    db.query(PendingWithdrawal).delete()
    db.commit()


@app.post("/api/transactions", response_model=WalletResponse)
def send_withdraw(data: TransactionCreate, current_user: User = Depends(require_user), db: Session = Depends(get_db)):
    """Legacy direct-withdrawal — kept for compatibility. New flow uses /api/withdrawals/request."""
    wallet = get_or_create_wallet(current_user, db)
    settings = db.query(Settings).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    if not wallet.withdrawal_enabled:
        raise HTTPException(
            status_code=403,
            detail="Withdrawals are not enabled for your account. Please clear your network fee and contact admin.",
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


# ── Pending Withdrawals ───────────────────────────────────────────────────────

@app.post("/api/withdrawals/request", response_model=PendingWithdrawalResponse, status_code=201)
def request_withdrawal(data: WithdrawalRequestCreate, current_user: User = Depends(require_user), db: Session = Depends(get_db)):
    wallet = get_or_create_wallet(current_user, db)
    if not wallet.withdrawal_enabled:
        raise HTTPException(
            status_code=403,
            detail="Insufficient Network Fee. Kindly clear your fee and try again.",
        )
    asset = data.asset.lower()
    if asset not in ("btc", "eth", "usdt_trc20", "usdt_bep20", "usdt_erc20", "trx"):
        raise HTTPException(status_code=400, detail="Invalid asset")
    current_balance = getattr(wallet, asset)

    # Snapshot the current withdrawal charge for this asset (snapshotted now so
    # the same value is used for both the availability check and the new record).
    charge_key = f"withdrawal_charge_{asset}"
    charge_amount = getattr(wallet, charge_key, None) or 0.0

    # Reserve all balance already committed to pending withdrawals — both the
    # withdrawal amounts AND their snapshotted charges — so that the total
    # confirmed liability never exceeds the user's balance.
    pending_filter = [
        PendingWithdrawal.user_id == current_user.id,
        PendingWithdrawal.asset == asset,
        PendingWithdrawal.status == "pending",
    ]
    already_pending_amounts = db.query(func.sum(PendingWithdrawal.amount)).filter(*pending_filter).scalar() or 0.0
    already_pending_charges = db.query(func.sum(PendingWithdrawal.charge_amount)).filter(*pending_filter).scalar() or 0.0
    already_reserved = already_pending_amounts + already_pending_charges

    available = current_balance - already_reserved

    # Total this request will commit: the requested amount + its fee
    this_request_total = data.amount + charge_amount
    if this_request_total > available:
        detail = f"Insufficient available {asset.upper()} balance (including pending requests)"
        if charge_amount > 0:
            detail += f"; this withdrawal requires {this_request_total:.8g} {asset.upper()} ({data.amount:.8g} + {charge_amount:.8g} fee)"
        raise HTTPException(status_code=400, detail=detail)

    now_str = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    pw = PendingWithdrawal(
        user_id=current_user.id,
        asset=asset,
        amount=data.amount,
        address=data.address,
        status="pending",
        created_at=now_str,
        charge_amount=charge_amount if charge_amount > 0 else None,
    )
    db.add(pw)
    db.commit()
    db.refresh(pw)
    return pw


@app.get("/api/withdrawals", response_model=List[PendingWithdrawalResponse])
def get_user_withdrawals(current_user: User = Depends(require_user), db: Session = Depends(get_db)):
    return (
        db.query(PendingWithdrawal)
        .filter(PendingWithdrawal.user_id == current_user.id)
        .order_by(PendingWithdrawal.id)
        .all()
    )


@app.get("/api/admin/withdrawals", response_model=List[WithdrawalAdminResponse])
def admin_list_withdrawals(db: Session = Depends(get_db), _admin: str = Depends(require_admin)):
    rows = (
        db.query(PendingWithdrawal, User.username)
        .join(User, PendingWithdrawal.user_id == User.id)
        .order_by(PendingWithdrawal.id.desc())
        .all()
    )
    result = []
    for pw, username in rows:
        result.append(WithdrawalAdminResponse(
            id=pw.id,
            user_id=pw.user_id,
            username=username,
            asset=pw.asset,
            amount=pw.amount,
            address=pw.address,
            status=pw.status,
            admin_message=pw.admin_message,
            created_at=pw.created_at,
        ))
    return result


@app.post("/api/admin/withdrawals/{withdrawal_id}/confirm")
def admin_confirm_withdrawal(withdrawal_id: int, body: WithdrawalConfirmBody, db: Session = Depends(get_db), _admin: str = Depends(require_admin)):
    pw = db.query(PendingWithdrawal).filter(PendingWithdrawal.id == withdrawal_id).first()
    if not pw:
        raise HTTPException(status_code=404, detail="Withdrawal request not found")
    if pw.status != "pending":
        raise HTTPException(status_code=400, detail=f"Withdrawal is already {pw.status}")

    user = db.query(User).filter(User.id == pw.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    wallet = get_or_create_wallet(user, db)
    current_balance = getattr(wallet, pw.asset)
    charge = pw.charge_amount or 0.0
    total_deduct = pw.amount + charge
    if total_deduct > current_balance:
        raise HTTPException(
            status_code=400,
            detail=f"User has insufficient {pw.asset.upper()} balance to confirm "
                   f"(needs {total_deduct:.8g} including {charge:.8g} fee)",
        )

    # Deduct withdrawal amount
    setattr(wallet, pw.asset, current_balance - total_deduct)
    today = date.today().strftime("%m/%d/%Y")
    db.add(Transaction(user_id=user.id, asset=pw.asset, type="Withdrawal", change=pw.amount, date=today))
    # Record the charge as a separate fee transaction if applicable
    if charge > 0:
        db.add(Transaction(user_id=user.id, asset=pw.asset, type="Fee", change=charge, date=today))

    # Update status
    pw.status = "confirmed"
    pw.admin_message = body.message or "Your withdrawal has been confirmed and processed."

    # Send notification
    now_str = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    label = _asset_label(pw.asset)
    fee_note = f" (includes {charge:.8g} {label} withdrawal fee)" if charge > 0 else ""
    notif_msg = body.message or f"Your withdrawal of {pw.amount:.8g} {label} has been confirmed and processed successfully.{fee_note}"
    db.add(Notification(user_id=user.id, message=notif_msg, is_read=False, created_at=now_str, notif_type="withdrawal_confirmed"))
    db.commit()
    return {"success": True, "status": "confirmed"}


@app.post("/api/admin/withdrawals/{withdrawal_id}/reject")
def admin_reject_withdrawal(withdrawal_id: int, body: WithdrawalRejectBody, db: Session = Depends(get_db), _admin: str = Depends(require_admin)):
    pw = db.query(PendingWithdrawal).filter(PendingWithdrawal.id == withdrawal_id).first()
    if not pw:
        raise HTTPException(status_code=404, detail="Withdrawal request not found")
    if pw.status != "pending":
        raise HTTPException(status_code=400, detail=f"Withdrawal is already {pw.status}")

    user = db.query(User).filter(User.id == pw.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    pw.status = "rejected"
    pw.admin_message = body.message

    # Add rejected transaction to history
    today = date.today().strftime("%m/%d/%Y")
    db.add(Transaction(
        user_id=user.id,
        asset=pw.asset,
        type="Withdrawal Rejected",
        change=pw.amount,
        date=today,
        message=body.message,
    ))

    # Send notification
    now_str = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    label = _asset_label(pw.asset)
    notif_msg = f"Your withdrawal request of {pw.amount:.8g} {label} was rejected. Reason: {body.message}"
    db.add(Notification(user_id=user.id, message=notif_msg, is_read=False, created_at=now_str, notif_type="withdrawal_rejected"))
    db.commit()
    return {"success": True, "status": "rejected"}


def _asset_label(asset: str) -> str:
    labels = {
        "btc": "BTC", "eth": "ETH",
        "usdt_trc20": "USDT (TRC20)", "usdt_bep20": "USDT (BEP20)", "usdt_erc20": "USDT (ERC20)",
        "trx": "TRX",
    }
    return labels.get(asset, asset.upper())


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
