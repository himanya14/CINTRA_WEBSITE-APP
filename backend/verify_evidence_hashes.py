from sqlalchemy import text

from app.database import engine

from app.services.evidence_hash_service import (
    calculate_file_sha256
)


def main():

    print()
    print(
        "CINTRA Evidence Integrity Verification"
    )

    print(
        "======================================"
    )

    print()

    with engine.connect() as connection:

        evidence_rows = (
            connection.execute(
                text(
                    """
                    SELECT
                        id,
                        evidence_id,
                        title,
                        file_path,
                        sha256_hash
                    FROM evidence
                    ORDER BY id
                    """
                )
            )
            .mappings()
            .all()
        )

    if not evidence_rows:

        print(
            "No evidence records found."
        )

        return

    verified = 0
    mismatched = 0
    unavailable = 0

    for evidence in evidence_rows:

        evidence_id = (
            evidence[
                "evidence_id"
            ]
        )

        stored_hash = (
            evidence[
                "sha256_hash"
            ]
        )

        file_path = (
            evidence[
                "file_path"
            ]
        )

        print(
            f"{evidence_id}"
        )

        print(
            f"Title: {evidence['title']}"
        )

        if not stored_hash:

            unavailable += 1

            print(
                "Result: NO STORED HASH"
            )

            print()

            continue

        current_hash = (
            calculate_file_sha256(
                file_path
            )
        )

        if not current_hash:

            unavailable += 1

            print(
                "Result: FILE NOT AVAILABLE"
            )

            print(
                f"Path: {file_path}"
            )

            print()

            continue

        print(
            f"Stored : {stored_hash}"
        )

        print(
            f"Current: {current_hash}"
        )

        if (
            stored_hash.lower()
            ==
            current_hash.lower()
        ):

            verified += 1

            print(
                "Result: INTEGRITY VERIFIED"
            )

        else:

            mismatched += 1

            print(
                "Result: INTEGRITY MISMATCH"
            )

        print(
            "---------------------------------------"
        )

    print()

    print(
        "Verification summary"
    )

    print(
        "--------------------"
    )

    print(
        f"Verified    : {verified}"
    )

    print(
        f"Mismatched  : {mismatched}"
    )

    print(
        f"Unavailable : {unavailable}"
    )


if __name__ == "__main__":
    main()