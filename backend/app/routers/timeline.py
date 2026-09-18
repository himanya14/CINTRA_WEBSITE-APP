from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.utils.security import get_current_officer

router = APIRouter(prefix="/timeline", tags=["Timeline"])


def _oid(o):
    return getattr(o, "officer_id", None) or (o.get("officer_id") if isinstance(o, dict) else None) or "SYSTEM"


def build_system_timeline(db: Session, case_id: int):
    events = []
    case = db.query(models.Case).filter(models.Case.id == case_id).first()
    if not case: return []
    if case.registered_on:
        events.append({"event_type": "CASE_CREATED", "title": "Case registered", "description": case.title, "event_at": case.registered_on, "source_type": "Case", "source_id": case.case_id, "officer_id": case.investigating_officer})
    for e in db.query(models.Evidence).filter(models.Evidence.case_id == case_id).all():
        dt = e.collected_at or e.uploaded_at
        if dt: events.append({"event_type": "EVIDENCE", "title": f"Evidence recorded: {e.title}", "description": e.description, "event_at": dt, "source_type": "Evidence", "source_id": e.evidence_id, "evidence_id": e.id, "officer_id": e.collected_by})
    for d in db.query(models.CaseDiary).filter(models.CaseDiary.case_id == case_id).all():
        events.append({"event_type": "CASE_DIARY", "title": "Case diary entry", "description": d.entry, "event_at": d.created_at, "source_type": "Case Diary", "source_id": str(d.id), "officer_id": d.officer_id})
    for a in db.query(models.IntelligenceAlert).filter(models.IntelligenceAlert.case_id == case_id).all():
        events.append({"event_type": "ALERT", "title": a.title, "description": a.description, "event_at": a.created_at, "source_type": "Intelligence Alert", "source_id": str(a.id), "officer_id": a.created_by})
    for f in db.query(models.ForensicAssignment).filter(models.ForensicAssignment.case_id == case_id).all():
        events.append({"event_type": "FORENSIC_ASSIGNMENT", "title": f"Forensic assignment: {f.examination_type}", "description": f.instructions, "event_at": f.assigned_at, "source_type": "Forensic Assignment", "source_id": str(f.id), "officer_id": f.assigned_by})
        if f.started_at: events.append({"event_type": "FORENSIC_STARTED", "title": "Forensic examination started", "description": f.examination_type, "event_at": f.started_at, "source_type": "Forensic Assignment", "source_id": str(f.id), "officer_id": f.assigned_to})
        if f.completed_at: events.append({"event_type": "FORENSIC_COMPLETED", "title": "Forensic examination completed", "description": f.examination_type, "event_at": f.completed_at, "source_type": "Forensic Assignment", "source_id": str(f.id), "officer_id": f.assigned_to})
    return events


@router.get("/case/{case_id}")
def get_timeline(case_id: int, db: Session = Depends(get_db), current_officer=Depends(get_current_officer)):
    if not db.query(models.Case).filter(models.Case.id == case_id).first(): raise HTTPException(404, "Case not found")
    persisted = db.query(models.TimelineEvent).filter(models.TimelineEvent.case_id == case_id).all()
    items = build_system_timeline(db, case_id) + [{
        "id": e.id, "event_type": e.event_type, "title": e.title, "description": e.description,
        "event_at": e.event_at, "source_type": e.source_type, "source_id": e.source_id,
        "evidence_id": e.evidence_id, "officer_id": e.officer_id, "confidence": e.confidence,
        "metadata_json": e.metadata_json,
    } for e in persisted]
    items.sort(key=lambda x: x.get("event_at") or datetime.min)
    return items


@router.post("", response_model=schemas.TimelineEventResponse)
def create_event(payload: schemas.TimelineEventCreate, db: Session = Depends(get_db), current_officer=Depends(get_current_officer)):
    row = models.TimelineEvent(**payload.model_dump(), officer_id=_oid(current_officer))
    db.add(row); db.commit(); db.refresh(row)
    return row
