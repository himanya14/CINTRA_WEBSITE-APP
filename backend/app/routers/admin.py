from datetime import datetime

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)

from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas

from app.services.rbac_service import (
    require_admin,
    VALID_ROLES,
)

from app.services.audit_service import (
    create_audit_log,
)

from app.utils.security import (
    hash_password,
)


router = APIRouter(
    prefix="/admin",
    tags=["Administration"],
)


# ============================================================
# HELPERS
# ============================================================


def get_officer_or_404(
    db: Session,
    officer_id: str,
):
    officer = (
        db.query(models.Officer)
        .filter(
            models.Officer.officer_id
            == officer_id
        )
        .first()
    )

    if not officer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Officer not found",
        )

    return officer


def revoke_officer_sessions(
    db: Session,
    officer_id: str,
):
    sessions = (
        db.query(models.OfficerSession)
        .filter(
            models.OfficerSession.officer_id
            == officer_id,
            models.OfficerSession.is_active
            == True,
        )
        .all()
    )

    revoked_at = datetime.utcnow()

    for session in sessions:
        session.is_active = False
        session.revoked_at = revoked_at

    return len(sessions)


# ============================================================
# OFFICERS
# ============================================================


@router.get(
    "/officers",
    response_model=list[
        schemas.AdminOfficerResponse
    ],
)
def list_officers(
    current_admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return (
        db.query(models.Officer)
        .order_by(models.Officer.name)
        .all()
    )


@router.post(
    "/officers",
    response_model=schemas.AdminOfficerResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_officer(
    payload: schemas.AdminOfficerCreateRequest,
    current_admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    officer_id = payload.officer_id.strip().upper()
    role = payload.system_role.strip().upper()

    if not officer_id:
        raise HTTPException(
            status_code=400,
            detail="Officer ID is required",
        )

    if role not in VALID_ROLES:
        raise HTTPException(
            status_code=400,
            detail="Invalid CINTRA role",
        )

    if len(payload.password) < 10:
        raise HTTPException(
            status_code=400,
            detail=(
                "Password must contain at least "
                "10 characters"
            ),
        )

    existing = (
        db.query(models.Officer)
        .filter(
            models.Officer.officer_id
            == officer_id
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Officer ID already exists",
        )

    officer = models.Officer(
        officer_id=officer_id,
        name=payload.name.strip(),
        designation=payload.designation.strip(),
        police_station=payload.police_station.strip(),
        email=(
            payload.email.strip()
            if payload.email
            else None
        ),
        phone=(
            payload.phone.strip()
            if payload.phone
            else None
        ),
        hashed_password=hash_password(
            payload.password
        ),
        status="Active",
        system_role=role,
        mfa_enabled=False,
        mfa_secret=None,
        failed_login_attempts=0,
    )

    db.add(officer)
    db.commit()
    db.refresh(officer)

    create_audit_log(
        db,
        officer_id=current_admin.officer_id,
        action="OFFICER_CREATED",
        resource_type="OFFICER",
        resource_id=officer.officer_id,
        description=(
            f"Officer account created with "
            f"role {role}"
        ),
    )

    return officer


# ============================================================
# ROLE MANAGEMENT
# ============================================================


@router.patch(
    "/officers/{officer_id}/role"
)
def update_officer_role(
    officer_id: str,
    payload: schemas.RoleUpdateRequest,
    current_admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    role = payload.system_role.strip().upper()

    if role not in VALID_ROLES:
        raise HTTPException(
            status_code=400,
            detail="Invalid CINTRA role",
        )

    officer = get_officer_or_404(
        db,
        officer_id,
    )

    # Prevent accidental self-demotion.
    if (
        officer.officer_id
        == current_admin.officer_id
        and role != "SYSTEM_ADMIN"
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "You cannot remove your own "
                "System Administrator role."
            ),
        )

    old_role = officer.system_role

    if old_role == role:
        return {
            "message": "Officer already has this role",
            "officer_id": officer.officer_id,
            "system_role": role,
        }

    officer.system_role = role

    # Existing tokens contain the old role.
    # Revoke sessions so the new role takes effect
    # on the officer's next login.
    revoked = revoke_officer_sessions(
        db,
        officer.officer_id,
    )

    db.commit()

    create_audit_log(
        db,
        officer_id=current_admin.officer_id,
        action="ROLE_CHANGED",
        resource_type="OFFICER",
        resource_id=officer.officer_id,
        description=(
            f"Role changed from {old_role} "
            f"to {role}. "
            f"{revoked} active session(s) revoked."
        ),
    )

    return {
        "message": "Officer role updated",
        "officer_id": officer.officer_id,
        "system_role": role,
        "revoked_sessions": revoked,
    }


# ============================================================
# ACCOUNT STATUS
# ============================================================


@router.patch(
    "/officers/{officer_id}/status"
)
def update_officer_status(
    officer_id: str,
    payload: schemas.OfficerStatusUpdateRequest,
    current_admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    officer = get_officer_or_404(
        db,
        officer_id,
    )

    if (
        officer.officer_id
        == current_admin.officer_id
        and not payload.active
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "You cannot deactivate your "
                "own administrator account."
            ),
        )

    new_status = (
        "Active"
        if payload.active
        else "Inactive"
    )

    officer.status = new_status

    revoked = 0

    if not payload.active:
        revoked = revoke_officer_sessions(
            db,
            officer.officer_id,
        )

    db.commit()

    create_audit_log(
        db,
        officer_id=current_admin.officer_id,
        action="OFFICER_STATUS_CHANGED",
        resource_type="OFFICER",
        resource_id=officer.officer_id,
        description=(
            f"Officer status changed to "
            f"{new_status}. "
            f"{revoked} active session(s) revoked."
        ),
    )

    return {
        "message": "Officer status updated",
        "officer_id": officer.officer_id,
        "status": new_status,
        "revoked_sessions": revoked,
    }


# ============================================================
# MFA ADMINISTRATION
# ============================================================


@router.post(
    "/officers/{officer_id}/reset-mfa",
    response_model=schemas.MFAResetResponse,
)
def reset_officer_mfa(
    officer_id: str,
    current_admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    officer = get_officer_or_404(
        db,
        officer_id,
    )

    # Avoid locking the only currently authenticated
    # administrator out accidentally.
    if officer.officer_id == current_admin.officer_id:
        raise HTTPException(
            status_code=400,
            detail=(
                "You cannot reset your own MFA "
                "from the administration endpoint."
            ),
        )

    officer.mfa_enabled = False
    officer.mfa_secret = None

    revoked = revoke_officer_sessions(
        db,
        officer.officer_id,
    )

    db.commit()

    create_audit_log(
        db,
        officer_id=current_admin.officer_id,
        action="MFA_RESET",
        resource_type="OFFICER",
        resource_id=officer.officer_id,
        description=(
            f"MFA reset. "
            f"{revoked} active session(s) revoked."
        ),
    )

    return {
        "message": (
            "MFA reset successfully. "
            "The officer must configure MFA "
            "during the next login."
        ),
        "officer_id": officer.officer_id,
        "mfa_enabled": False,
    }


# ============================================================
# SESSION MANAGEMENT
# ============================================================


@router.get(
    "/officers/{officer_id}/sessions",
    response_model=list[
        schemas.OfficerSessionResponse
    ],
)
def list_officer_sessions(
    officer_id: str,
    current_admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    get_officer_or_404(
        db,
        officer_id,
    )

    return (
        db.query(models.OfficerSession)
        .filter(
            models.OfficerSession.officer_id
            == officer_id
        )
        .order_by(
            models.OfficerSession.created_at.desc()
        )
        .all()
    )


@router.post(
    "/officers/{officer_id}/revoke-sessions",
    response_model=schemas.SessionRevokeResponse,
)
def revoke_all_officer_sessions(
    officer_id: str,
    current_admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    officer = get_officer_or_404(
        db,
        officer_id,
    )

    if officer.officer_id == current_admin.officer_id:
        raise HTTPException(
            status_code=400,
            detail=(
                "Use the normal logout mechanism "
                "for your own administrator session."
            ),
        )

    revoked = revoke_officer_sessions(
        db,
        officer.officer_id,
    )

    db.commit()

    create_audit_log(
        db,
        officer_id=current_admin.officer_id,
        action="SESSIONS_REVOKED",
        resource_type="OFFICER",
        resource_id=officer.officer_id,
        description=(
            f"{revoked} active session(s) revoked."
        ),
    )

    return {
        "message": "Officer sessions revoked",
        "revoked_sessions": revoked,
    }


# ============================================================
# AUDIT LOGS
# ============================================================


@router.get(
    "/audit-logs",
    response_model=list[
        schemas.AuditLogResponse
    ],
)
def get_audit_logs(
    limit: int = 100,
    current_admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    safe_limit = min(
        max(limit, 1),
        500,
    )

    return (
        db.query(models.AuditLog)
        .order_by(
            models.AuditLog.created_at.desc()
        )
        .limit(safe_limit)
        .all()
    )


# ============================================================
# APPROVED DEVICES
# ============================================================


@router.get(
    "/devices",
    response_model=list[
        schemas.ApprovedDeviceResponse
    ],
)
def get_devices(
    current_admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return (
        db.query(models.ApprovedDevice)
        .order_by(
            models.ApprovedDevice.created_at.desc()
        )
        .all()
    )


@router.post(
    "/devices",
    response_model=schemas.ApprovedDeviceResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_device(
    payload: schemas.DeviceRegisterRequest,
    current_admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    existing = (
        db.query(models.ApprovedDevice)
        .filter(
            models.ApprovedDevice.device_id
            == payload.device_id
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Device already registered",
        )

    device = models.ApprovedDevice(
        device_id=payload.device_id,
        device_name=payload.device_name,
        station=payload.station,
        is_approved=False,
        status="Active",
    )

    db.add(device)
    db.commit()
    db.refresh(device)

    create_audit_log(
        db,
        officer_id=current_admin.officer_id,
        action="DEVICE_REGISTERED",
        resource_type="DEVICE",
        resource_id=payload.device_id,
        description=(
            "Departmental device registered"
        ),
    )

    return device


@router.patch(
    "/devices/{device_id}/approval"
)
def approve_device(
    device_id: str,
    payload: schemas.DeviceApprovalRequest,
    current_admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    device = (
        db.query(models.ApprovedDevice)
        .filter(
            models.ApprovedDevice.device_id
            == device_id
        )
        .first()
    )

    if not device:
        raise HTTPException(
            status_code=404,
            detail="Device not found",
        )

    device.is_approved = payload.approved

    device.approved_by = (
        current_admin.officer_id
        if payload.approved
        else None
    )

    device.approved_at = (
        datetime.utcnow()
        if payload.approved
        else None
    )

    db.commit()

    create_audit_log(
        db,
        officer_id=current_admin.officer_id,
        action=(
            "DEVICE_APPROVED"
            if payload.approved
            else "DEVICE_REVOKED"
        ),
        resource_type="DEVICE",
        resource_id=device_id,
    )

    return {
        "device_id": device_id,
        "approved": device.is_approved,
    }