from pydantic import BaseModel, Field
from typing import Optional, List


# ── Auth ─────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class SignupRequest(BaseModel):
    username: str = Field(min_length=2, max_length=30)
    password: str = Field(min_length=6)
    wallet_name: Optional[str] = Field(default=None, max_length=40)


class AuthResponse(BaseModel):
    username: str
    role: str
    user_id: Optional[int] = None


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=6)


class ChangeUsernameRequest(BaseModel):
    new_username: str = Field(min_length=2, max_length=30)
    password: str = Field(min_length=1)


class AdminResetPasswordRequest(BaseModel):
    new_password: str = Field(min_length=6)


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
    wallet_name: Optional[str] = None
    # Per-user network fee overrides (USD). None = inherit the global default.
    network_fee_btc: Optional[float] = None
    network_fee_eth: Optional[float] = None
    network_fee_usdt_trc20: Optional[float] = None
    network_fee_usdt_bep20: Optional[float] = None
    network_fee_usdt_erc20: Optional[float] = None
    network_fee_trx: Optional[float] = None
    # Per-user withdrawal charges (native asset units). None / 0 = no charge.
    withdrawal_charge_btc: Optional[float] = None
    withdrawal_charge_eth: Optional[float] = None
    withdrawal_charge_usdt_trc20: Optional[float] = None
    withdrawal_charge_usdt_bep20: Optional[float] = None
    withdrawal_charge_usdt_erc20: Optional[float] = None
    withdrawal_charge_trx: Optional[float] = None

    model_config = {"from_attributes": True}


class WalletUpdate(BaseModel):
    btc: float = Field(ge=0)
    eth: float = Field(ge=0)
    usdt_trc20: float = Field(ge=0)
    usdt_bep20: float = Field(ge=0)
    usdt_erc20: float = Field(ge=0)
    trx: float = Field(ge=0)


class NetworkFeeUpdate(BaseModel):
    """Per-user network fee overrides. Omit a field (or send null) to clear
    the override and fall back to the global settings default for that asset."""
    network_fee_btc: Optional[float] = Field(default=None, ge=0)
    network_fee_eth: Optional[float] = Field(default=None, ge=0)
    network_fee_usdt_trc20: Optional[float] = Field(default=None, ge=0)
    network_fee_usdt_bep20: Optional[float] = Field(default=None, ge=0)
    network_fee_usdt_erc20: Optional[float] = Field(default=None, ge=0)
    network_fee_trx: Optional[float] = Field(default=None, ge=0)


class WithdrawalChargeUpdate(BaseModel):
    """Per-user withdrawal charges in native asset units (e.g. BTC for btc).
    Deducted automatically at confirmation time in addition to the withdrawal amount.
    Omit a field (or send null/0) to apply no charge for that asset."""
    withdrawal_charge_btc: Optional[float] = Field(default=None, ge=0)
    withdrawal_charge_eth: Optional[float] = Field(default=None, ge=0)
    withdrawal_charge_usdt_trc20: Optional[float] = Field(default=None, ge=0)
    withdrawal_charge_usdt_bep20: Optional[float] = Field(default=None, ge=0)
    withdrawal_charge_usdt_erc20: Optional[float] = Field(default=None, ge=0)
    withdrawal_charge_trx: Optional[float] = Field(default=None, ge=0)


class DepositRequest(BaseModel):
    asset: str = Field(min_length=1)
    amount: float = Field(gt=0, description="Crypto amount to add to existing balance")


# ── Transactions ──────────────────────────────────────────────────────────────

class TransactionResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    asset: str
    type: str
    change: float
    date: str
    message: Optional[str] = None

    model_config = {"from_attributes": True}


class TransactionCreate(BaseModel):
    asset: str
    amount: float = Field(gt=0, description="Must be a positive number")
    address: str = Field(min_length=1)


# ── Pending Withdrawals ───────────────────────────────────────────────────────

class WithdrawalRequestCreate(BaseModel):
    asset: str
    amount: float = Field(gt=0)
    address: str = Field(min_length=1)


class PendingWithdrawalResponse(BaseModel):
    id: int
    user_id: int
    asset: str
    amount: float
    address: str
    status: str
    admin_message: Optional[str] = None
    created_at: str
    charge_amount: Optional[float] = None

    model_config = {"from_attributes": True}


class WithdrawalAdminResponse(BaseModel):
    id: int
    user_id: int
    username: str
    asset: str
    amount: float
    address: str
    status: str
    admin_message: Optional[str] = None
    created_at: str


class WithdrawalConfirmBody(BaseModel):
    message: Optional[str] = None


class WithdrawalRejectBody(BaseModel):
    message: str = Field(min_length=1, description="Reason for rejection (required)")


# ── Notifications ─────────────────────────────────────────────────────────────

class NotificationResponse(BaseModel):
    id: int
    user_id: int
    message: str
    is_read: bool
    created_at: str
    notif_type: Optional[str] = "deposit"

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
    profile_photo: Optional[str] = None
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
