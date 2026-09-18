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


router = APIRouter(
    prefix="/relationships",
    tags=["Relationships"]
)


def validate_reference(
    db: Session,
    ref_type: str,
    ref_value: str
):
    normalized_type = ref_type.strip().lower()

    if normalized_type == "person":
        record = db.query(
            models.Person
        ).filter(
            models.Person.person_id == ref_value
        ).first()

        if not record:
            raise HTTPException(
                status_code=404,
                detail=f"Person reference '{ref_value}' not found"
            )

        return record

    if normalized_type == "entity":
        record = db.query(
            models.IntelligenceEntity
        ).filter(
            models.IntelligenceEntity.entity_id == ref_value
        ).first()

        if not record:
            raise HTTPException(
                status_code=404,
                detail=f"Entity reference '{ref_value}' not found"
            )

        return record

    raise HTTPException(
        status_code=400,
        detail="Reference type must be 'Person' or 'Entity'"
    )


# ---------- CREATE RELATIONSHIP ----------

@router.post(
    "/",
    response_model=schemas.IntelligenceRelationshipResponse
)
def create_relationship(
    relationship_data: schemas.IntelligenceRelationshipCreate,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer)
):
    existing_relationship = db.query(
        models.IntelligenceRelationship
    ).filter(
        models.IntelligenceRelationship.relationship_id
        == relationship_data.relationship_id
    ).first()

    if existing_relationship:
        raise HTTPException(
            status_code=400,
            detail="Relationship ID already exists"
        )

    if relationship_data.case_id is not None:
        case = db.query(
            models.Case
        ).filter(
            models.Case.id == relationship_data.case_id
        ).first()

        if not case:
            raise HTTPException(
                status_code=404,
                detail="Case not found"
            )

    validate_reference(
        db=db,
        ref_type=relationship_data.source_type,
        ref_value=relationship_data.source_ref
    )

    validate_reference(
        db=db,
        ref_type=relationship_data.target_type,
        ref_value=relationship_data.target_ref
    )

    if (
        relationship_data.source_type.strip().lower()
        == relationship_data.target_type.strip().lower()
        and relationship_data.source_ref
        == relationship_data.target_ref
    ):
        raise HTTPException(
            status_code=400,
            detail="Source and target cannot be the same record"
        )

    new_relationship = models.IntelligenceRelationship(
        **relationship_data.model_dump(),
        created_by=current_officer.officer_id
    )

    db.add(new_relationship)
    db.commit()
    db.refresh(new_relationship)

    return new_relationship


# ---------- GET ALL RELATIONSHIPS ----------

@router.get(
    "/",
    response_model=List[
        schemas.IntelligenceRelationshipResponse
    ]
)
def get_relationships(
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer)
):
    return db.query(
        models.IntelligenceRelationship
    ).order_by(
        models.IntelligenceRelationship.created_at.desc()
    ).all()


# ---------- GET RELATIONSHIPS BY CASE ----------

@router.get(
    "/case/{case_id}",
    response_model=List[
        schemas.IntelligenceRelationshipResponse
    ]
)
def get_relationships_by_case(
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
        models.IntelligenceRelationship
    ).filter(
        models.IntelligenceRelationship.case_id == case_id
    ).order_by(
        models.IntelligenceRelationship.created_at.desc()
    ).all()


# ---------- GET ONE RELATIONSHIP ----------

@router.get(
    "/{relationship_id}",
    response_model=schemas.IntelligenceRelationshipResponse
)
def get_relationship(
    relationship_id: int,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer)
):
    relationship = db.query(
        models.IntelligenceRelationship
    ).filter(
        models.IntelligenceRelationship.id == relationship_id
    ).first()

    if not relationship:
        raise HTTPException(
            status_code=404,
            detail="Relationship not found"
        )

    return relationship


# ---------- UPDATE RELATIONSHIP ----------

@router.put(
    "/{relationship_id}",
    response_model=schemas.IntelligenceRelationshipResponse
)
def update_relationship(
    relationship_id: int,
    relationship_data: schemas.IntelligenceRelationshipUpdate,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer)
):
    relationship = db.query(
        models.IntelligenceRelationship
    ).filter(
        models.IntelligenceRelationship.id == relationship_id
    ).first()

    if not relationship:
        raise HTTPException(
            status_code=404,
            detail="Relationship not found"
        )

    update_data = relationship_data.model_dump(
        exclude_unset=True
    )

    case_id = update_data.get(
        "case_id",
        relationship.case_id
    )

    source_type = update_data.get(
        "source_type",
        relationship.source_type
    )

    source_ref = update_data.get(
        "source_ref",
        relationship.source_ref
    )

    target_type = update_data.get(
        "target_type",
        relationship.target_type
    )

    target_ref = update_data.get(
        "target_ref",
        relationship.target_ref
    )

    if case_id is not None:
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

    validate_reference(
        db=db,
        ref_type=source_type,
        ref_value=source_ref
    )

    validate_reference(
        db=db,
        ref_type=target_type,
        ref_value=target_ref
    )

    if (
        source_type.strip().lower()
        == target_type.strip().lower()
        and source_ref == target_ref
    ):
        raise HTTPException(
            status_code=400,
            detail="Source and target cannot be the same record"
        )

    for key, value in update_data.items():
        setattr(
            relationship,
            key,
            value
        )

    db.commit()
    db.refresh(relationship)

    return relationship
# =========================================================
# EXPLAINABILITY / PROVENANCE / OFFICER REVIEW
# =========================================================
from datetime import datetime


def _review_officer_id(current_officer):
    return getattr(current_officer, "officer_id", None) or (
        current_officer.get("officer_id") if isinstance(current_officer, dict) else None
    ) or "SYSTEM"


@router.get("/{relationship_id}/explain")
def explain_relationship(
    relationship_id: int,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer),
):
    relationship = db.query(models.IntelligenceRelationship).filter(
        models.IntelligenceRelationship.id == relationship_id
    ).first()
    if not relationship:
        raise HTTPException(status_code=404, detail="Relationship not found")

    sources = db.query(models.RelationshipSource).filter(
        models.RelationshipSource.relationship_id == relationship_id
    ).order_by(models.RelationshipSource.created_at.asc()).all()

    # Backwards-compatible fallback: relationship.source can already contain
    # an evidence reference or analyst-entered provenance.
    supporting = []
    for item in sources:
        evidence = None
        if item.evidence_id:
            evidence = db.query(models.Evidence).filter(models.Evidence.id == item.evidence_id).first()
        supporting.append({
            "id": item.id,
            "source_type": item.source_type,
            "source_reference": item.source_reference,
            "explanation": item.explanation,
            "evidence": ({
                "id": evidence.id,
                "evidence_id": evidence.evidence_id,
                "title": evidence.title,
                "evidence_type": evidence.evidence_type,
            } if evidence else None),
        })

    provenance = "Inferred"
    status = str(relationship.verification_status or "").lower()
    if status == "verified":
        provenance = "Verified"
    elif relationship.source and "manual" in relationship.source.lower():
        provenance = "Manual Input"

    explanation = relationship.description or (
        f"{relationship.source_ref} is linked to {relationship.target_ref} "
        f"through a recorded {relationship.relationship_type.lower()} relationship."
    )

    return {
        "relationship": schemas.IntelligenceRelationshipResponse.model_validate(relationship),
        "provenance": provenance,
        "why_this_link_exists": explanation,
        "supporting_evidence": supporting,
        "fallback_source": relationship.source,
        "review_required": str(relationship.verification_status or "Unverified").lower() not in {"verified", "rejected"},
        "responsible_ai_note": "This relationship is an investigative aid. Officer review is required before relying on an inferred connection.",
    }


@router.post("/{relationship_id}/sources")
def add_relationship_source(
    relationship_id: int,
    payload: schemas.RelationshipSourceCreate,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer),
):
    relationship = db.query(models.IntelligenceRelationship).filter(
        models.IntelligenceRelationship.id == relationship_id
    ).first()
    if not relationship:
        raise HTTPException(status_code=404, detail="Relationship not found")
    if payload.evidence_id is not None:
        evidence = db.query(models.Evidence).filter(models.Evidence.id == payload.evidence_id).first()
        if not evidence:
            raise HTTPException(status_code=404, detail="Evidence not found")
        if relationship.case_id and evidence.case_id != relationship.case_id:
            raise HTTPException(status_code=400, detail="Evidence does not belong to the relationship case")
    row = models.RelationshipSource(
        relationship_id=relationship_id,
        evidence_id=payload.evidence_id,
        source_type=payload.source_type,
        source_reference=payload.source_reference,
        explanation=payload.explanation,
        added_by=_review_officer_id(current_officer),
    )
    db.add(row); db.commit(); db.refresh(row)
    return row


@router.patch("/{relationship_id}/review")
def review_relationship(
    relationship_id: int,
    payload: schemas.RelationshipReviewRequest,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer),
):
    relationship = db.query(models.IntelligenceRelationship).filter(
        models.IntelligenceRelationship.id == relationship_id
    ).first()
    if not relationship:
        raise HTTPException(status_code=404, detail="Relationship not found")
    status_value = payload.status.strip().title()
    if status_value not in {"Verified", "Rejected", "Unverified"}:
        raise HTTPException(status_code=400, detail="Status must be Verified, Rejected or Unverified")
    relationship.verification_status = status_value
    if payload.explanation:
        relationship.description = payload.explanation
    officer_id = _review_officer_id(current_officer)
    db.add(models.AuditLog(
        officer_id=officer_id,
        action="RELATIONSHIP_REVIEWED",
        resource_type="RELATIONSHIP",
        resource_id=str(relationship.id),
        description=f"Relationship {relationship.relationship_id} marked {status_value}",
        success=True,
    ))
    db.commit(); db.refresh(relationship)
    return relationship

@router.post("/case/{case_id}/review-analysis-edge")
def review_analysis_edge(
    case_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer),
):
    """Persist officer review of an edge produced by the saved analysis graph."""
    case = db.query(models.Case).filter(models.Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    source_ref = str(payload.get("source_ref") or payload.get("source") or "").strip()
    target_ref = str(payload.get("target_ref") or payload.get("target") or "").strip()
    rel_type = str(payload.get("relationship_type") or payload.get("type") or "Associated With").strip()
    review_status = str(payload.get("status") or "Verified").strip().title()
    if not source_ref or not target_ref:
        raise HTTPException(status_code=400, detail="Source and target are required")
    if review_status not in {"Verified", "Rejected", "Unverified"}:
        raise HTTPException(status_code=400, detail="Status must be Verified, Rejected or Unverified")

    relationship = db.query(models.IntelligenceRelationship).filter(
        models.IntelligenceRelationship.case_id == case_id,
        models.IntelligenceRelationship.source_ref == source_ref,
        models.IntelligenceRelationship.target_ref == target_ref,
        models.IntelligenceRelationship.relationship_type == rel_type,
    ).first()
    if not relationship:
        relationship = models.IntelligenceRelationship(
            relationship_id=f"REL-CASE{case_id}-{int(datetime.utcnow().timestamp()*1000)}",
            case_id=case_id,
            source_type=str(payload.get("source_type") or "Entity"),
            source_ref=source_ref,
            target_type=str(payload.get("target_type") or "Entity"),
            target_ref=target_ref,
            relationship_type=rel_type,
            description=payload.get("description") or payload.get("explanation"),
            confidence=payload.get("confidence"),
            verification_status=review_status,
            source=payload.get("source_name") or "Saved Analysis Graph",
            data_origin="CINTRA Analysis + Officer Review",
            synthetic=bool(payload.get("synthetic", True)),
            created_by=_review_officer_id(current_officer),
        )
        db.add(relationship)
    else:
        relationship.verification_status = review_status
        if payload.get("description"):
            relationship.description = payload.get("description")

    db.flush()
    officer_id = _review_officer_id(current_officer)
    db.add(models.AuditLog(
        officer_id=officer_id,
        action="ANALYSIS_EDGE_REVIEWED",
        resource_type="RELATIONSHIP",
        resource_id=str(relationship.id),
        description=f"Analysis edge marked {review_status}",
        success=True,
    ))
    db.commit(); db.refresh(relationship)
    return relationship
