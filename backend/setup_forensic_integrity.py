from sqlalchemy import text

from app.database import engine


def main():
    print()
    print("CINTRA Forensic Integrity Setup")
    print("================================")

    with engine.begin() as connection:

        # ============================================================
        # 1. INTEGRITY VERIFICATION HISTORY
        # ============================================================

        connection.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS evidence_integrity_checks (
                    id SERIAL PRIMARY KEY,

                    evidence_id INTEGER NOT NULL
                        REFERENCES evidence(id)
                        ON DELETE CASCADE,

                    baseline_hash VARCHAR(64) NOT NULL,
                    calculated_hash VARCHAR(64) NOT NULL,

                    status VARCHAR(30) NOT NULL,

                    verified_by VARCHAR(100) NOT NULL,

                    verified_at TIMESTAMP NOT NULL
                        DEFAULT CURRENT_TIMESTAMP
                );
                """
            )
        )

        print(
            "evidence_integrity_checks table ready."
        )

        # ============================================================
        # 2. FORENSIC ARTIFACTS
        # ============================================================

        connection.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS forensic_artifacts (
                    id SERIAL PRIMARY KEY,

                    artifact_id VARCHAR(100)
                        UNIQUE
                        NOT NULL,

                    case_id INTEGER NOT NULL
                        REFERENCES cases(id)
                        ON DELETE CASCADE,

                    source_evidence_id INTEGER
                        REFERENCES evidence(id)
                        ON DELETE SET NULL,

                    title VARCHAR(255) NOT NULL,

                    artifact_type VARCHAR(100)
                        NOT NULL,

                    description TEXT,

                    file_path TEXT NOT NULL,

                    sha256_hash VARCHAR(64)
                        NOT NULL,

                    created_by VARCHAR(100)
                        NOT NULL,

                    created_at TIMESTAMP NOT NULL
                        DEFAULT CURRENT_TIMESTAMP
                );
                """
            )
        )

        print(
            "forensic_artifacts table ready."
        )

        # ============================================================
        # 3. MAKE ORIGINAL EVIDENCE BASELINE IMMUTABLE
        #
        # Even if application code attempts to overwrite sha256_hash,
        # PostgreSQL restores the original non-null value.
        # ============================================================

        connection.execute(
            text(
                """
                CREATE OR REPLACE FUNCTION
                preserve_evidence_baseline_hash()
                RETURNS TRIGGER
                AS $$
                BEGIN

                    IF OLD.sha256_hash IS NOT NULL THEN
                        NEW.sha256_hash :=
                            OLD.sha256_hash;
                    END IF;

                    RETURN NEW;

                END;
                $$
                LANGUAGE plpgsql;
                """
            )
        )

        connection.execute(
            text(
                """
                DROP TRIGGER IF EXISTS
                trg_preserve_evidence_baseline_hash
                ON evidence;
                """
            )
        )

        connection.execute(
            text(
                """
                CREATE TRIGGER
                trg_preserve_evidence_baseline_hash

                BEFORE UPDATE
                ON evidence

                FOR EACH ROW

                EXECUTE FUNCTION
                preserve_evidence_baseline_hash();
                """
            )
        )

        print(
            "Evidence baseline SHA-256 protection ready."
        )

    print()
    print("-----------------------------------------")
    print("CINTRA forensic integrity setup complete")
    print("-----------------------------------------")
    print()
    print(
        "Original evidence hashes are now protected."
    )
    print(
        "Integrity verification history is persistent."
    )
    print(
        "Forensic artifacts have separate storage."
    )
    print()


if __name__ == "__main__":
    main()