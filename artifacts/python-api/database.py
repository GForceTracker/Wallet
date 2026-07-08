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
    # Replit's built-in PostgreSQL runs locally and doesn't need SSL.
    # External managed hosts (Render, Aiven) include sslmode in their URL.
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,   # detect stale connections and reconnect
        pool_recycle=300,     # recycle connections every 5 min
    )
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
