from sqlalchemy import Column, Integer, Float, String, Boolean
from database import Base


class Wallet(Base):
    __tablename__ = "wallets"

    id = Column(Integer, primary_key=True, index=True)
    btc = Column(Float, default=0.0, nullable=False)
    eth = Column(Float, default=0.0, nullable=False)
    usdt = Column(Float, default=0.0, nullable=False)
    trx = Column(Float, default=0.0, nullable=False)


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    asset = Column(String, nullable=False)
    type = Column(String, nullable=False)
    change = Column(Float, nullable=False)
    date = Column(String, nullable=False)


class Settings(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    gas_fee_usd = Column(Float, default=853.0, nullable=False)
    gas_fee_btc = Column(Float, default=0.01312308, nullable=False)
    btc_price = Column(Float, default=65000.0, nullable=False)
    eth_price = Column(Float, default=3500.0, nullable=False)
    usdt_price = Column(Float, default=1.0, nullable=False)
    trx_price = Column(Float, default=0.15, nullable=False)
    # Deposit addresses — set by admin
    deposit_address_btc = Column(String, nullable=True, default=None)
    deposit_address_eth = Column(String, nullable=True, default=None)
    deposit_address_usdt = Column(String, nullable=True, default=None)
    deposit_address_trx = Column(String, nullable=True, default=None)
    # Auto-approve: skip gas fee requirement for withdrawals
    auto_approve = Column(Boolean, default=False, nullable=False)
