import re
from collections import Counter
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.utils.security import get_current_officer

router = APIRouter(prefix="/cross-case", tags=["Cross Case Intelligence"])


def normalize(kind: str, value: str):
    kind = (kind or "").upper().strip()
    raw = (value or "").strip()
    if kind in {"PHONE", "IMEI", "ACCOUNT", "VEHICLE", "DEVICE"}:
        return re.sub(r"[^0-9A-Za-z]", "", raw).upper()
    return re.sub(r"\s+", " ", raw).strip().lower()


def _oid(o):
    return getattr(o, "officer_id", None) or (o.get("officer_id") if isinstance(o, dict) else None) or "SYSTEM"


def _role(o):
    return getattr(o, "system_role", None) or (o.get("system_role") if isinstance(o, dict) else None) or (o.get("role") if isinstance(o, dict) else None)


def authorized_case_ids(db: Session, officer):
    role = _role(officer)
    oid = _oid(officer)
    if role == "FORENSIC_ANALYST":
        return sorted({r.case_id for r in db.query(models.ForensicAssignment).filter(models.ForensicAssignment.assigned_to == oid).all()})
    if role == "INVESTIGATOR":
        return [c.id for c in db.query(models.Case).filter(models.Case.investigating_officer == oid).all()]
    return [c.id for c in db.query(models.Case.id).all()]


def bootstrap_existing_identifiers(db: Session):
    for p in db.query(models.Person).all():
        case_ids = [x.case_id for x in db.query(models.CasePerson).filter(models.CasePerson.person_id == p.id).all()]
        for case_id in case_ids:
            candidates = [("PERSON", p.person_id), ("PERSON_NAME", p.name)]
            if p.phone:
                candidates.append(("PHONE", p.phone))
            for kind, raw in candidates:
                norm = normalize(kind, raw)
                if norm and not db.query(models.EntityIdentifier).filter(
                    models.EntityIdentifier.case_id == case_id,
                    models.EntityIdentifier.identifier_type == kind,
                    models.EntityIdentifier.normalized_value == norm,
                ).first():
                    db.add(models.EntityIdentifier(
                        case_id=case_id,
                        person_id=p.id,
                        identifier_type=kind,
                        raw_value=str(raw),
                        normalized_value=norm,
                        source="Person Record",
                        verified=True,
                        created_by="SYSTEM",
                    ))

    for entity in db.query(models.IntelligenceEntity).filter(models.IntelligenceEntity.case_id.isnot(None)).all():
        raw = entity.value or entity.label
        kind = (entity.entity_type or "ENTITY").upper().replace(" ", "_")
        norm = normalize(kind, raw)
        if norm and not db.query(models.EntityIdentifier).filter(
            models.EntityIdentifier.case_id == entity.case_id,
            models.EntityIdentifier.entity_id == entity.id,
            models.EntityIdentifier.identifier_type == kind,
            models.EntityIdentifier.normalized_value == norm,
        ).first():
            db.add(models.EntityIdentifier(
                case_id=entity.case_id,
                entity_id=entity.id,
                identifier_type=kind,
                raw_value=str(raw),
                normalized_value=norm,
                source=entity.source or "Intelligence Entity",
                verified=(str(entity.verification_status).lower() == "verified"),
                created_by=entity.created_by,
            ))
    db.commit()


def _case_map(db, ids):
    rows = db.query(models.Case).filter(models.Case.id.in_(ids)).all() if ids else []
    return {c.id: c for c in rows}


def _evidence_for_identifier(db, row):
    evidence = None
    if row.evidence_id:
        evidence = db.query(models.Evidence).filter(models.Evidence.id == row.evidence_id).first()
    return {
        "id": evidence.id if evidence else None,
        "evidence_id": evidence.evidence_id if evidence else None,
        "title": evidence.title if evidence else None,
        "type": evidence.evidence_type if evidence else None,
        "file_path": evidence.file_path if evidence else None,
    }


def _person_for_identifier(db, row):
    if not row.person_id:
        return None
    person = db.query(models.Person).filter(models.Person.id == row.person_id).first()
    if not person:
        return None
    return {
        "id": person.id,
        "person_id": person.person_id,
        "name": person.name,
        "phone": person.phone,
        "status": person.status,
        "profile_image_path": person.profile_image_path,
    }


@router.post("/identifiers")
def add_identifier(payload: schemas.EntityIdentifierCreate, db: Session = Depends(get_db), current_officer=Depends(get_current_officer)):
    if payload.case_id not in authorized_case_ids(db, current_officer):
        raise HTTPException(403, "Case is not available to this officer")
    norm = normalize(payload.identifier_type, payload.raw_value)
    if not norm:
        raise HTTPException(400, "Identifier value cannot be empty")
    row = models.EntityIdentifier(
        **payload.model_dump(exclude={"raw_value", "identifier_type"}),
        identifier_type=payload.identifier_type.upper(),
        raw_value=payload.raw_value,
        normalized_value=norm,
        created_by=_oid(current_officer),
    )
    db.add(row); db.commit(); db.refresh(row)
    return row


@router.get("/entity/{identifier_type}/{value}")
def entity_appearances(identifier_type: str, value: str, db: Session = Depends(get_db), current_officer=Depends(get_current_officer)):
    bootstrap_existing_identifiers(db)
    allowed = set(authorized_case_ids(db, current_officer))
    kind = identifier_type.upper()
    norm = normalize(kind, value)
    rows = db.query(models.EntityIdentifier).filter(
        models.EntityIdentifier.identifier_type == kind,
        models.EntityIdentifier.normalized_value == norm,
    ).all()
    rows = [r for r in rows if r.case_id in allowed]
    case_ids = sorted({r.case_id for r in rows})
    cases = _case_map(db, case_ids)

    appearances = []
    for r in rows:
        c = cases.get(r.case_id)
        appearances.append({
            "identifier_id": r.id,
            "case_id": r.case_id,
            "case_reference": c.case_id if c else None,
            "case_title": c.title if c else None,
            "case_offence": c.offence if c else None,
            "case_status": c.status if c else None,
            "person": _person_for_identifier(db, r),
            "evidence": _evidence_for_identifier(db, r),
            "source": r.source,
            "verified": r.verified,
        })

    return {
        "identifier_type": kind,
        "query_value": value,
        "normalized_value": norm,
        "case_count": len(case_ids),
        "record_count": len(rows),
        "cross_case": len(case_ids) > 1,
        "assessment": "Requires officer review" if len(case_ids) > 1 else "Single-case record",
        "why_flagged": (
            f"The same normalized {kind.lower().replace('_', ' ')} occurs in {len(case_ids)} authorized investigations. "
            "CINTRA treats this as an investigative lead; context and identity must be reviewed by an officer."
            if len(case_ids) > 1 else
            "This identifier currently occurs in one authorized investigation."
        ),
        "appearances": appearances,
    }


@router.get("/case/{case_id}/overlaps")
def case_overlaps(case_id: int, db: Session = Depends(get_db), current_officer=Depends(get_current_officer)):
    bootstrap_existing_identifiers(db)
    allowed = set(authorized_case_ids(db, current_officer))
    if case_id not in allowed:
        raise HTTPException(403, "Case is not available to this officer")

    mine = db.query(models.EntityIdentifier).filter(models.EntityIdentifier.case_id == case_id).all()
    results = []
    seen = set()
    for source in mine:
        key = (source.identifier_type, source.normalized_value)
        if key in seen:
            continue
        seen.add(key)
        others = db.query(models.EntityIdentifier).filter(
            models.EntityIdentifier.identifier_type == source.identifier_type,
            models.EntityIdentifier.normalized_value == source.normalized_value,
            models.EntityIdentifier.case_id != case_id,
        ).all()
        others = [r for r in others if r.case_id in allowed]
        if not others:
            continue
        other_case_ids = sorted({r.case_id for r in others})
        cases = _case_map(db, other_case_ids)
        results.append({
            "identifier_type": source.identifier_type,
            "value": source.raw_value,
            "normalized_value": source.normalized_value,
            "source": source.source,
            "other_cases": [{
                "id": c.id,
                "case_id": c.case_id,
                "title": c.title,
                "offence": c.offence,
                "status": c.status,
            } for c in cases.values()],
            "supporting_records": len(others) + 1,
            "why_flagged": f"Same normalized {source.identifier_type.lower().replace('_', ' ')} appears in {len(other_case_ids) + 1} investigations.",
        })
    return {"case_id": case_id, "overlap_count": len(results), "overlaps": results}


@router.get("/network/{case_id}")
def network(case_id: int, db: Session = Depends(get_db), current_officer=Depends(get_current_officer)):
    overlaps = case_overlaps(case_id, db, current_officer)["overlaps"]
    case = db.query(models.Case).filter(models.Case.id == case_id).first()
    if not case:
        raise HTTPException(404, "Case not found")
    nodes = [{"id": f"case:{case.id}", "type": "CASE", "label": case.case_id, "title": case.title, "primary": True}]
    edges = []
    added = {nodes[0]["id"]}
    for ov in overlaps:
        entity_id = f"entity:{ov['identifier_type']}:{ov['normalized_value']}"
        if entity_id not in added:
            nodes.append({"id": entity_id, "type": ov["identifier_type"], "label": ov["value"]}); added.add(entity_id)
        edges.append({"source": f"case:{case.id}", "target": entity_id, "type": "APPEARS_IN", "explanation": ov.get("source")})
        for c in ov["other_cases"]:
            cid = f"case:{c['id']}"
            if cid not in added:
                nodes.append({"id": cid, "type": "CASE", "label": c["case_id"], "title": c["title"]}); added.add(cid)
            edges.append({
                "source": entity_id,
                "target": cid,
                "type": "CROSS_CASE_MATCH",
                "explanation": f"Same {ov['identifier_type'].lower().replace('_', ' ')} appears in both investigations",
            })
    return {"case_id": case_id, "nodes": nodes, "edges": edges}


@router.get("/search")
def search(q: str = Query(..., min_length=1), db: Session = Depends(get_db), current_officer=Depends(get_current_officer)):
    bootstrap_existing_identifiers(db)
    allowed = set(authorized_case_ids(db, current_officer))
    raw = q.strip()
    p = f"%{raw}%"
    rows = db.query(models.EntityIdentifier).filter(or_(
        models.EntityIdentifier.raw_value.ilike(p),
        models.EntityIdentifier.normalized_value.ilike(p),
    )).limit(300).all()
    rows = [r for r in rows if r.case_id in allowed]

    grouped = {}
    for r in rows:
        key = (r.identifier_type, r.normalized_value)
        item = grouped.setdefault(key, {
            "identifier_type": r.identifier_type,
            "value": r.raw_value,
            "normalized_value": r.normalized_value,
            "case_ids": set(),
            "records": 0,
            "sources": Counter(),
        })
        item["case_ids"].add(r.case_id)
        item["records"] += 1
        item["sources"][r.source or "Unknown"] += 1

    all_case_ids = sorted({case_id for item in grouped.values() for case_id in item["case_ids"]})
    cases = _case_map(db, all_case_ids)
    out = []
    for item in grouped.values():
        case_ids = sorted(item.pop("case_ids"))
        sources = item.pop("sources")
        item["case_ids"] = case_ids
        item["case_count"] = len(case_ids)
        item["cross_case"] = len(case_ids) > 1
        item["assessment"] = "Cross-case overlap" if len(case_ids) > 1 else "Single-case record"
        item["cases"] = [{
            "id": cases[cid].id,
            "case_id": cases[cid].case_id,
            "title": cases[cid].title,
            "offence": cases[cid].offence,
            "status": cases[cid].status,
        } for cid in case_ids if cid in cases]
        item["source_summary"] = [f"{name} ({count})" for name, count in sources.most_common(3)]
        out.append(item)

    return {
        "query": raw,
        "matches": sorted(out, key=lambda x: (-x["case_count"], -x["records"], x["identifier_type"])),
    }
