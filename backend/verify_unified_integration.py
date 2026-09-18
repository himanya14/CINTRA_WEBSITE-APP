"""CINTRA unified integration pre-flight check.

Run from backend after backend/.env points to the existing website PostgreSQL DB:
    .\\venv\\Scripts\\python.exe verify_unified_integration.py

This never prints passwords, MFA secrets, or token material.
"""
from sqlalchemy import inspect

from app.database import Base, SessionLocal, engine
from app import models


def ok(message):
    print(f"[OK] {message}")


def fail(message):
    print(f"[FAIL] {message}")
    raise SystemExit(1)


def main():
    if engine.dialect.name != "postgresql":
        fail(f"Database engine is {engine.dialect.name}; PostgreSQL is required")

    ok(f"PostgreSQL connected: {engine.url.database}")

    # Safe: creates only missing tables; it does not replace the website DB.
    Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())

    required = {
        "officers",
        "mfa_challenges",
        "officer_sessions",
        "cases",
        "persons",
        "case_persons",
        "evidence",
        "intelligence_relationships",
        "intelligence_analyses",
        "timeline_events",
        "chain_of_custody_events",
        "evidence_security",
        "custody_ledger_receipts",
    }
    missing = sorted(required - tables)
    if missing:
        fail("Missing required tables: " + ", ".join(missing))
    ok("Shared investigation + auth + secure-evidence tables are present")

    db = SessionLocal()
    try:
        officer = (
            db.query(models.Officer)
            .filter(models.Officer.officer_id == "SH-001")
            .first()
        )
        if not officer:
            fail("SH-001 is not present in this database")
        if officer.status != "Active":
            fail(f"SH-001 status is {officer.status}, not Active")
        ok(f"SH-001 found: {officer.name} / {officer.system_role}")
        ok(f"Authenticator MFA enabled: {bool(officer.mfa_enabled)}")

        print(f"[INFO] Cases: {db.query(models.Case).count()}")
        print(f"[INFO] Persons: {db.query(models.Person).count()}")
        print(f"[INFO] Evidence: {db.query(models.Evidence).count()}")
        print("[READY] Website and mobile can use this same central database.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
