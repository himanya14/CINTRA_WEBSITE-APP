from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.utils.security import get_current_officer

router = APIRouter(prefix="/master-data", tags=["Master Data"])

DEFAULTS = {
    "PERSON_ROLE": ["Accused", "Associate", "Witness", "Complainant", "Person of Interest", "Victim"],
    "EVIDENCE_TYPE": ["CDR", "CCTV Footage", "Financial Record", "Location Record", "Document", "Image", "Audio", "Device", "Forensic Report"],
    "RELATIONSHIP_TYPE": ["Communication", "Financial Transaction", "Ownership", "Associated With", "Seen At Same Location", "Used By", "Controlled By"],
    "CASE_STATUS": ["Active", "Under Investigation", "Pending Review", "Closed", "Archived"],
    "INVESTIGATION_STAGE": ["Registration", "Evidence Collection", "Analysis", "Forensic Examination", "Chargesheet Preparation", "Filed"],
    "FORENSIC_EXAMINATION": ["Digital Evidence Examination", "Hash & Integrity Verification", "CDR Analysis", "Media Analysis", "Metadata Examination"],
    "ARTIFACT_TYPE": ["Extracted Frame", "Forensic Report", "Metadata Report", "Analysis Export", "Working Copy"],
}


def _oid(o):
    return getattr(o, "officer_id", None) or (o.get("officer_id") if isinstance(o, dict) else None) or "SYSTEM"


def _role(o):
    return getattr(o, "system_role", None) or (o.get("system_role") if isinstance(o, dict) else None) or (o.get("role") if isinstance(o, dict) else None)

def _require_write(o):
    if _role(o) not in {"SUPERVISOR", "SYSTEM_ADMIN"}:
        raise HTTPException(403, "Supervisor or system administrator access required")

def ensure_defaults(db):
    for category, labels in DEFAULTS.items():
        for label in labels:
            code = label.upper().replace(" ", "_").replace("&", "AND")
            if not db.query(models.MasterDataItem).filter(models.MasterDataItem.category == category, models.MasterDataItem.code == code).first():
                db.add(models.MasterDataItem(category=category, code=code, label=label, active=True, created_by="SYSTEM"))
    db.commit()


@router.get("")
def list_master_data(category: str | None = None, include_inactive: bool = False, db: Session = Depends(get_db), current_officer=Depends(get_current_officer)):
    ensure_defaults(db)
    q = db.query(models.MasterDataItem)
    if category:
        q = q.filter(models.MasterDataItem.category == category.upper())
    if not include_inactive:
        q = q.filter(models.MasterDataItem.active.is_(True))
    return q.order_by(models.MasterDataItem.category, models.MasterDataItem.label).all()


@router.get("/categories")
def categories(db: Session = Depends(get_db), current_officer=Depends(get_current_officer)):
    ensure_defaults(db)
    rows = db.query(models.MasterDataItem.category).distinct().order_by(models.MasterDataItem.category).all()
    return [r[0] for r in rows]


@router.post("", response_model=schemas.MasterDataResponse)
def create(payload: schemas.MasterDataCreate, db: Session = Depends(get_db), current_officer=Depends(get_current_officer)):
    _require_write(current_officer)
    exists = db.query(models.MasterDataItem).filter(models.MasterDataItem.category == payload.category.upper(), models.MasterDataItem.code == payload.code.upper()).first()
    if exists:
        raise HTTPException(409, "Master data code already exists in this category")
    row = models.MasterDataItem(**payload.model_dump(exclude={"category", "code"}), category=payload.category.upper(), code=payload.code.upper(), created_by=_oid(current_officer))
    db.add(row); db.commit(); db.refresh(row)
    return row


@router.patch("/{item_id}")
def update(item_id: int, payload: dict, db: Session = Depends(get_db), current_officer=Depends(get_current_officer)):
    _require_write(current_officer)
    row = db.query(models.MasterDataItem).filter(models.MasterDataItem.id == item_id).first()
    if not row: raise HTTPException(404, "Master data item not found")
    for key in ["label", "description", "metadata_json", "active"]:
        if key in payload: setattr(row, key, payload[key])
    db.commit(); db.refresh(row)
    return row
