from pathlib import Path
import hashlib

from sqlalchemy import text
from sqlalchemy.orm import sessionmaker

from app.database import engine
from app import models


def resolve_evidence_file_path(file_path):
    if not file_path:
        return None

    raw = str(file_path).strip()

    if not raw:
        return None

    # Works when DB already stores a full Windows path.
    direct_path = Path(raw)

    if direct_path.is_absolute() and direct_path.exists():
        return direct_path

    # Convert Windows slash style for further checks.
    normalized = raw.replace("\\", "/")

    # Example:
    # /uploads/evidence/abc.pdf
    if "/uploads/" in normalized.lower():
        lower_value = normalized.lower()

        uploads_index = lower_value.index(
            "/uploads/"
        )

        relative_path = normalized[
            uploads_index + 1:
        ]

    else:
        relative_path = normalized.lstrip("/")

    # This script lives in:
    # backend/backfill_evidence_hashes.py
    backend_root = Path(
        __file__
    ).resolve().parent

    candidate = (
        backend_root /
        relative_path
    )

    if candidate.exists():
        return candidate

    return None


def calculate_sha256(file_path):
    digest = hashlib.sha256()

    with file_path.open("rb") as evidence_file:

        while True:
            chunk = evidence_file.read(
                1024 * 1024
            )

            if not chunk:
                break

            digest.update(chunk)

    return digest.hexdigest()


def ensure_hash_column():
    print(
        "Checking evidence.sha256_hash column..."
    )

    with engine.begin() as connection:

        connection.execute(
            text(
                """
                ALTER TABLE evidence
                ADD COLUMN IF NOT EXISTS
                sha256_hash VARCHAR(64)
                """
            )
        )

    print(
        "sha256_hash column ready."
    )


def backfill_existing_hashes():
    SessionLocal = sessionmaker(
        bind=engine,
        autoflush=False,
        autocommit=False
    )

    db = SessionLocal()

    updated = 0
    skipped = 0
    missing = 0

    try:

        # We use raw SQL here because your current
        # SQLAlchemy Evidence model does not yet
        # contain sha256_hash.
        evidence_rows = db.execute(
            text(
                """
                SELECT
                    id,
                    evidence_id,
                    file_path,
                    sha256_hash
                FROM evidence
                ORDER BY id
                """
            )
        ).mappings().all()

        print()
        print(
            f"Found {len(evidence_rows)} evidence record(s)."
        )
        print()

        for evidence in evidence_rows:

            evidence_id = evidence[
                "evidence_id"
            ]

            stored_hash = evidence[
                "sha256_hash"
            ]

            file_path = evidence[
                "file_path"
            ]

            if stored_hash:

                skipped += 1

                print(
                    f"SKIP   {evidence_id}"
                    " — hash already stored"
                )

                continue

            resolved_path = (
                resolve_evidence_file_path(
                    file_path
                )
            )

            if resolved_path is None:

                missing += 1

                print(
                    f"NOFILE {evidence_id}"
                    f" — {file_path}"
                )

                continue

            sha256_hash = calculate_sha256(
                resolved_path
            )

            db.execute(
                text(
                    """
                    UPDATE evidence
                    SET sha256_hash = :sha256_hash
                    WHERE id = :evidence_db_id
                    """
                ),
                {
                    "sha256_hash":
                        sha256_hash,

                    "evidence_db_id":
                        evidence["id"]
                }
            )

            updated += 1

            print(
                f"HASHED  {evidence_id}"
            )

            print(
                f"        {sha256_hash}"
            )

        db.commit()

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()

    print()
    print(
        "-----------------------------------------"
    )

    print(
        "CINTRA evidence hash migration complete"
    )

    print(
        "-----------------------------------------"
    )

    print(
        f"New hashes stored : {updated}"
    )

    print(
        f"Already stored    : {skipped}"
    )

    print(
        f"Files not found   : {missing}"
    )


def main():
    print()
    print(
        "CINTRA Evidence Integrity Migration"
    )

    print(
        "==================================="
    )

    ensure_hash_column()

    backfill_existing_hashes()


if __name__ == "__main__":
    main()