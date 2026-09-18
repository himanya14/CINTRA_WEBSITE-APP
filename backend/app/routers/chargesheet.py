from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.utils.security import get_current_officer
from app.services.chargesheet_service import (
    build_chargesheet_document,
    generate_chargesheet_pdf,
)


router = APIRouter(prefix="/chargesheets", tags=["Chargesheets"])


def _case_or_404(db: Session, case_id: int):
    case = db.query(models.Case).filter(models.Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case


def _latest_chargesheet(db: Session, case_id: int):
    return (
        db.query(models.Chargesheet)
        .filter(models.Chargesheet.case_id == case_id)
        .order_by(models.Chargesheet.prepared_at.desc(), models.Chargesheet.id.desc())
        .first()
    )


@router.post("/", response_model=schemas.ChargesheetResponse)
def create_chargesheet(
    chargesheet: schemas.ChargesheetCreate,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer),
):
    _case_or_404(db, chargesheet.case_id)

    if (
        db.query(models.Chargesheet)
        .filter(models.Chargesheet.chargesheet_id == chargesheet.chargesheet_id)
        .first()
    ):
        raise HTTPException(status_code=400, detail="Chargesheet ID already exists")

    data = chargesheet.model_dump()
    data["prepared_by"] = current_officer.officer_id
    row = models.Chargesheet(**data)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.post("/case/{case_id}/prepare", response_model=schemas.ChargesheetResponse)
def prepare_chargesheet_from_case(
    case_id: int,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer),
):
    """Create a draft shell only when one does not already exist.

    Case facts, persons, evidence, legal sections and chronology are NOT copied
    into text fields. The document endpoint reads them live from normalized
    database tables, avoiding stale duplicated/hardcoded data.
    """
    case = _case_or_404(db, case_id)
    existing = _latest_chargesheet(db, case_id)
    if existing:
        return existing

    base_id = f"CS-{case.case_id}-{datetime.utcnow().strftime('%Y%m%d')}"
    candidate = base_id
    suffix = 2
    while (
        db.query(models.Chargesheet)
        .filter(models.Chargesheet.chargesheet_id == candidate)
        .first()
    ):
        candidate = f"{base_id}-{suffix}"
        suffix += 1

    row = models.Chargesheet(
        chargesheet_id=candidate,
        case_id=case_id,
        prepared_by=current_officer.officer_id,
        filing_status="Draft",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/", response_model=List[schemas.ChargesheetResponse])
def get_chargesheets(
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer),
):
    return (
        db.query(models.Chargesheet)
        .order_by(models.Chargesheet.prepared_at.desc(), models.Chargesheet.id.desc())
        .all()
    )


@router.get("/case/{case_id}", response_model=List[schemas.ChargesheetResponse])
def get_chargesheets_by_case(
    case_id: int,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer),
):
    _case_or_404(db, case_id)
    return (
        db.query(models.Chargesheet)
        .filter(models.Chargesheet.case_id == case_id)
        .order_by(models.Chargesheet.prepared_at.desc(), models.Chargesheet.id.desc())
        .all()
    )


@router.get("/case/{case_id}/document")
def get_chargesheet_document(
    case_id: int,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer),
):
    """Return the complete live chargesheet view from cintra_db.

    Includes:
    - case summary
    - accused / persons involved
    - evidence + SHA/integrity/encryption/custody
    - officer-confirmed legal provisions
    - chronology/timeline
    - prepared officer and filing status
    """
    try:
        return build_chargesheet_document(db, case_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/case/{case_id}/readiness")
def chargesheet_readiness(
    case_id: int,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer),
):
    case = _case_or_404(db, case_id)
    links = db.query(models.CasePerson).filter(models.CasePerson.case_id == case_id).all()
    evidence = db.query(models.Evidence).filter(models.Evidence.case_id == case_id).all()
    confirmed_legal_count = (
        db.query(models.CaseLegalSection)
        .filter(
            models.CaseLegalSection.case_id == case_id,
            func.lower(models.CaseLegalSection.status) == "confirmed",
        )
        .count()
    )
    pending_legal_count = (
        db.query(models.CaseLegalSection)
        .filter(
            models.CaseLegalSection.case_id == case_id,
            func.lower(models.CaseLegalSection.status) == "candidate",
        )
        .count()
    )
    chronology_count = (
        db.query(models.TimelineEvent)
        .filter(models.TimelineEvent.case_id == case_id)
        .count()
    )
    chargesheet = _latest_chargesheet(db, case_id)

    accused = [
        link
        for link in links
        if any(
            token in str(link.role_in_case or "").lower()
            for token in ("accused", "suspect")
        )
    ]

    checks = [
        {
            "key": "case",
            "label": "Case information",
            "complete": bool(case.case_id and case.fir_number and case.title and case.offence),
        },
        {
            "key": "accused",
            "label": "Accused / suspect details",
            "complete": bool(accused),
        },
        {
            "key": "evidence",
            "label": "Evidence relied upon",
            "complete": bool(evidence),
        },
        {
            "key": "legal",
            "label": "Confirmed legal provisions",
            "complete": confirmed_legal_count > 0,
        },
        {
            "key": "legal_review",
            "label": "Potential legal provisions reviewed",
            "complete": pending_legal_count == 0,
        },
        {
            "key": "chronology",
            "label": "Investigation chronology",
            "complete": chronology_count > 0,
        },
        {
            "key": "summary",
            "label": "Investigation summary",
            "complete": bool(chargesheet and chargesheet.investigation_summary),
        },
        {
            "key": "conclusion",
            "label": "Investigation conclusion",
            "complete": bool(chargesheet and chargesheet.conclusion),
        },
    ]

    complete = sum(1 for item in checks if item["complete"])
    return {
        "case_id": case_id,
        "checks": checks,
        "complete": complete,
        "total": len(checks),
        "ready": complete == len(checks),
        "attention_required": len(checks) - complete,
        "confirmed_legal_provisions": confirmed_legal_count,
        "pending_legal_provisions": pending_legal_count,
        "chronology_events": chronology_count,
    }


@router.post("/{chargesheet_id}/generate-pdf", response_model=schemas.ChargesheetResponse)
def generate_pdf(
    chargesheet_id: int,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer),
):
    chargesheet = (
        db.query(models.Chargesheet)
        .filter(models.Chargesheet.id == chargesheet_id)
        .first()
    )
    if not chargesheet:
        raise HTTPException(status_code=404, detail="Chargesheet not found")

    document_data = build_chargesheet_document(db, chargesheet.case_id)
    try:
        file_path = generate_chargesheet_pdf(document_data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    chargesheet.generated_pdf_path = file_path
    db.commit()
    db.refresh(chargesheet)
    return chargesheet


@router.get("/{chargesheet_id}", response_model=schemas.ChargesheetResponse)
def get_chargesheet(
    chargesheet_id: int,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer),
):
    row = (
        db.query(models.Chargesheet)
        .filter(models.Chargesheet.id == chargesheet_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Chargesheet not found")
    return row


@router.put("/{chargesheet_id}", response_model=schemas.ChargesheetResponse)
def update_chargesheet(
    chargesheet_id: int,
    chargesheet_data: schemas.ChargesheetUpdate,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer),
):
    row = (
        db.query(models.Chargesheet)
        .filter(models.Chargesheet.id == chargesheet_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Chargesheet not found")

    update_data = chargesheet_data.model_dump(exclude_unset=True)
    update_data.pop("prepared_by", None)
    for key, value in update_data.items():
        setattr(row, key, value)

    db.commit()
    db.refresh(row)
    return row
