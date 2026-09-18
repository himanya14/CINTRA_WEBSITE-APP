"""Mobile field-companion endpoints backed by the SAME CINTRA PostgreSQL DB.

No mobile-only users, cases, persons, or evidence records are created here.
Authentication is the website Officer + password + TOTP flow, and every write
uses current_officer from the website JWT.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session
from sqlalchemy import func

from app import models
from app.database import get_db, engine
from app.utils.security import get_current_officer
from app.services.mobile_bridge_service import (
    append_evidence_to_latest_graph,
    build_case_graph_snapshot,
    case_from_ref,
    create_relationship_records,
    ensure_case_person_link,
    person_from_ref,
    person_case_summaries,
    try_face_match,
)
from app.services.secure_evidence_service import (
    encrypt_evidence_bytes,
    verify_encrypted_evidence,
)
from app.services.fabric_service import record_custody_event

router = APIRouter(prefix="/api/v1", tags=["CINTRA Mobile Bridge"])


@router.get("/health")
def mobile_health(db: Session = Depends(get_db)):
    return {
        "status": "ok",
        "service": "CINTRA unified backend",
        "shared_database": True,
        "database_role": "central_postgresql_source_of_truth",
        "database_engine": engine.dialect.name,
        "database_name": engine.url.database,
        "cases": db.query(models.Case).count(),
        "persons": db.query(models.Person).count(),
        "evidence": db.query(models.Evidence).count(),
    }


@router.get("/cases")
def mobile_cases(
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer),
):
    rows = (
        db.query(models.Case)
        .order_by(models.Case.registered_on.desc(), models.Case.id.desc())
        .all()
    )
    return [
        {
            "id": row.id,
            "case_id": row.case_id,
            "fir_number": row.fir_number,
            "title": row.title,
            "offence": row.offence,
            "status": row.status,
            "stage": row.stage,
        }
        for row in rows
    ]


@router.post("/cases/{case_ref}/relationship-graph/rebuild")
def rebuild_case_relationship_graph(
    case_ref: str,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer),
):
    """Rebuild the latest web Relationship Analysis snapshot from central case data.

    Useful after upgrading from the earlier mobile bridge that could leave a
    Person+Evidence-only snapshot as the newest analysis. Existing records are
    not modified; this creates a new derived graph snapshot.
    """
    case = case_from_ref(db, case_ref)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    result = build_case_graph_snapshot(db, case)
    result["manual_rebuild"] = {
        "at": datetime.utcnow().isoformat() + "Z",
        "officer_id": current_officer.officer_id,
    }
    analysis = models.IntelligenceAnalysis(
        case_id=case.id,
        source_type="GRAPH_REBUILD",
        input_text="Relationship graph rebuilt from existing central CINTRA case data.",
        result_json=result,
        created_by=current_officer.officer_id,
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    return {
        "success": True,
        "case_database_id": case.id,
        "case_id": case.case_id,
        "fir_number": case.fir_number,
        "analysis_id": analysis.id,
        "nodes": len(result.get("nodes") or []),
        "edges": len(result.get("edges") or []),
        "message": "Relationship graph rebuilt from existing case records.",
    }


@router.get("/cases/{case_ref}/persons")
def mobile_case_persons(
    case_ref: str,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer),
):
    case = case_from_ref(db, case_ref)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    links = (
        db.query(models.CasePerson)
        .filter(models.CasePerson.case_id == case.id)
        .all()
    )
    result = []
    seen = set()
    for link in links:
        person = db.query(models.Person).filter(models.Person.id == link.person_id).first()
        if person and person.id not in seen:
            seen.add(person.id)
            result.append(
                {
                    "id": person.id,
                    "person_id": person.person_id,
                    "name": person.name,
                    "role": person.role,
                    "role_in_case": link.role_in_case,
                    "status": person.status,
                    "profile_image_path": person.profile_image_path,
                }
            )
    return result


@router.get("/persons")
def mobile_people(
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer),
):
    rows = db.query(models.Person).order_by(models.Person.name.asc()).all()
    return [
        {
            "id": p.id,
            "person_id": p.person_id,
            "name": p.name,
            "role": p.role,
            "status": p.status,
            "profile_image_path": p.profile_image_path,
        }
        for p in rows
    ]


@router.get("/suspects/{suspect_code}")
def mobile_suspect(
    suspect_code: str,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer),
):
    person = person_from_ref(db, suspect_code)
    if not person:
        clean_name = str(suspect_code).strip().lower()
        person = (
            db.query(models.Person)
            .filter(func.lower(models.Person.name) == clean_name)
            .first()
        )
    if not person:
        raise HTTPException(status_code=404, detail="Person not found in central CINTRA database")
    cases = person_case_summaries(db, person)
    return {
        "suspect_id": person.person_id,
        "person_db_id": person.id,
        "name": person.name,
        "age": person.age,
        "gender": person.gender,
        "phone": person.phone,
        "address": person.address,
        "role": person.role,
        "wanted": person.status != "Cleared",
        "status": person.status,
        "profile_image_path": person.profile_image_path,
        "case_count": len(cases),
        "case_ids": [case["id"] for case in cases],
        "cases": cases,
    }


@router.post("/identify")
async def mobile_identify(
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer),
):
    content = await image.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty image")

    try:
        result = try_face_match(content, db)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Face matching failed: {exc}")

    if result is None:
        raise HTTPException(
            status_code=503,
            detail="Face matching models are unavailable. No synthetic fallback is used.",
        )
    return result


@router.post("/evidence/upload")
async def mobile_upload_evidence(
    file: UploadFile = File(...),
    type: str = Form("Evidence"),
    case_id: str = Form(...),
    person_id: Optional[str] = Form(None),
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    source: Optional[str] = Form("CINTRA Mobile Field App"),
    relationship_type: str = Form("SUPPORTED_BY_EVIDENCE"),
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer),
):
    case = case_from_ref(db, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Selected case was not found in the central database")

    person = person_from_ref(db, person_id)
    if person_id and not person:
        raise HTTPException(status_code=404, detail="Selected person was not found in the central database")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Evidence file is empty")

    officer_id = current_officer.officer_id
    evidence_code = (
        f"EVD-MOB-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-"
        f"{uuid.uuid4().hex[:6].upper()}"
    )

    try:
        secure = encrypt_evidence_bytes(content, evidence_code, file.filename)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Evidence encryption failed: {exc}")

    # The DB stores an authenticated streaming URL rather than a plaintext file.
    # The original bytes live only inside the AES-256-GCM encrypted artifact.
    file_url = f"/evidence/by-code/{evidence_code}/content/{secure['original_filename']}"

    evidence = models.Evidence(
        evidence_id=evidence_code,
        case_id=case.id,
        title=title or f"{type} - Mobile Field Upload",
        evidence_type=type,
        description=description or "Evidence captured/uploaded from CINTRA mobile field companion.",
        file_path=file_url,
        sha256_hash=secure["sha256"],
        source=source,
        collected_by=officer_id,
        collected_at=datetime.utcnow(),
        status="Collected",
    )

    encrypted_path = Path(secure["encrypted_path"])
    try:
        db.add(evidence)
        db.flush()

        security = models.EvidenceSecurity(
            evidence_db_id=evidence.id,
            evidence_code=evidence.evidence_id,
            original_filename=secure["original_filename"],
            mime_type=file.content_type,
            size_bytes=secure["size_bytes"],
            original_sha256=secure["sha256"],
            encryption_algorithm=secure["algorithm"],
            encrypted_path=secure["encrypted_path"],
            integrity_status="VERIFIED",
        )
        db.add(security)

        custody = models.ChainOfCustodyEvent(
            evidence_id=evidence.id,
            action="REGISTERED",
            from_officer=None,
            to_officer=officer_id,
            location="CINTRA Mobile Field App",
            notes="AES-256-GCM encrypted field evidence registered in central CINTRA database.",
            recorded_by=officer_id,
        )
        db.add(custody)
        db.flush()

        ledger = record_custody_event(
            evidence_id=evidence.evidence_id,
            event_id=str(custody.id),
            action="REGISTERED",
            actor_officer_id=officer_id,
            from_custodian=None,
            to_custodian=officer_id,
            reason="Evidence registered from CINTRA Mobile Field App",
            file_sha256=secure["sha256"],
            timestamp=datetime.utcnow().isoformat() + "Z",
        )
        db.add(
            models.CustodyLedgerReceipt(
                custody_event_id=custody.id,
                evidence_db_id=evidence.id,
                blockchain_status=ledger["blockchain_status"],
                blockchain_tx_id=ledger.get("transaction_id"),
                gateway_error=ledger.get("error"),
            )
        )

        db.add(
            models.TimelineEvent(
                case_id=case.id,
                event_type="EVIDENCE_CAPTURED",
                title=f"Mobile evidence registered: {evidence.title}",
                description=evidence.description,
                event_at=evidence.collected_at,
                source_type="MOBILE_APP",
                source_id=evidence.evidence_id,
                evidence_id=evidence.id,
                officer_id=officer_id,
                confidence=1.0,
                metadata_json={
                    "evidence_type": type,
                    "person_id": person.person_id if person else None,
                    "sha256": secure["sha256"],
                    "encryption": "AES-256-GCM",
                    "blockchain_status": ledger["blockchain_status"],
                    "sync": "mobile_to_web",
                },
            )
        )

        relationship = None
        if person:
            ensure_case_person_link(db, case.id, person)
            relationship = create_relationship_records(
                db,
                case=case,
                person=person,
                evidence=evidence,
                officer_id=officer_id,
                relationship_type=relationship_type,
            )

        analysis = append_evidence_to_latest_graph(
            db,
            case=case,
            evidence=evidence,
            person=person,
            officer_id=officer_id,
            relationship_type=relationship_type,
        )

        verified = verify_encrypted_evidence(
            secure["encrypted_path"], evidence.evidence_id, secure["sha256"]
        )
        security.integrity_status = "VERIFIED" if verified else "MISMATCH"

        db.commit()
        db.refresh(evidence)
    except Exception as exc:
        db.rollback()
        try:
            if encrypted_path.exists():
                encrypted_path.unlink()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Unified evidence sync failed: {exc}")

    return {
        "success": True,
        "filename": secure["original_filename"],
        "type": evidence.evidence_type,
        "officer_id": officer_id,
        "sha256": evidence.sha256_hash,
        "integrity_status": security.integrity_status,
        "encryption": "AES-256-GCM",
        "blockchain_status": ledger["blockchain_status"],
        "blockchain_tx_id": ledger.get("transaction_id"),
        "size_bytes": secure["size_bytes"],
        "file_path": evidence.file_path,
        "evidence_id": evidence.evidence_id,
        "case_database_id": case.id,
        "case_id": case.case_id,
        "fir_number": case.fir_number,
        "person_id": person.person_id if person else None,
        "person_name": person.name if person else None,
        "relationship_id": relationship.relationship_id if relationship else None,
        "analysis_id": analysis.id,
        "synced_to": [
            "Evidence Page",
            "Timeline",
            "Chain of Custody",
            *(["Persons Page", "Relationship Map"] if person else []),
        ],
        "message": "Evidence encrypted, hashed, mapped to the central case, and synchronized with CINTRA web views.",
    }
