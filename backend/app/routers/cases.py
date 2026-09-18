from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app import crud, schemas, models
from app.services.rbac_service import require_investigator
from app.services.legal_mapping_service import suggest_legal_provisions

router = APIRouter(prefix="/cases", tags=["Cases"])


def _officer_id(officer):
    return getattr(officer, "officer_id", None) or (
        officer.get("officer_id") if isinstance(officer, dict) else None
    ) or "SYSTEM"


@router.post("/", response_model=schemas.CaseResponse)
def create_case(
    case: schemas.CaseCreate,
    current_officer=Depends(require_investigator),
    db: Session = Depends(get_db),
):
    new_case = crud.create_case(db, case)

    # Automatically create *candidate* provisions from the new case narrative.
    # Nothing is legally confirmed here; an authorized officer must review them.
    suggestions = suggest_legal_provisions(
        db,
        new_case,
        current_officer,
        "new case title, offence and description",
    )
    if suggestions:
        db.add(models.AuditLog(
            officer_id=_officer_id(current_officer),
            action="LEGAL_CANDIDATES_AUTO_GENERATED",
            resource_type="CASE",
            resource_id=str(new_case.id),
            description=f"Automatically generated {len(suggestions)} potential legal provision(s) for new case",
            success=True,
        ))
        db.commit()
        db.refresh(new_case)

    return new_case


@router.get("/", response_model=List[schemas.CaseResponse])
def get_cases(
    current_officer=Depends(require_investigator),
    db: Session = Depends(get_db),
):
    return crud.get_cases(db)


@router.get("/{case_id}", response_model=schemas.CaseResponse)
def get_case(
    case_id: int,
    current_officer=Depends(require_investigator),
    db: Session = Depends(get_db),
):
    case = crud.get_case_by_id(db, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case


@router.put("/{case_id}", response_model=schemas.CaseResponse)
def update_case(
    case_id: int,
    case_data: schemas.CaseUpdate,
    current_officer=Depends(require_investigator),
    db: Session = Depends(get_db),
):
    case = crud.update_case(db, case_id, case_data)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    # Re-run suggestion logic after material case narrative changes. Existing
    # Candidate/Confirmed/Rejected decisions are preserved because the service
    # is idempotent and does not duplicate section links.
    suggest_legal_provisions(db, case, current_officer, "updated case narrative")
    db.commit()
    db.refresh(case)
    return case
