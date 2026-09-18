from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.utils.security import get_current_officer
from app.services.fabric_service import record_custody_event

router = APIRouter(prefix="/custody", tags=["Chain of Custody"])


def _oid(officer):
    return (
        getattr(officer, "officer_id", None)
        or (officer.get("officer_id") if isinstance(officer, dict) else None)
        or "SYSTEM"
    )


@router.get("/evidence/{evidence_id}")
def history(
    evidence_id: int,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer),
):
    evidence = db.query(models.Evidence).filter(models.Evidence.id == evidence_id).first()
    if not evidence:
        raise HTTPException(404, "Evidence not found")

    rows = (
        db.query(models.ChainOfCustodyEvent)
        .filter(models.ChainOfCustodyEvent.evidence_id == evidence_id)
        .order_by(models.ChainOfCustodyEvent.recorded_at.desc())
        .all()
    )
    if not rows:
        return [
            {
                "id": 0,
                "evidence_id": evidence.id,
                "action": "COLLECTED",
                "from_officer": None,
                "to_officer": evidence.collected_by,
                "location": evidence.source,
                "notes": "Initial evidence collection record",
                "recorded_by": evidence.collected_by,
                "recorded_at": evidence.collected_at or evidence.uploaded_at,
                "blockchain_status": "NOT_RECORDED",
                "blockchain_tx_id": None,
            }
        ]

    event_ids = [row.id for row in rows]
    receipts = (
        db.query(models.CustodyLedgerReceipt)
        .filter(models.CustodyLedgerReceipt.custody_event_id.in_(event_ids))
        .all()
        if event_ids
        else []
    )
    receipt_by_event = {receipt.custody_event_id: receipt for receipt in receipts}

    return [
        {
            "id": row.id,
            "evidence_id": row.evidence_id,
            "action": row.action,
            "from_officer": row.from_officer,
            "to_officer": row.to_officer,
            "location": row.location,
            "notes": row.notes,
            "recorded_by": row.recorded_by,
            "recorded_at": row.recorded_at,
            "blockchain_status": (
                receipt_by_event[row.id].blockchain_status
                if row.id in receipt_by_event
                else "NOT_RECORDED"
            ),
            "blockchain_tx_id": (
                receipt_by_event[row.id].blockchain_tx_id
                if row.id in receipt_by_event
                else None
            ),
        }
        for row in rows
    ]


@router.post("/evidence/{evidence_id}")
def add_event(
    evidence_id: int,
    payload: schemas.CustodyEventCreate,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer),
):
    evidence = db.query(models.Evidence).filter(models.Evidence.id == evidence_id).first()
    if not evidence:
        raise HTTPException(404, "Evidence not found")

    officer_id = _oid(current_officer)
    row = models.ChainOfCustodyEvent(
        evidence_id=evidence_id,
        recorded_by=officer_id,
        **payload.model_dump(),
    )
    db.add(row)
    db.flush()

    ledger = record_custody_event(
        evidence_id=evidence.evidence_id,
        event_id=str(row.id),
        action=row.action,
        actor_officer_id=officer_id,
        from_custodian=row.from_officer,
        to_custodian=row.to_officer,
        reason=row.notes,
        file_sha256=evidence.sha256_hash or "",
        timestamp=datetime.utcnow().isoformat() + "Z",
    )
    db.add(
        models.CustodyLedgerReceipt(
            custody_event_id=row.id,
            evidence_db_id=evidence.id,
            blockchain_status=ledger["blockchain_status"],
            blockchain_tx_id=ledger.get("transaction_id"),
            gateway_error=ledger.get("error"),
        )
    )
    db.add(
        models.AuditLog(
            officer_id=officer_id,
            action="CUSTODY_EVENT_RECORDED",
            resource_type="EVIDENCE",
            resource_id=str(evidence_id),
            description=payload.action,
            success=True,
        )
    )
    db.commit()
    db.refresh(row)

    return {
        "id": row.id,
        "evidence_id": row.evidence_id,
        "action": row.action,
        "from_officer": row.from_officer,
        "to_officer": row.to_officer,
        "location": row.location,
        "notes": row.notes,
        "recorded_by": row.recorded_by,
        "recorded_at": row.recorded_at,
        "blockchain_status": ledger["blockchain_status"],
        "blockchain_tx_id": ledger.get("transaction_id"),
    }
