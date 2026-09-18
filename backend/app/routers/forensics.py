from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.utils.security import get_current_officer


router = APIRouter(
    prefix="/forensics",
    tags=["Forensics"]
)


# ============================================================
# HELPERS
# ============================================================

def get_officer_id(current_officer):
    """
    Safely obtain the officer ID from either:
    - SQLAlchemy Officer object
    - dictionary-like authentication payload
    """

    if isinstance(current_officer, dict):
        officer_id = (
            current_officer.get("officer_id")
            or current_officer.get("sub")
        )
    else:
        officer_id = getattr(
            current_officer,
            "officer_id",
            None
        )

    if not officer_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unable to identify authenticated officer"
        )

    return officer_id


def get_officer_role(current_officer):
    """
    Safely obtain the system role of the logged-in officer.
    """

    if isinstance(current_officer, dict):
        return current_officer.get("system_role") or current_officer.get("role")

    return getattr(
        current_officer,
        "system_role",
        None
    )


def require_roles(current_officer, allowed_roles):
    """
    Simple role guard for forensic endpoints.
    """

    role = get_officer_role(current_officer)

    if role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to perform this action"
        )


def create_audit_log(
    db: Session,
    officer_id: str,
    action: str,
    resource_type: str = None,
    resource_id: str = None,
    description: str = None,
    success: bool = True
):
    """
    Write an entry to CINTRA's existing audit_logs table.
    """

    log = models.AuditLog(
        officer_id=officer_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        description=description,
        success=success
    )

    db.add(log)


# ============================================================
# 1. CREATE FORENSIC ASSIGNMENT
# ============================================================

@router.post(
    "/assignments",
    response_model=schemas.ForensicAssignmentResponse,
    status_code=status.HTTP_201_CREATED
)
def create_forensic_assignment(
    payload: schemas.ForensicAssignmentCreate,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer)
):
    """
    Assign forensic examination work.

    Allowed:
    - SUPERVISOR
    - SYSTEM_ADMIN
    """

    require_roles(
        current_officer,
        [
            "SUPERVISOR",
            "SYSTEM_ADMIN"
        ]
    )

    assigned_by = get_officer_id(current_officer)

    # --------------------------------------------------------
    # Verify case
    # --------------------------------------------------------

    case = (
        db.query(models.Case)
        .filter(
            models.Case.id == payload.case_id
        )
        .first()
    )

    if not case:
        raise HTTPException(
            status_code=404,
            detail="Case not found"
        )

    # --------------------------------------------------------
    # Verify forensic analyst
    # --------------------------------------------------------

    analyst = (
        db.query(models.Officer)
        .filter(
            models.Officer.officer_id
            == payload.assigned_to
        )
        .first()
    )

    if not analyst:
        raise HTTPException(
            status_code=404,
            detail="Assigned officer not found"
        )

    if analyst.system_role != "FORENSIC_ANALYST":
        raise HTTPException(
            status_code=400,
            detail="Selected officer is not a forensic analyst"
        )

    if analyst.status != "Active":
        raise HTTPException(
            status_code=400,
            detail="Selected forensic analyst is inactive"
        )

    # --------------------------------------------------------
    # Verify evidence if supplied
    # --------------------------------------------------------

    evidence = None

    if payload.evidence_id is not None:
        evidence = (
            db.query(models.Evidence)
            .filter(
                models.Evidence.id
                == payload.evidence_id
            )
            .first()
        )

        if not evidence:
            raise HTTPException(
                status_code=404,
                detail="Evidence not found"
            )

        if evidence.case_id != payload.case_id:
            raise HTTPException(
                status_code=400,
                detail="Evidence does not belong to the selected case"
            )

    # --------------------------------------------------------
    # Prevent duplicate active assignment
    # --------------------------------------------------------

    duplicate_query = (
        db.query(models.ForensicAssignment)
        .filter(
            models.ForensicAssignment.case_id
            == payload.case_id,
            models.ForensicAssignment.assigned_to
            == payload.assigned_to,
            models.ForensicAssignment.status.in_(
                [
                    "Assigned",
                    "In Progress"
                ]
            )
        )
    )

    if payload.evidence_id is None:
        duplicate_query = duplicate_query.filter(
            models.ForensicAssignment.evidence_id.is_(None)
        )
    else:
        duplicate_query = duplicate_query.filter(
            models.ForensicAssignment.evidence_id
            == payload.evidence_id
        )

    duplicate = duplicate_query.first()

    if duplicate:
        raise HTTPException(
            status_code=409,
            detail="An active forensic assignment already exists"
        )

    # --------------------------------------------------------
    # Create assignment
    # --------------------------------------------------------

    assignment = models.ForensicAssignment(
        case_id=payload.case_id,
        evidence_id=payload.evidence_id,
        assigned_to=payload.assigned_to,
        assigned_by=assigned_by,
        examination_type=payload.examination_type,
        instructions=payload.instructions,
        priority=payload.priority,
        status="Assigned"
    )

    db.add(assignment)
    db.flush()

    # --------------------------------------------------------
    # Audit
    # --------------------------------------------------------

    create_audit_log(
        db=db,
        officer_id=assigned_by,
        action="FORENSIC_ASSIGNMENT_CREATED",
        resource_type="FORENSIC_ASSIGNMENT",
        resource_id=str(assignment.id),
        description=(
            f"Assigned case {case.case_id} "
            f"to forensic analyst {payload.assigned_to} "
            f"for {payload.examination_type}"
        )
    )

    db.commit()
    db.refresh(assignment)

    return assignment


# ============================================================
# 2. MY FORENSIC ASSIGNMENTS
# ============================================================

@router.get(
    "/assignments/me",
    response_model=list[schemas.ForensicAssignmentResponse]
)
def get_my_forensic_assignments(
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer)
):
    """
    Return forensic assignments belonging to the logged-in analyst.
    """

    require_roles(
        current_officer,
        [
            "FORENSIC_ANALYST"
        ]
    )

    officer_id = get_officer_id(
        current_officer
    )

    assignments = (
        db.query(models.ForensicAssignment)
        .filter(
            models.ForensicAssignment.assigned_to
            == officer_id
        )
        .order_by(
            models.ForensicAssignment.assigned_at.desc()
        )
        .all()
    )

    return assignments


# ============================================================
# 3. GET SINGLE ASSIGNMENT
# ============================================================

@router.get(
    "/assignments/{assignment_id}",
    response_model=schemas.ForensicAssignmentResponse
)
def get_forensic_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer)
):
    assignment = (
        db.query(models.ForensicAssignment)
        .filter(
            models.ForensicAssignment.id
            == assignment_id
        )
        .first()
    )

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail="Forensic assignment not found"
        )

    role = get_officer_role(
        current_officer
    )

    officer_id = get_officer_id(
        current_officer
    )

    if role == "FORENSIC_ANALYST":
        if assignment.assigned_to != officer_id:
            raise HTTPException(
                status_code=403,
                detail="This forensic assignment is not assigned to you"
            )

    elif role not in [
        "SUPERVISOR",
        "SYSTEM_ADMIN"
    ]:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to view this assignment"
        )

    return assignment


# ============================================================
# 4. UPDATE ASSIGNMENT STATUS
# ============================================================

@router.patch(
    "/assignments/{assignment_id}/status",
    response_model=schemas.ForensicAssignmentResponse
)
def update_forensic_assignment_status(
    assignment_id: int,
    payload: schemas.ForensicAssignmentStatusUpdate,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer)
):
    """
    Forensic analyst can start or complete their assignment.
    """

    require_roles(
        current_officer,
        [
            "FORENSIC_ANALYST"
        ]
    )

    officer_id = get_officer_id(
        current_officer
    )

    assignment = (
        db.query(models.ForensicAssignment)
        .filter(
            models.ForensicAssignment.id
            == assignment_id
        )
        .first()
    )

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail="Forensic assignment not found"
        )

    if assignment.assigned_to != officer_id:
        raise HTTPException(
            status_code=403,
            detail="This assignment is not assigned to you"
        )

    new_status = payload.status.strip()

    allowed_statuses = [
        "Assigned",
        "In Progress",
        "Completed"
    ]

    if new_status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid status. Allowed values: "
                "Assigned, In Progress, Completed"
            )
        )

    old_status = assignment.status

    # --------------------------------------------------------
    # Prevent completed assignment from being reopened
    # --------------------------------------------------------

    if old_status == "Completed":
        raise HTTPException(
            status_code=400,
            detail="Completed forensic assignments cannot be modified"
        )

    # --------------------------------------------------------
    # Status transition validation
    # --------------------------------------------------------

    if (
        old_status == "Assigned"
        and new_status == "Completed"
    ):
        raise HTTPException(
            status_code=400,
            detail="Start the examination before completing it"
        )

    # --------------------------------------------------------
    # Start examination
    # --------------------------------------------------------

    if (
        new_status == "In Progress"
        and assignment.started_at is None
    ):
        assignment.started_at = datetime.utcnow()

    # --------------------------------------------------------
    # Complete examination
    # --------------------------------------------------------

    if new_status == "Completed":
        assignment.completed_at = datetime.utcnow()

    assignment.status = new_status
    assignment.updated_at = datetime.utcnow()

    # --------------------------------------------------------
    # Audit
    # --------------------------------------------------------

    if new_status == "In Progress":
        action = "FORENSIC_EXAMINATION_STARTED"

    elif new_status == "Completed":
        action = "FORENSIC_EXAMINATION_COMPLETED"

    else:
        action = "FORENSIC_ASSIGNMENT_STATUS_CHANGED"

    create_audit_log(
        db=db,
        officer_id=officer_id,
        action=action,
        resource_type="FORENSIC_ASSIGNMENT",
        resource_id=str(assignment.id),
        description=(
            f"Forensic assignment {assignment.id} "
            f"changed from {old_status} "
            f"to {new_status}"
        )
    )

    db.commit()
    db.refresh(assignment)

    return assignment


# ============================================================
# 5. FORENSIC ANALYST — ASSIGNED CASES
# ============================================================

@router.get(
    "/cases",
    response_model=list[schemas.CaseResponse]
)
def get_forensic_cases(
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer)
):
    """
    Return only cases assigned to the logged-in forensic analyst.
    """

    require_roles(
        current_officer,
        [
            "FORENSIC_ANALYST"
        ]
    )

    officer_id = get_officer_id(
        current_officer
    )

    cases = (
        db.query(models.Case)
        .join(
            models.ForensicAssignment,
            models.ForensicAssignment.case_id
            == models.Case.id
        )
        .filter(
            models.ForensicAssignment.assigned_to
            == officer_id
        )
        .distinct()
        .order_by(
            models.Case.last_updated.desc()
        )
        .all()
    )

    return cases


# ============================================================
# 6. FORENSIC ANALYST — ASSIGNED EVIDENCE
# ============================================================

@router.get(
    "/evidence",
    response_model=list[schemas.EvidenceResponse]
)
def get_forensic_evidence(
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer)
):
    """Return evidence accessible through evidence-level or case-level assignments."""
    require_roles(current_officer, ["FORENSIC_ANALYST"])
    officer_id = get_officer_id(current_officer)
    assignments = db.query(models.ForensicAssignment).filter(
        models.ForensicAssignment.assigned_to == officer_id
    ).all()
    if not assignments:
        return []
    case_ids = {a.case_id for a in assignments if a.case_id is not None}
    evidence_ids = {a.evidence_id for a in assignments if a.evidence_id is not None}
    from sqlalchemy import or_
    filters = []
    if case_ids:
        filters.append(models.Evidence.case_id.in_(case_ids))
    if evidence_ids:
        filters.append(models.Evidence.id.in_(evidence_ids))
    if not filters:
        return []
    return db.query(models.Evidence).filter(or_(*filters)).distinct().order_by(
        models.Evidence.uploaded_at.desc()
    ).all()


# ============================================================
# 7. EVIDENCE FOR ONE ASSIGNED CASE
# ============================================================

@router.get(
    "/cases/{case_id}/evidence",
    response_model=list[schemas.EvidenceResponse]
)
def get_assigned_case_evidence(
    case_id: int,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer)
):
    """
    Return evidence from a case only if that case is assigned
    to the logged-in forensic analyst.
    """

    require_roles(
        current_officer,
        [
            "FORENSIC_ANALYST"
        ]
    )

    officer_id = get_officer_id(
        current_officer
    )

    assignment = (
        db.query(models.ForensicAssignment)
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
            detail="This case is not assigned to you"
        )

    evidence = (
        db.query(models.Evidence)
        .filter(
            models.Evidence.case_id
            == case_id
        )
        .order_by(
            models.Evidence.uploaded_at.desc()
        )
        .all()
    )

    return evidence


# ============================================================
# 8. FORENSIC WORKSPACE SUMMARY
# ============================================================

@router.get(
    "/overview"
)
def get_forensic_overview(
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer)
):
    """Live overview including all evidence available through assigned cases."""
    require_roles(current_officer, ["FORENSIC_ANALYST"])
    officer_id = get_officer_id(current_officer)
    assignments = db.query(models.ForensicAssignment).filter(
        models.ForensicAssignment.assigned_to == officer_id
    ).order_by(models.ForensicAssignment.assigned_at.desc()).all()
    case_ids = {a.case_id for a in assignments if a.case_id is not None}
    explicit_evidence_ids = {a.evidence_id for a in assignments if a.evidence_id is not None}
    evidence_ids = set(explicit_evidence_ids)
    if case_ids:
        evidence_ids.update(row[0] for row in db.query(models.Evidence.id).filter(models.Evidence.case_id.in_(case_ids)).all())
    counts = {"assigned": 0, "in_progress": 0, "completed": 0, "high_priority": 0}
    for a in assignments:
        if a.status == "Assigned": counts["assigned"] += 1
        elif a.status == "In Progress": counts["in_progress"] += 1
        elif a.status == "Completed": counts["completed"] += 1
        if str(a.priority or "").lower() in {"high", "urgent", "critical"}: counts["high_priority"] += 1
    latest = assignments[:5]
    return {
        "officer_id": officer_id,
        "total_assignments": len(assignments),
        **counts,
        "assigned_cases": len(case_ids),
        "assigned_evidence": len(evidence_ids),
        "current_assignments": [{
            "id": a.id, "case_id": a.case_id, "evidence_id": a.evidence_id,
            "examination_type": a.examination_type, "instructions": a.instructions,
            "priority": a.priority, "status": a.status, "assigned_at": a.assigned_at,
            "started_at": a.started_at, "completed_at": a.completed_at
        } for a in latest],
    }

