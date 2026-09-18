from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.utils.security import get_current_officer
from app.services.legal_mapping_service import (
    ensure_legal_master,
    suggest_legal_provisions,
    review_case_legal_section,
)

router = APIRouter(prefix="/legal", tags=["Legal Codes"])


def _officer_id(current_officer):
    return getattr(current_officer, "officer_id", None) or (
        current_officer.get("officer_id") if isinstance(current_officer, dict) else None
    ) or "SYSTEM"


def _role(current_officer):
    return getattr(current_officer, "system_role", None) or (
        current_officer.get("system_role") if isinstance(current_officer, dict) else None
    ) or (
        current_officer.get("role") if isinstance(current_officer, dict) else None
    )


def _require(current_officer, roles):
    if _role(current_officer) not in roles:
        raise HTTPException(403, "You do not have permission to modify legal data")


@router.get("/frameworks")
def frameworks(db: Session = Depends(get_db), current_officer=Depends(get_current_officer)):
    ensure_legal_master(db)
    db.commit()
    return db.query(models.LegalFramework).order_by(models.LegalFramework.code).all()


@router.get("/sections", response_model=list[schemas.LegalSectionResponse])
def sections(
    q: str = Query(""),
    framework: str | None = None,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer),
):
    ensure_legal_master(db)
    db.commit()
    query = db.query(models.LegalSection).filter(models.LegalSection.active.is_(True))
    if framework:
        query = query.filter(models.LegalSection.framework_code == framework.strip().upper())
    if q.strip():
        p = f"%{q.strip()}%"
        query = query.filter(or_(
            models.LegalSection.section_number.ilike(p),
            models.LegalSection.offence_name.ilike(p),
            models.LegalSection.description.ilike(p),
            models.LegalSection.legacy_reference.ilike(p),
        ))
    return query.order_by(models.LegalSection.framework_code, models.LegalSection.section_number).limit(250).all()


@router.post("/sections", response_model=schemas.LegalSectionResponse)
def create_section(
    payload: schemas.LegalSectionCreate,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer),
):
    _require(current_officer, {"SUPERVISOR", "SYSTEM_ADMIN"})
    record = models.LegalSection(**payload.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def _serialize_case_section(link, section):
    return {
        "id": link.id,
        "legal_section_id": link.legal_section_id,
        "case_id": link.case_id,
        "status": link.status,
        "rationale": link.rationale,
        "added_by": link.added_by,
        "added_at": link.added_at,
        "reviewed_by": link.reviewed_by,
        "reviewed_at": link.reviewed_at,
        "section": {
            "id": section.id,
            "framework_code": section.framework_code,
            "section_number": section.section_number,
            "offence_name": section.offence_name,
            "description": section.description,
            "punishment": section.punishment,
            "bailability": section.bailability,
            "cognizability": section.cognizability,
            "legacy_reference": section.legacy_reference,
            "source_reference": section.source_reference,
        },
    }


@router.get("/cases/{case_id}/sections")
def case_sections(
    case_id: int,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer),
):
    ensure_legal_master(db)
    rows = db.query(models.CaseLegalSection, models.LegalSection).join(
        models.LegalSection,
        models.CaseLegalSection.legal_section_id == models.LegalSection.id,
    ).filter(models.CaseLegalSection.case_id == case_id).order_by(
        models.CaseLegalSection.added_at.desc()
    ).all()
    return [_serialize_case_section(link, section) for link, section in rows]


@router.post("/cases/{case_id}/suggest")
def suggest_case_sections(
    case_id: int,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer),
):
    _require(current_officer, {"INVESTIGATOR", "SUPERVISOR", "SYSTEM_ADMIN"})
    case = db.query(models.Case).filter(models.Case.id == case_id).first()
    if not case:
        raise HTTPException(404, "Case not found")
    created = suggest_legal_provisions(db, case, current_officer, "case title, offence and description")
    db.add(models.AuditLog(
        officer_id=_officer_id(current_officer),
        action="LEGAL_CANDIDATES_GENERATED",
        resource_type="CASE",
        resource_id=str(case_id),
        description=f"Generated {len(created)} potential legal provision(s) for case {case_id}",
        success=True,
    ))
    db.commit()
    return {
        "case_id": case_id,
        "created": len(created),
        "message": "Potential provisions generated. Officer review is required.",
    }


@router.post("/cases/{case_id}/sections", response_model=schemas.CaseLegalSectionResponse)
def add_case_section(
    case_id: int,
    payload: schemas.CaseLegalSectionCreate,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer),
):
    _require(current_officer, {"INVESTIGATOR", "SUPERVISOR", "SYSTEM_ADMIN"})
    if not db.query(models.Case).filter(models.Case.id == case_id).first():
        raise HTTPException(404, "Case not found")
    if not db.query(models.LegalSection).filter(models.LegalSection.id == payload.legal_section_id).first():
        raise HTTPException(404, "Legal section not found")

    existing = db.query(models.CaseLegalSection).filter(
        models.CaseLegalSection.case_id == case_id,
        models.CaseLegalSection.legal_section_id == payload.legal_section_id,
    ).first()
    if existing:
        return existing

    requested = (payload.status or "Confirmed").strip().title()
    status = requested if requested in {"Candidate", "Confirmed", "Rejected"} else "Confirmed"
    link = models.CaseLegalSection(
        case_id=case_id,
        legal_section_id=payload.legal_section_id,
        status=status,
        rationale=payload.rationale,
        added_by=_officer_id(current_officer),
        reviewed_by=_officer_id(current_officer) if status == "Confirmed" else None,
        reviewed_at=datetime.utcnow() if status == "Confirmed" else None,
    )
    db.add(link)
    db.add(models.AuditLog(
        officer_id=_officer_id(current_officer),
        action="LEGAL_SECTION_ADDED",
        resource_type="CASE",
        resource_id=str(case_id),
        description=f"Added legal section {payload.legal_section_id} to case {case_id} with status {status}",
        success=True,
    ))
    db.commit()
    db.refresh(link)
    return link


@router.patch("/cases/{case_id}/sections/{link_id}/review")
def review_case_section(
    case_id: int,
    link_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer),
):
    _require(current_officer, {"INVESTIGATOR", "SUPERVISOR", "SYSTEM_ADMIN"})
    link = db.query(models.CaseLegalSection).filter(
        models.CaseLegalSection.id == link_id,
        models.CaseLegalSection.case_id == case_id,
    ).first()
    if not link:
        raise HTTPException(404, "Case legal section not found")
    try:
        review_case_legal_section(db, link, str(payload.get("status") or ""), current_officer)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

    db.add(models.AuditLog(
        officer_id=_officer_id(current_officer),
        action=f"LEGAL_SECTION_{link.status.upper()}",
        resource_type="CASE",
        resource_id=str(case_id),
        description=f"{link.status} legal section link {link_id}",
        success=True,
    ))
    db.commit()
    section = db.query(models.LegalSection).filter(models.LegalSection.id == link.legal_section_id).first()
    return _serialize_case_section(link, section)


@router.delete("/cases/{case_id}/sections/{link_id}")
def remove_case_section(
    case_id: int,
    link_id: int,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer),
):
    _require(current_officer, {"INVESTIGATOR", "SUPERVISOR", "SYSTEM_ADMIN"})
    link = db.query(models.CaseLegalSection).filter(
        models.CaseLegalSection.id == link_id,
        models.CaseLegalSection.case_id == case_id,
    ).first()
    if not link:
        raise HTTPException(404, "Case legal section not found")
    db.delete(link)
    db.commit()
    return {"message": "Legal provision removed"}
