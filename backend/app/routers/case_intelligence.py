from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.utils.security import get_current_officer
from app.routers.cross_case import case_overlaps

router = APIRouter(prefix="/case-intelligence", tags=["Case Intelligence"])


def _oid(officer):
    return (
        getattr(officer, "officer_id", None)
        or (officer.get("officer_id") if isinstance(officer, dict) else None)
        or "SYSTEM"
    )


def _role(officer):
    return (
        getattr(officer, "system_role", None)
        or (officer.get("system_role") if isinstance(officer, dict) else None)
        or ""
    )


def _authorized_forensic_case(db: Session, officer_id: str, case_id: int) -> bool:
    return (
        db.query(models.ForensicAssignment)
        .filter(
            models.ForensicAssignment.assigned_to == officer_id,
            models.ForensicAssignment.case_id == case_id,
        )
        .first()
        is not None
    )


def _serialize_lead(row):
    return {
        "id": row.id,
        "case_id": row.case_id,
        "lead_type": row.lead_type,
        "title": row.title or "Investigative Lead",
        "explanation": row.explanation or "No explanation recorded.",
        "supporting_json": row.supporting_json or {},
        "confidence": row.confidence,
        "verification_status": row.verification_status or "Pending",
        "created_by": row.created_by,
        "created_at": row.created_at,
        "reviewed_by": row.reviewed_by,
        "reviewed_at": row.reviewed_at,
    }


def _serialize_alert(row):
    return {
        "id": row.id,
        "case_id": row.case_id,
        "analysis_id": row.analysis_id,
        "alert_type": row.alert_type or "CASE_ALERT",
        "title": row.title or row.alert_type or "Case Alert",
        "description": row.description or "No additional alert details recorded.",
        "severity": row.severity or "Medium",
        "status": row.status or "Open",
        "created_by": row.created_by,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def _serialize_analysis(row):
    return {
        "id": row.id,
        "case_id": row.case_id,
        "source_type": row.source_type,
        "input_text": row.input_text,
        "result_json": row.result_json or {},
        "created_by": row.created_by,
        "created_at": row.created_at,
    }


@router.get("/case/{case_id}")
def case_dashboard(
    case_id: int,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer),
):
    case = db.query(models.Case).filter(models.Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    officer_id = _oid(current_officer)
    if _role(current_officer) == "FORENSIC_ANALYST" and not _authorized_forensic_case(db, officer_id, case_id):
        raise HTTPException(status_code=403, detail="Case is not assigned to you")

    leads = (
        db.query(models.IntelligenceLead)
        .filter(models.IntelligenceLead.case_id == case_id)
        .order_by(models.IntelligenceLead.created_at.desc())
        .all()
    )
    alerts = (
        db.query(models.IntelligenceAlert)
        .filter(models.IntelligenceAlert.case_id == case_id)
        .order_by(models.IntelligenceAlert.created_at.desc())
        .all()
    )
    analyses = (
        db.query(models.IntelligenceAnalysis)
        .filter(models.IntelligenceAnalysis.case_id == case_id)
        .order_by(models.IntelligenceAnalysis.created_at.desc())
        .all()
    )
    overlaps = case_overlaps(case_id, db, current_officer)

    return {
        "case": {
            "id": case.id,
            "case_id": case.case_id,
            "title": case.title,
            "status": case.status,
            "stage": case.stage,
        },
        "leads": [_serialize_lead(row) for row in leads],
        "alerts": [_serialize_alert(row) for row in alerts],
        "analyses": [_serialize_analysis(row) for row in analyses],
        "cross_case": overlaps,
        "principle": "Analytical leads require officer review and do not establish guilt or identity.",
    }


@router.post("/case/{case_id}/generate-leads")
def generate_leads(
    case_id: int,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer),
):
    case = db.query(models.Case).filter(models.Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    officer_id = _oid(current_officer)
    if _role(current_officer) == "FORENSIC_ANALYST" and not _authorized_forensic_case(db, officer_id, case_id):
        raise HTTPException(status_code=403, detail="Case is not assigned to you")

    overlaps = case_overlaps(case_id, db, current_officer).get("overlaps", [])
    created = []

    for overlap in overlaps:
        other_cases = overlap.get("other_cases") or []
        identifier_type = str(overlap.get("identifier_type") or "identifier")
        raw_value = str(overlap.get("value") or overlap.get("normalized_value") or "Unknown")
        title = f"Cross-case {identifier_type.replace('_', ' ').lower()} overlap"
        explanation = (
            f"{raw_value} appears in this investigation and {len(other_cases)} other case(s). "
            "Review the supporting records and source provenance before drawing conclusions."
        )
        exists = (
            db.query(models.IntelligenceLead)
            .filter(
                models.IntelligenceLead.case_id == case_id,
                models.IntelligenceLead.title == title,
                models.IntelligenceLead.explanation == explanation,
            )
            .first()
        )
        if exists:
            continue
        lead = models.IntelligenceLead(
            case_id=case_id,
            lead_type="CROSS_CASE",
            title=title,
            explanation=explanation,
            supporting_json=overlap,
            confidence=None,
            verification_status="Pending",
            created_by=officer_id,
        )
        db.add(lead)
        created.append(lead)

    if not created:
        relationship_count = (
            db.query(models.IntelligenceRelationship)
            .filter(models.IntelligenceRelationship.case_id == case_id)
            .count()
        )
        if relationship_count:
            title = "Case relationship review"
            exists = (
                db.query(models.IntelligenceLead)
                .filter(
                    models.IntelligenceLead.case_id == case_id,
                    models.IntelligenceLead.title == title,
                    models.IntelligenceLead.verification_status == "Pending",
                )
                .first()
            )
            if not exists:
                lead = models.IntelligenceLead(
                    case_id=case_id,
                    lead_type="RELATIONSHIP_REVIEW",
                    title=title,
                    explanation=(
                        f"{relationship_count} recorded relationship(s) are available for review. "
                        "Open Relationship Analysis to inspect provenance and supporting evidence."
                    ),
                    supporting_json={"relationship_count": relationship_count},
                    confidence=None,
                    verification_status="Pending",
                    created_by=officer_id,
                )
                db.add(lead)
                created.append(lead)

    db.commit()
    return {"created": len(created)}


@router.patch("/leads/{lead_id}/review")
def review_lead(
    lead_id: int,
    payload: schemas.IntelligenceLeadReview,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer),
):
    status = payload.status.strip().title()
    if status not in {"Verified", "Rejected", "Pending"}:
        raise HTTPException(status_code=400, detail="Status must be Verified, Rejected or Pending")

    lead = db.query(models.IntelligenceLead).filter(models.IntelligenceLead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    lead.verification_status = status
    lead.reviewed_by = _oid(current_officer)
    lead.reviewed_at = datetime.utcnow()

    db.add(
        models.AuditLog(
            officer_id=_oid(current_officer),
            action="INTELLIGENCE_LEAD_REVIEWED",
            resource_type="INTELLIGENCE_LEAD",
            resource_id=str(lead.id),
            description=f"Lead marked {status}",
            success=True,
        )
    )
    db.commit()
    db.refresh(lead)
    return _serialize_lead(lead)
