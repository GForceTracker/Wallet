from sqlalchemy import Column, Integer, Float, String, Boolean, ForeignKey
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="user", nullable=False)


class Wallet(Base):
    __tablename__ = "wallets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    btc = Column(Float, default=0.0, nullable=False)
    eth = Column(Float, default=0.0, nullable=False)
    usdt_trc20 = Column(Float, default=0.0, nullable=False)
    usdt_bep20 = Column(Float, default=0.0, nullable=False)
    usdt_erc20 = Column(Float, default=0.0, nullable=False)
    trx = Column(Float, default=0.0, nullable=False)
    # Admin must enable withdrawals for this user before they can send
    withdrawal_enabled = Column(Boolean, default=False, nullable=False)


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    asset = Column(String, nullable=False)
    type = Column(String, nullable=False)
    change = Column(Float, nullable=False)
    date = Column(String, nullable=False)
    message = Column(String, nullable=True)


class PendingWithdrawal(Base):
    __tablename__ = "pending_withdrawals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    asset = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    address = Column(String, nullable=False)
    # pending / confirmed / rejected
    status = Column(String, default="pending", nullable=False)
    admin_message = Column(String, nullable=True)
    created_at = Column(String, nullable=False)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message = Column(String, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(String, nullable=False)
    # type: deposit / withdrawal_confirmed / withdrawal_rejected
    notif_type = Column(String, nullable=True, default="deposit")


class Settings(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    gas_fee_usd = Column(Float, default=853.0, nullable=False)
    gas_fee_btc = Column(Float, default=0.01312308, nullable=False)
    btc_price = Column(Float, default=65000.0, nullable=False)
    eth_price = Column(Float, default=3500.0, nullable=False)
    usdt_price = Column(Float, default=1.0, nullable=False)
    trx_price = Column(Float, default=0.15, nullable=False)
    deposit_address_btc = Column(String, nullable=True, default=None)
    deposit_address_eth = Column(String, nullable=True, default=None)
    deposit_address_usdt_trc20 = Column(String, nullable=True, default=None)
    deposit_address_usdt_bep20 = Column(String, nullable=True, default=None)
    deposit_address_usdt_erc20 = Column(String, nullable=True, default=None)
    deposit_address_trx = Column(String, nullable=True, default=None)
    auto_approve = Column(Boolean, default=False, nullable=False)
    withdrawal_fee_btc = Column(Float, default=0.0, nullable=False)
    withdrawal_fee_eth = Column(Float, default=0.0, nullable=False)
    withdrawal_fee_usdt_trc20 = Column(Float, default=0.0, nullable=False)
    withdrawal_fee_usdt_bep20 = Column(Float, default=0.0, nullable=False)
    withdrawal_fee_usdt_erc20 = Column(Float, default=0.0, nullable=False)
    withdrawal_fee_trx = Column(Float, default=0.0, nullable=False)
