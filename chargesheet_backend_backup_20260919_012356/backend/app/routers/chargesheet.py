from fastapi import (
    APIRouter,
    Depends,
    HTTPException
)
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app import models, schemas
from app.utils.security import get_current_officer
from app.services.chargesheet_service import (
    generate_chargesheet_pdf
)


router = APIRouter(
    prefix="/chargesheets",
    tags=["Chargesheets"]
)


# ---------- CREATE CHARGESHEET ----------

@router.post(
    "/",
    response_model=schemas.ChargesheetResponse
)
def create_chargesheet(
    chargesheet: schemas.ChargesheetCreate,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer)
):
    case = db.query(
        models.Case
    ).filter(
        models.Case.id == chargesheet.case_id
    ).first()

    if not case:
        raise HTTPException(
            status_code=404,
            detail="Case not found"
        )

    existing_chargesheet = db.query(
        models.Chargesheet
    ).filter(
        models.Chargesheet.chargesheet_id
        == chargesheet.chargesheet_id
    ).first()

    if existing_chargesheet:
        raise HTTPException(
            status_code=400,
            detail="Chargesheet ID already exists"
        )

    chargesheet_data = chargesheet.model_dump()

    # Always use the authenticated officer.
    chargesheet_data["prepared_by"] = (
        current_officer.officer_id
    )

    new_chargesheet = models.Chargesheet(
        **chargesheet_data
    )

    db.add(new_chargesheet)
    db.commit()
    db.refresh(new_chargesheet)

    return new_chargesheet


# ---------- GET ALL CHARGESHEETS ----------

@router.get(
    "/",
    response_model=List[schemas.ChargesheetResponse]
)
def get_chargesheets(
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer)
):
    return db.query(
        models.Chargesheet
    ).order_by(
        models.Chargesheet.prepared_at.desc()
    ).all()


# ---------- GET CHARGESHEETS BY CASE ----------

@router.get(
    "/case/{case_id}",
    response_model=List[schemas.ChargesheetResponse]
)
def get_chargesheets_by_case(
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

    return db.query(
        models.Chargesheet
    ).filter(
        models.Chargesheet.case_id == case_id
    ).order_by(
        models.Chargesheet.prepared_at.desc()
    ).all()


# ---------- GENERATE CHARGESHEET PDF ----------

@router.post(
    "/{chargesheet_id}/generate-pdf",
    response_model=schemas.ChargesheetResponse
)
def generate_pdf(
    chargesheet_id: int,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer)
):
    chargesheet = db.query(
        models.Chargesheet
    ).filter(
        models.Chargesheet.id == chargesheet_id
    ).first()

    if not chargesheet:
        raise HTTPException(
            status_code=404,
            detail="Chargesheet not found"
        )

    case = db.query(
        models.Case
    ).filter(
        models.Case.id == chargesheet.case_id
    ).first()

    if not case:
        raise HTTPException(
            status_code=404,
            detail="Case not found"
        )

    persons = db.query(
        models.CasePerson
    ).filter(
        models.CasePerson.case_id == case.id
    ).all()

    evidence = db.query(
        models.Evidence
    ).filter(
        models.Evidence.case_id == case.id
    ).all()

    # Only officer-confirmed legal provisions are written into the generated
    # chargesheet. Candidate/rejected provisions remain visible in the case
    # review workflow but are not treated as applicable law in the PDF.
    legal_rows = db.query(
        models.CaseLegalSection,
        models.LegalSection
    ).join(
        models.LegalSection,
        models.CaseLegalSection.legal_section_id == models.LegalSection.id
    ).filter(
        models.CaseLegalSection.case_id == case.id,
        models.CaseLegalSection.status == "Confirmed"
    ).all()

    legal_sections = [section for _, section in legal_rows]

    file_path = generate_chargesheet_pdf(
        chargesheet=chargesheet,
        case=case,
        persons=persons,
        evidence=evidence,
        legal_sections=legal_sections
    )

    chargesheet.generated_pdf_path = file_path

    db.commit()
    db.refresh(chargesheet)

    return chargesheet


# ---------- GET ONE CHARGESHEET ----------

@router.get(
    "/{chargesheet_id}",
    response_model=schemas.ChargesheetResponse
)
def get_chargesheet(
    chargesheet_id: int,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer)
):
    chargesheet = db.query(
        models.Chargesheet
    ).filter(
        models.Chargesheet.id == chargesheet_id
    ).first()

    if not chargesheet:
        raise HTTPException(
            status_code=404,
            detail="Chargesheet not found"
        )

    return chargesheet


# ---------- UPDATE CHARGESHEET ----------

@router.put(
    "/{chargesheet_id}",
    response_model=schemas.ChargesheetResponse
)
def update_chargesheet(
    chargesheet_id: int,
    chargesheet_data: schemas.ChargesheetUpdate,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer)
):
    chargesheet = db.query(
        models.Chargesheet
    ).filter(
        models.Chargesheet.id == chargesheet_id
    ).first()

    if not chargesheet:
        raise HTTPException(
            status_code=404,
            detail="Chargesheet not found"
        )

    update_data = chargesheet_data.model_dump(
        exclude_unset=True
    )

    # Never allow the request to change the officer.
    update_data.pop(
        "prepared_by",
        None
    )

    for key, value in update_data.items():
        setattr(
            chargesheet,
            key,
            value
        )

    db.commit()
    db.refresh(chargesheet)

    return chargesheet
# ---------- CHARGESHEET READINESS ----------

@router.get("/case/{case_id}/readiness")
def chargesheet_readiness(
    case_id: int,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer)
):
    case = db.query(models.Case).filter(models.Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    links = db.query(models.CasePerson).filter(models.CasePerson.case_id == case_id).all()
    evidence = db.query(models.Evidence).filter(models.Evidence.case_id == case_id).all()
    confirmed_legal_count = db.query(models.CaseLegalSection).filter(
        models.CaseLegalSection.case_id == case_id,
        models.CaseLegalSection.status == "Confirmed",
    ).count()
    pending_legal_count = db.query(models.CaseLegalSection).filter(
        models.CaseLegalSection.case_id == case_id,
        models.CaseLegalSection.status == "Candidate",
    ).count()
    chargesheet = db.query(models.Chargesheet).filter(models.Chargesheet.case_id == case_id).order_by(models.Chargesheet.prepared_at.desc()).first()

    accused = [x for x in links if str(x.role_in_case or "").lower() in {"accused", "suspect"}]
    witnesses = [x for x in links if "witness" in str(x.role_in_case or "").lower()]

    checks = [
        {"key": "case", "label": "Case information", "complete": bool(case.case_id and case.fir_number and case.title)},
        {"key": "accused", "label": "Accused / suspect details", "complete": bool(accused)},
        {"key": "evidence", "label": "Evidence relied upon", "complete": bool(evidence)},
        {"key": "legal", "label": "Confirmed legal provisions", "complete": bool(confirmed_legal_count or (chargesheet and chargesheet.legal_provisions))},
        {"key": "legal_review", "label": "Potential legal provisions reviewed", "complete": pending_legal_count == 0},
        {"key": "witness", "label": "Witness records", "complete": bool(witnesses)},
        {"key": "summary", "label": "Investigation summary", "complete": bool(chargesheet and chargesheet.investigation_summary)},
        {"key": "conclusion", "label": "Investigation conclusion", "complete": bool(chargesheet and chargesheet.conclusion)},
    ]
    complete = sum(1 for x in checks if x["complete"])
    return {
        "case_id": case_id,
        "checks": checks,
        "complete": complete,
        "total": len(checks),
        "ready": complete == len(checks),
        "attention_required": len(checks) - complete,
        "confirmed_legal_provisions": confirmed_legal_count,
        "pending_legal_provisions": pending_legal_count,
    }
