import hashlib
from typing import Optional

from sqlalchemy.orm import Session

from app import models


def normalise_device_id(
    raw_device_id: Optional[str]
) -> Optional[str]:
    if not raw_device_id:
        return None

    return raw_device_id.strip()[:255]


def device_fingerprint(
    raw_value: str
) -> str:
    return hashlib.sha256(
        raw_value.encode("utf-8")
    ).hexdigest()


def get_device(
    db: Session,
    device_id: str
):
    return (
        db.query(models.ApprovedDevice)
        .filter(
            models.ApprovedDevice.device_id
            == device_id
        )
        .first()
    )


def is_device_approved(
    db: Session,
    device_id: Optional[str]
) -> bool:
    if not device_id:
        return False

    device = get_device(
        db,
        device_id
    )

    return bool(
        device
        and device.is_approved
        and device.status == "Active"
    )