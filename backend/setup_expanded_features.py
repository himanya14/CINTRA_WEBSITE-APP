"""CINTRA expanded feature setup.

Run once after pulling the updated source:
    python setup_expanded_features.py

The script creates only new tables/indexes through SQLAlchemy metadata and seeds
safe reference data. It does not delete or replace existing CINTRA records.
"""
from app.database import Base, engine, SessionLocal
from app import models
from app.routers.legal import ensure_seed as ensure_legal_seed
from app.routers.master_data import ensure_defaults as ensure_master_defaults
from app.routers.cross_case import bootstrap_existing_identifiers


def main():
    print("CINTRA Expanded Website Feature Setup")
    print("=====================================")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        ensure_legal_seed(db)
        ensure_master_defaults(db)
        bootstrap_existing_identifiers(db)
        print("Legal frameworks and legal section reference tables ready.")
        print("Master data categories ready.")
        print("Cross-case normalized identifier index ready.")
        print("Timeline, custody, provenance and intelligence lead tables ready.")
        print("Existing evidence and forensic integrity records were not modified.")
    finally:
        db.close()
    print("\nSetup complete.")


if __name__ == "__main__":
    main()
