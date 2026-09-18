import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env")

# FINAL INTEGRATED BUILD: website + mobile share the existing website PostgreSQL DB.
# A SQLite fallback is intentionally forbidden because it causes the exact
# "website data is not on app" split that this build is designed to eliminate.
DATABASE_URL = (os.getenv("DATABASE_URL") or "").strip()

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not configured. Copy the exact PostgreSQL DATABASE_URL "
        "from your original CINTRA website backend/.env into this backend/.env."
    )

if not DATABASE_URL.lower().startswith(("postgresql://", "postgresql+psycopg2://")):
    raise RuntimeError(
        "CINTRA final unified build requires the shared PostgreSQL website database. "
        "SQLite/mobile-local databases are not allowed as the source of truth."
    )

engine = create_engine(DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
