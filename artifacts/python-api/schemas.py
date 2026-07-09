from pydantic import BaseModel, Field
from typing import Optional, List


# ── Auth ─────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class SignupRequest(BaseModel):
    username: str = Field(min_length=2, max_length=30)
    password: str = Field(min_length=6)


class AuthResponse(BaseModel):
    username: str
    role: str
    user_id: Optional[int] = None


# ── Wallet ────────────────────────────────────────────────────────────────────

class WalletResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    btc: float
    eth: float
    usdt_trc20: float
    usdt_bep20: float
    usdt_erc20: float
    trx: float
    withdrawal_enabled: bool = False

    model_config = {"from_attributes": True}


class WalletUpdate(BaseModel):
    btc: float = Field(ge=0)
    eth: float = Field(ge=0)
    usdt_trc20: float = Field(ge=0)
    usdt_bep20: float = Field(ge=0)
    usdt_erc20: float = Field(ge=0)
    trx: float = Field(ge=0)


# ── Transactions ──────────────────────────────────────────────────────────────

class TransactionResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    asset: str
    type: str
    change: float
    date: str

    model_config = {"from_attributes": True}


class TransactionCreate(BaseModel):
    asset: str
    amount: float = Field(gt=0, description="Must be a positive number")
    address: str = Field(min_length=1)


# ── Notifications ─────────────────────────────────────────────────────────────

class NotificationResponse(BaseModel):
    id: int
    user_id: int
    message: str
    is_read: bool
    created_at: str

    model_config = {"from_attributes": True}


# ── Users ─────────────────────────────────────────────────────────────────────

class UserInfo(BaseModel):
    id: int
    username: str
    role: str

    model_config = {"from_attributes": True}


class UserWithWallet(BaseModel):
    id: int
    username: str
    role: str
    wallet: Optional[WalletResponse] = None

    model_config = {"from_attributes": True}


# ── Settings ──────────────────────────────────────────────────────────────────

class SettingsResponse(BaseModel):
    id: int
    gas_fee_usd: float
    gas_fee_btc: float
    btc_price: float
    eth_price: float
    usdt_price: float
    trx_price: float
    deposit_address_btc: Optional[str] = None
    deposit_address_eth: Optional[str] = None
    deposit_address_usdt_trc20: Optional[str] = None
    deposit_address_usdt_bep20: Optional[str] = None
    deposit_address_usdt_erc20: Optional[str] = None
    deposit_address_trx: Optional[str] = None
    auto_approve: bool = False
    withdrawal_fee_btc: float = 0.0
    withdrawal_fee_eth: float = 0.0
    withdrawal_fee_usdt_trc20: float = 0.0
    withdrawal_fee_usdt_bep20: float = 0.0
    withdrawal_fee_usdt_erc20: float = 0.0
    withdrawal_fee_trx: float = 0.0

    model_config = {"from_attributes": True}


class SettingsUpdate(BaseModel):
    gas_fee_usd: Optional[float] = Field(default=None, ge=0)
    gas_fee_btc: Optional[float] = Field(default=None, ge=0)
    btc_price: Optional[float] = Field(default=None, gt=0)
    eth_price: Optional[float] = Field(default=None, gt=0)
    usdt_price: Optional[float] = Field(default=None, gt=0)
    trx_price: Optional[float] = Field(default=None, gt=0)
    deposit_address_btc: Optional[str] = Field(default=None)
    deposit_address_eth: Optional[str] = Field(default=None)
    deposit_address_usdt_trc20: Optional[str] = Field(default=None)
    deposit_address_usdt_bep20: Optional[str] = Field(default=None)
    deposit_address_usdt_erc20: Optional[str] = Field(default=None)
    deposit_address_trx: Optional[str] = Field(default=None)
    auto_approve: Optional[bool] = Field(default=None)
    withdrawal_fee_btc: Optional[float] = Field(default=None, ge=0)
    withdrawal_fee_eth: Optional[float] = Field(default=None, ge=0)
    withdrawal_fee_usdt_trc20: Optional[float] = Field(default=None, ge=0)
    withdrawal_fee_usdt_bep20: Optional[float] = Field(default=None, ge=0)
    withdrawal_fee_usdt_erc20: Optional[float] = Field(default=None, ge=0)
    withdrawal_fee_trx: Optional[float] = Field(default=None, ge=0)
