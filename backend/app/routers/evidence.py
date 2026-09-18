from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    File,
    Form
)
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app import crud, schemas, models
from app.utils.security import get_current_officer
from app.services.file_service import save_evidence_file


router = APIRouter(
    prefix="/evidence",
    tags=["Evidence"]
)


# ---------- CREATE EVIDENCE WITHOUT FILE ----------

@router.post(
    "/",
    response_model=schemas.EvidenceResponse
)
def create_evidence(
    evidence: schemas.EvidenceCreate,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer)
):
    case = db.query(
        models.Case
    ).filter(
        models.Case.id == evidence.case_id
    ).first()

    if not case:
        raise HTTPException(
            status_code=404,
            detail="Case not found"
        )

    existing_evidence = db.query(
        models.Evidence
    ).filter(
        models.Evidence.evidence_id
        == evidence.evidence_id
    ).first()

    if existing_evidence:
        raise HTTPException(
            status_code=400,
            detail="Evidence ID already exists"
        )

    evidence_data = evidence.model_dump()

    new_evidence = models.Evidence(
        **evidence_data,
        collected_by=current_officer.officer_id
    )

    db.add(new_evidence)
    db.commit()
    db.refresh(new_evidence)

    return new_evidence


# ---------- CREATE EVIDENCE WITH FILE ----------

@router.post(
    "/upload",
    response_model=schemas.EvidenceResponse
)
def upload_evidence(
    evidence_id: str = Form(...),
    case_id: int = Form(...),
    title: str = Form(...),
    evidence_type: str = Form(...),
    file: UploadFile = File(...),
    description: Optional[str] = Form(None),
    source: Optional[str] = Form(None),
    collected_at: Optional[datetime] = Form(None),
    status: str = Form("Collected"),
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer)
):
    case = db.query(
        models.Case
    ).filter(
        models.Case.id == case_id
    ).first()

    if not case:
        raise HTTPException(
            status_code=404,
            detail="Case not found"
        )

    existing_evidence = db.query(
        models.Evidence
    ).filter(
        models.Evidence.evidence_id
        == evidence_id
    ).first()

    if existing_evidence:
        raise HTTPException(
            status_code=400,
            detail="Evidence ID already exists"
        )

    file_path = save_evidence_file(file)

    new_evidence = models.Evidence(
        evidence_id=evidence_id,
        case_id=case_id,
        title=title,
        evidence_type=evidence_type,
        description=description,
        file_path=file_path,
        source=source,
        collected_by=current_officer.officer_id,
        collected_at=collected_at,
        status=status
    )

    db.add(new_evidence)
    db.commit()
    db.refresh(new_evidence)

    return new_evidence


# ---------- UPLOAD FILE TO EXISTING EVIDENCE ----------

@router.post(
    "/{evidence_id}/upload-file",
    response_model=schemas.EvidenceResponse
)
def upload_file_to_existing_evidence(
    evidence_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer)
):
    evidence = db.query(
        models.Evidence
    ).filter(
        models.Evidence.id == evidence_id
    ).first()

    if not evidence:
        raise HTTPException(
            status_code=404,
            detail="Evidence not found"
        )

    file_path = save_evidence_file(file)

    evidence.file_path = file_path

    db.commit()
    db.refresh(evidence)

    return evidence


# ---------- GET ALL EVIDENCE ----------

@router.get(
    "/",
    response_model=List[schemas.EvidenceResponse]
)
def get_all_evidence(
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer)
):
    return crud.get_all_evidence(db)


# ---------- GET EVIDENCE BY CASE ----------

@router.get(
    "/case/{case_id}",
    response_model=List[schemas.EvidenceResponse]
)
def get_evidence_by_case(
    case_id: int,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer)
):
    case = db.query(
        models.Case
    ).filter(
        models.Case.id == case_id
    ).first()

    if not case:
        raise HTTPException(
            status_code=404,
            detail="Case not found"
        )

    return crud.get_evidence_by_case(
        db,
        case_id
    )


# ---------- GET ONE EVIDENCE ITEM ----------

@router.get(
    "/{evidence_id}",
    response_model=schemas.EvidenceResponse
)
def get_evidence(
    evidence_id: int,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer)
):
    evidence = crud.get_evidence_by_id(
        db,
        evidence_id
    )

    if not evidence:
        raise HTTPException(
            status_code=404,
            detail="Evidence not found"
        )

    return evidence
# ============================================================
# SECURE EVIDENCE CONTENT / SECURITY STATUS
# ============================================================

@router.get("/by-code/{evidence_code}/content/{original_filename}")
def get_secure_evidence_content(
    evidence_code: str,
    original_filename: str,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer),
):
    """Decrypt an AES-256-GCM evidence artifact only for an authenticated officer."""
    from fastapi.responses import Response
    from app.services.secure_evidence_service import decrypt_evidence_file

    evidence = (
        db.query(models.Evidence)
        .filter(models.Evidence.evidence_id == evidence_code)
        .first()
    )
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")

    security = (
        db.query(models.EvidenceSecurity)
        .filter(models.EvidenceSecurity.evidence_db_id == evidence.id)
        .first()
    )
    if not security:
        raise HTTPException(status_code=404, detail="Secure evidence artifact not found")

    try:
        data = decrypt_evidence_file(security.encrypted_path, evidence.evidence_id)
    except Exception:
        raise HTTPException(status_code=500, detail="Unable to decrypt evidence artifact")

    headers = {
        "Content-Disposition": f'inline; filename="{security.original_filename}"',
        "X-CINTRA-SHA256": security.original_sha256,
        "X-CINTRA-Encryption": security.encryption_algorithm,
    }
    return Response(
        content=data,
        media_type=security.mime_type or "application/octet-stream",
        headers=headers,
    )


@router.get("/{evidence_db_id}/security")
def get_evidence_security_status(
    evidence_db_id: int,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer),
):
    from app.services.secure_evidence_service import verify_encrypted_evidence

    evidence = db.query(models.Evidence).filter(models.Evidence.id == evidence_db_id).first()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")

    security = (
        db.query(models.EvidenceSecurity)
        .filter(models.EvidenceSecurity.evidence_db_id == evidence.id)
        .first()
    )
    ledger = None
    custody = (
        db.query(models.ChainOfCustodyEvent)
        .filter(models.ChainOfCustodyEvent.evidence_id == evidence.id)
        .order_by(models.ChainOfCustodyEvent.recorded_at.asc(), models.ChainOfCustodyEvent.id.asc())
        .first()
    )
    if custody:
        ledger = (
            db.query(models.CustodyLedgerReceipt)
            .filter(models.CustodyLedgerReceipt.custody_event_id == custody.id)
            .first()
        )

    if not security:
        return {
            "evidence_id": evidence.evidence_id,
            "sha256": evidence.sha256_hash,
            "encryption": "LEGACY_PLAINTEXT_RECORD",
            "integrity_status": "HASH_BASELINE_ONLY" if evidence.sha256_hash else "NOT_AVAILABLE",
            "blockchain_status": ledger.blockchain_status if ledger else "NOT_RECORDED",
            "blockchain_tx_id": ledger.blockchain_tx_id if ledger else None,
        }

    verified = verify_encrypted_evidence(
        security.encrypted_path,
        evidence.evidence_id,
        security.original_sha256,
    )
    current_status = "VERIFIED" if verified else "MISMATCH"
    if security.integrity_status != current_status:
        security.integrity_status = current_status
        db.commit()

    return {
        "evidence_id": evidence.evidence_id,
        "sha256": security.original_sha256,
        "encryption": security.encryption_algorithm,
        "integrity_status": current_status,
        "size_bytes": security.size_bytes,
        "original_filename": security.original_filename,
        "blockchain_status": ledger.blockchain_status if ledger else "NOT_RECORDED",
        "blockchain_tx_id": ledger.blockchain_tx_id if ledger else None,
        "blockchain_error": ledger.gateway_error if ledger else None,
    }
