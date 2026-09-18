from datetime import datetime
from pathlib import Path
from uuid import uuid4

import hashlib

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status
)
from sqlalchemy import text
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.utils.security import get_current_officer
from app.services.secure_evidence_service import decrypt_evidence_file
from app.services.fabric_service import record_custody_event


router = APIRouter(
    prefix="/forensics",
    tags=["Forensic Integrity"]
)


# ============================================================
# CONFIGURATION
# ============================================================

BACKEND_ROOT = (
    Path(__file__)
    .resolve()
    .parent
    .parent
    .parent
)

FORENSIC_ARTIFACT_DIRECTORY = (
    BACKEND_ROOT
    / "uploads"
    / "forensic_artifacts"
)

FORENSIC_ARTIFACT_DIRECTORY.mkdir(
    parents=True,
    exist_ok=True
)


ALLOWED_ARTIFACT_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".pdf",
    ".mp4",
    ".mov",
    ".avi",
    ".mp3",
    ".wav",
    ".csv",
    ".json",
    ".txt",
}


# ============================================================
# AUTH HELPERS
# ============================================================

def get_officer_id(
    current_officer
):
    if isinstance(
        current_officer,
        dict
    ):
        officer_id = (
            current_officer.get(
                "officer_id"
            )
            or current_officer.get(
                "sub"
            )
        )
    else:
        officer_id = getattr(
            current_officer,
            "officer_id",
            None
        )

    if not officer_id:
        raise HTTPException(
            status_code=401,
            detail=(
                "Unable to identify "
                "authenticated officer"
            )
        )

    return officer_id


def get_officer_role(
    current_officer
):
    if isinstance(
        current_officer,
        dict
    ):
        return (
            current_officer.get(
                "system_role"
            )
            or current_officer.get(
                "role"
            )
        )

    return getattr(
        current_officer,
        "system_role",
        None
    )


def require_forensic_analyst(
    current_officer
):
    role = get_officer_role(
        current_officer
    )

    if role != "FORENSIC_ANALYST":
        raise HTTPException(
            status_code=403,
            detail=(
                "This action is available "
                "only to forensic analysts"
            )
        )


# ============================================================
# ASSIGNMENT CHECK
# ============================================================

def require_assigned_case(
    *,
    case_id: int,
    officer_id: str,
    db: Session
):
    assignment = (
        db.query(
            models.ForensicAssignment
        )
        .filter(
            models.ForensicAssignment.case_id
            == case_id,
            models.ForensicAssignment.assigned_to
            == officer_id
        )
        .first()
    )

    if not assignment:
        raise HTTPException(
            status_code=403,
            detail=(
                "This case is not assigned "
                "to you"
            )
        )

    return assignment


def get_assigned_evidence(
    *,
    evidence_id: int,
    officer_id: str,
    db: Session
):
    evidence = (
        db.query(
            models.Evidence
        )
        .filter(
            models.Evidence.id
            == evidence_id
        )
        .first()
    )

    if not evidence:
        raise HTTPException(
            status_code=404,
            detail="Evidence not found"
        )

    require_assigned_case(
        case_id=evidence.case_id,
        officer_id=officer_id,
        db=db
    )

    return evidence


# ============================================================
# FILE HELPERS
# ============================================================

def resolve_evidence_path(
    file_path
):
    if not file_path:
        return None

    raw = str(
        file_path
    ).strip()

    if not raw:
        return None

    direct_path = Path(
        raw
    )

    if (
        direct_path.is_absolute()
        and direct_path.exists()
    ):
        return direct_path

    normalized = raw.replace(
        "\\",
        "/"
    )

    lower_value = (
        normalized.lower()
    )

    uploads_marker = "/uploads/"

    if (
        uploads_marker
        in lower_value
    ):
        index = (
            lower_value.index(
                uploads_marker
            )
        )

        relative_path = (
            normalized[
                index + 1:
            ]
        )

    else:
        relative_path = (
            normalized.lstrip(
                "/"
            )
        )

    candidate = (
        BACKEND_ROOT
        / relative_path
    )

    if candidate.exists():
        return candidate

    return None


def calculate_file_sha256(
    file_path: Path
):
    digest = hashlib.sha256()

    with file_path.open(
        "rb"
    ) as source_file:

        while True:
            chunk = (
                source_file.read(
                    1024 * 1024
                )
            )

            if not chunk:
                break

            digest.update(
                chunk
            )

    return digest.hexdigest()


# ============================================================
# 1. VERIFY EVIDENCE INTEGRITY
# ============================================================

@router.post(
    "/evidence/{evidence_id}/verify-integrity"
)
def verify_evidence_integrity(
    evidence_id: int,
    db: Session = Depends(
        get_db
    ),
    current_officer=Depends(
        get_current_officer
    )
):
    require_forensic_analyst(
        current_officer
    )

    officer_id = get_officer_id(
        current_officer
    )

    evidence = (
        get_assigned_evidence(
            evidence_id=evidence_id,
            officer_id=officer_id,
            db=db
        )
    )

    # --------------------------------------------------------
    # A BASELINE MUST ALREADY EXIST
    # --------------------------------------------------------

    baseline_hash = (
        evidence.sha256_hash
    )

    if not baseline_hash:
        raise HTTPException(
            status_code=409,
            detail=(
                "This evidence does not have "
                "a stored SHA-256 baseline"
            )
        )

    # --------------------------------------------------------
    # READ CURRENT EVIDENCE BYTES
    # --------------------------------------------------------

    # Mobile field evidence is stored AES-256-GCM encrypted. Legacy website
    # evidence may still be stored as a normal upload. Hash the original bytes
    # in both cases so the baseline comparison has the same meaning.
    security_record = (
        db.query(models.EvidenceSecurity)
        .filter(models.EvidenceSecurity.evidence_db_id == evidence.id)
        .first()
    )

    if security_record:
        try:
            current_bytes = decrypt_evidence_file(
                security_record.encrypted_path,
                evidence.evidence_id,
            )
        except Exception as exc:
            raise HTTPException(
                status_code=409,
                detail=f"Encrypted evidence could not be authenticated/decrypted: {exc}",
            )
        current_hash = hashlib.sha256(current_bytes).hexdigest()
        file_size = len(current_bytes)
    else:
        resolved_path = resolve_evidence_path(evidence.file_path)
        if not resolved_path:
            raise HTTPException(
                status_code=404,
                detail="Evidence file is not available on the server",
            )
        current_hash = calculate_file_sha256(resolved_path)
        file_size = resolved_path.stat().st_size

    baseline_normalized = (
        str(
            baseline_hash
        )
        .strip()
        .lower()
    )

    current_normalized = (
        str(
            current_hash
        )
        .strip()
        .lower()
    )

    verified = (
        baseline_normalized
        == current_normalized
    )

    integrity_status = (
        "VERIFIED"
        if verified
        else "MISMATCH"
    )

    # --------------------------------------------------------
    # SAVE CHECK HISTORY
    # --------------------------------------------------------

    inserted = db.execute(
        text(
            """
            INSERT INTO
            evidence_integrity_checks
            (
                evidence_id,
                baseline_hash,
                calculated_hash,
                status,
                verified_by,
                verified_at
            )
            VALUES
            (
                :evidence_id,
                :baseline_hash,
                :calculated_hash,
                :status,
                :verified_by,
                CURRENT_TIMESTAMP
            )
            RETURNING
                id,
                verified_at
            """
        ),
        {
            "evidence_id":
                evidence.id,

            "baseline_hash":
                baseline_normalized,

            "calculated_hash":
                current_normalized,

            "status":
                integrity_status,

            "verified_by":
                officer_id,
        }
    ).mappings().first()

    # Keep the secure-evidence status in sync with the verification result.
    if security_record:
        security_record.integrity_status = integrity_status

    # A successful/failed integrity check is itself a custody event.
    custody = models.ChainOfCustodyEvent(
        evidence_id=evidence.id,
        action="VERIFIED" if verified else "INTEGRITY_MISMATCH",
        from_officer=officer_id,
        to_officer=officer_id,
        location="CINTRA Forensic Integrity Service",
        notes=f"SHA-256 integrity check result: {integrity_status}",
        recorded_by=officer_id,
    )
    db.add(custody)
    db.flush()

    ledger = record_custody_event(
        evidence_id=evidence.evidence_id,
        event_id=str(custody.id),
        action=custody.action,
        actor_officer_id=officer_id,
        from_custodian=officer_id,
        to_custodian=officer_id,
        reason=custody.notes,
        file_sha256=current_normalized,
        timestamp=datetime.utcnow().isoformat() + "Z",
    )
    db.add(
        models.CustodyLedgerReceipt(
            custody_event_id=custody.id,
            evidence_db_id=evidence.id,
            blockchain_status=ledger["blockchain_status"],
            blockchain_tx_id=ledger.get("transaction_id"),
            gateway_error=ledger.get("error"),
        )
    )

    # --------------------------------------------------------
    # AUDIT LOG
    # --------------------------------------------------------

    audit = models.AuditLog(
        officer_id=officer_id,
        action=(
            "EVIDENCE_INTEGRITY_VERIFIED"
            if verified
            else
            "EVIDENCE_INTEGRITY_MISMATCH"
        ),
        resource_type="EVIDENCE",
        resource_id=str(
            evidence.id
        ),
        description=(
            f"SHA-256 integrity check "
            f"for {evidence.evidence_id}: "
            f"{integrity_status}"
        ),
        success=True
    )

    db.add(
        audit
    )

    db.commit()

    return {
        "check_id":
            inserted["id"],

        "evidence_database_id":
            evidence.id,

        "evidence_id":
            evidence.evidence_id,

        "case_id":
            evidence.case_id,

        "title":
            evidence.title,

        "baseline_hash":
            baseline_normalized,

        "current_hash":
            current_normalized,

        "status":
            integrity_status,

        "integrity_verified":
            verified,

        "verified_by":
            officer_id,

        "verified_at":
            inserted[
                "verified_at"
            ],

        "file_size":
            file_size,

        "encryption":
            security_record.encryption_algorithm if security_record else "LEGACY_PLAINTEXT_RECORD",

        "blockchain_status":
            ledger["blockchain_status"],

        "blockchain_tx_id":
            ledger.get("transaction_id"),
    }


# ============================================================
# 2. GET VERIFICATION HISTORY
# ============================================================

@router.get(
    "/evidence/{evidence_id}/integrity-history"
)
def get_integrity_history(
    evidence_id: int,
    db: Session = Depends(
        get_db
    ),
    current_officer=Depends(
        get_current_officer
    )
):
    require_forensic_analyst(
        current_officer
    )

    officer_id = get_officer_id(
        current_officer
    )

    evidence = (
        get_assigned_evidence(
            evidence_id=evidence_id,
            officer_id=officer_id,
            db=db
        )
    )

    rows = db.execute(
        text(
            """
            SELECT
                id,
                evidence_id,
                baseline_hash,
                calculated_hash,
                status,
                verified_by,
                verified_at
            FROM
                evidence_integrity_checks
            WHERE
                evidence_id =
                :evidence_id
            ORDER BY
                verified_at DESC,
                id DESC
            """
        ),
        {
            "evidence_id":
                evidence.id
        }
    ).mappings().all()

    return [
        dict(
            row
        )
        for row in rows
    ]


# ============================================================
# 3. UPLOAD FORENSIC ARTIFACT
# ============================================================

@router.post(
    "/artifacts",
    status_code=status.HTTP_201_CREATED
)
async def create_forensic_artifact(
    case_id: int = Form(...),

    source_evidence_id: int | None = Form(
        None
    ),

    title: str = Form(...),

    artifact_type: str = Form(...),

    description: str | None = Form(
        None
    ),

    file: UploadFile = File(...),

    db: Session = Depends(
        get_db
    ),

    current_officer=Depends(
        get_current_officer
    )
):
    require_forensic_analyst(
        current_officer
    )

    officer_id = get_officer_id(
        current_officer
    )

    require_assigned_case(
        case_id=case_id,
        officer_id=officer_id,
        db=db
    )

    # --------------------------------------------------------
    # OPTIONAL SOURCE EVIDENCE
    # --------------------------------------------------------

    source_evidence = None

    if (
        source_evidence_id
        is not None
    ):
        source_evidence = (
            get_assigned_evidence(
                evidence_id=
                    source_evidence_id,
                officer_id=
                    officer_id,
                db=db
            )
        )

        if (
            source_evidence.case_id
            != case_id
        ):
            raise HTTPException(
                status_code=400,
                detail=(
                    "Source evidence does "
                    "not belong to this case"
                )
            )

    # --------------------------------------------------------
    # VALIDATE FILE
    # --------------------------------------------------------

    original_name = (
        file.filename
        or "artifact"
    )

    extension = (
        Path(
            original_name
        )
        .suffix
        .lower()
    )

    if (
        extension
        not in
        ALLOWED_ARTIFACT_EXTENSIONS
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported forensic "
                "artifact file type"
            )
        )

    # --------------------------------------------------------
    # GENERATE IDS
    # --------------------------------------------------------

    artifact_id = (
        "ART-"
        + datetime.utcnow()
        .strftime(
            "%Y%m%d%H%M%S"
        )
        + "-"
        + uuid4().hex[:6].upper()
    )

    stored_filename = (
        uuid4().hex
        + extension
    )

    destination = (
        FORENSIC_ARTIFACT_DIRECTORY
        / stored_filename
    )

    # --------------------------------------------------------
    # SAVE FILE
    # --------------------------------------------------------

    digest = hashlib.sha256()

    total_size = 0

    with destination.open(
        "wb"
    ) as destination_file:

        while True:

            chunk = await file.read(
                1024 * 1024
            )

            if not chunk:
                break

            destination_file.write(
                chunk
            )

            digest.update(
                chunk
            )

            total_size += len(
                chunk
            )

    await file.close()

    if total_size == 0:
        destination.unlink(
            missing_ok=True
        )

        raise HTTPException(
            status_code=400,
            detail=(
                "Uploaded forensic artifact "
                "is empty"
            )
        )

    sha256_hash = (
        digest.hexdigest()
    )

    stored_path = (
        "/uploads/forensic_artifacts/"
        + stored_filename
    )

    # --------------------------------------------------------
    # SAVE RECORD
    # --------------------------------------------------------

    try:
        row = db.execute(
            text(
                """
                INSERT INTO
                forensic_artifacts
                (
                    artifact_id,
                    case_id,
                    source_evidence_id,
                    title,
                    artifact_type,
                    description,
                    file_path,
                    sha256_hash,
                    created_by,
                    created_at
                )
                VALUES
                (
                    :artifact_id,
                    :case_id,
                    :source_evidence_id,
                    :title,
                    :artifact_type,
                    :description,
                    :file_path,
                    :sha256_hash,
                    :created_by,
                    CURRENT_TIMESTAMP
                )
                RETURNING
                    id,
                    artifact_id,
                    case_id,
                    source_evidence_id,
                    title,
                    artifact_type,
                    description,
                    file_path,
                    sha256_hash,
                    created_by,
                    created_at
                """
            ),
            {
                "artifact_id":
                    artifact_id,

                "case_id":
                    case_id,

                "source_evidence_id":
                    source_evidence_id,

                "title":
                    title.strip(),

                "artifact_type":
                    artifact_type.strip(),

                "description":
                    (
                        description.strip()
                        if description
                        else None
                    ),

                "file_path":
                    stored_path,

                "sha256_hash":
                    sha256_hash,

                "created_by":
                    officer_id,
            }
        ).mappings().first()

        audit = models.AuditLog(
            officer_id=officer_id,
            action="FORENSIC_ARTIFACT_CREATED",
            resource_type="FORENSIC_ARTIFACT",
            resource_id=artifact_id,
            description=(
                f"Created forensic artifact "
                f"{artifact_id} for case "
                f"{case_id}"
            ),
            success=True
        )

        db.add(
            audit
        )

        db.commit()

        result = dict(
            row
        )

        result[
            "original_filename"
        ] = original_name

        result[
            "file_size"
        ] = total_size

        return result

    except Exception:

        db.rollback()

        destination.unlink(
            missing_ok=True
        )

        raise


# ============================================================
# 4. GET ARTIFACTS FOR AN ASSIGNED CASE
# ============================================================

@router.get(
    "/cases/{case_id}/artifacts"
)
def get_forensic_artifacts(
    case_id: int,
    db: Session = Depends(
        get_db
    ),
    current_officer=Depends(
        get_current_officer
    )
):
    require_forensic_analyst(
        current_officer
    )

    officer_id = get_officer_id(
        current_officer
    )

    require_assigned_case(
        case_id=case_id,
        officer_id=officer_id,
        db=db
    )

    rows = db.execute(
        text(
            """
            SELECT
                id,
                artifact_id,
                case_id,
                source_evidence_id,
                title,
                artifact_type,
                description,
                file_path,
                sha256_hash,
                created_by,
                created_at
            FROM
                forensic_artifacts
            WHERE
                case_id = :case_id
            ORDER BY
                created_at DESC,
                id DESC
            """
        ),
        {
            "case_id":
                case_id
        }
    ).mappings().all()

    return [
        dict(
            row
        )
        for row in rows
    ]