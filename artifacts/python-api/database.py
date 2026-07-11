import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./wallet.db")

# Render / Aiven use postgres:// but SQLAlchemy 1.4+ requires postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    engine = create_engine(DATABASE_URL, connect_args=connect_args)
else:
    # Managed PostgreSQL hosts (Render, Northflank, Aiven, etc.) require SSL.
    # Only inject sslmode when the URL doesn't already specify it.
    connect_args: dict = {
        # Without this, a stuck/unreachable DB connection hangs forever with
        # no error — requests (e.g. login) just spin indefinitely instead of
        # failing fast. 10s is generous for a healthy managed Postgres.
        "connect_timeout": 10,
    }
    if "sslmode" not in DATABASE_URL:
        connect_args["sslmode"] = "require"
    engine = create_engine(
        DATABASE_URL,
        connect_args=connect_args,
        pool_pre_ping=True,   # detect stale connections and reconnect
        pool_recycle=300,     # recycle connections every 5 min
        pool_timeout=15,      # fail fast instead of hanging if pool is exhausted
    )
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
