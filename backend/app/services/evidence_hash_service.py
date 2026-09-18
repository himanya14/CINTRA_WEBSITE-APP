from pathlib import Path
import hashlib


def resolve_evidence_file_path(
    file_path
):
    """
    Convert the file_path stored in PostgreSQL
    into the actual evidence file on disk.

    Supports:
    - absolute Windows paths
    - /uploads/evidence/file.pdf
    - uploads/evidence/file.pdf
    """

    if not file_path:
        return None

    raw = str(file_path).strip()

    if not raw:
        return None

    direct_path = Path(raw)

    if (
        direct_path.is_absolute()
        and direct_path.exists()
    ):
        return direct_path

    normalized = raw.replace(
        "\\",
        "/"
    )

    if (
        "/uploads/"
        in normalized.lower()
    ):

        lower_value = (
            normalized.lower()
        )

        uploads_index = (
            lower_value.index(
                "/uploads/"
            )
        )

        relative_path = (
            normalized[
                uploads_index + 1:
            ]
        )

    else:

        relative_path = (
            normalized.lstrip("/")
        )

    # Current file:
    # backend/app/services/evidence_hash_service.py
    #
    # parents:
    # services -> app -> backend
    backend_root = (
        Path(__file__)
        .resolve()
        .parent
        .parent
        .parent
    )

    candidate = (
        backend_root /
        relative_path
    )

    if candidate.exists():
        return candidate

    return None


def calculate_file_sha256(
    file_path
):
    """
    Calculate SHA-256 from actual file bytes.
    """

    resolved_path = (
        resolve_evidence_file_path(
            file_path
        )
    )

    if resolved_path is None:
        return None

    digest = hashlib.sha256()

    with resolved_path.open(
        "rb"
    ) as evidence_file:

        while True:

            chunk = (
                evidence_file.read(
                    1024 * 1024
                )
            )

            if not chunk:
                break

            digest.update(
                chunk
            )

    return digest.hexdigest()