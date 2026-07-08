from pydantic import BaseModel, Field
from typing import Optional


class WalletResponse(BaseModel):
    id: int
    btc: float
    eth: float
    usdt: float

    model_config = {"from_attributes": True}


class WalletUpdate(BaseModel):
    btc: float = Field(ge=0)
    eth: float = Field(ge=0)
    usdt: float = Field(ge=0)


class TransactionResponse(BaseModel):
    id: int
    asset: str
    type: str
    change: float
    date: str

    model_config = {"from_attributes": True}


class TransactionCreate(BaseModel):
    asset: str
    amount: float = Field(gt=0, description="Must be a positive number")
    address: str = Field(min_length=1)


class SettingsResponse(BaseModel):
    id: int
    gas_fee_usd: float
    gas_fee_btc: float
    btc_price: float
    eth_price: float
    usdt_price: float
    deposit_address_btc: Optional[str] = None
    deposit_address_eth: Optional[str] = None
    deposit_address_usdt: Optional[str] = None

    model_config = {"from_attributes": True}


class SettingsUpdate(BaseModel):
    gas_fee_usd: Optional[float] = Field(default=None, ge=0)
    gas_fee_btc: Optional[float] = Field(default=None, ge=0)
    btc_price: Optional[float] = Field(default=None, gt=0)
    eth_price: Optional[float] = Field(default=None, gt=0)
    usdt_price: Optional[float] = Field(default=None, gt=0)
    deposit_address_btc: Optional[str] = Field(default=None)
    deposit_address_eth: Optional[str] = Field(default=None)
    deposit_address_usdt: Optional[str] = Field(default=None)
