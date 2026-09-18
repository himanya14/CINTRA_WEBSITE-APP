from typing import Optional

from sqlalchemy.orm import Session

from app import models


def create_audit_log(
    db: Session,
    *,
    officer_id: Optional[str],
    action: str,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    description: Optional[str] = None,
    ip_address: Optional[str] = None,
    device_id: Optional[str] = None,
    success: bool = True
):
    log = models.AuditLog(
        officer_id=officer_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        description=description,
        ip_address=ip_address,
        device_id=device_id,
        success=success
    )

    db.add(log)
    db.commit()
    db.refresh(log)

    return log