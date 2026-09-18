"""Shared services used by the CINTRA field app compatibility API.

The mobile app and the web portal intentionally write to the same SQLAlchemy
models/database.  This file contains only bridge-specific helpers; the original
web APIs remain unchanged.
"""
from __future__ import annotations

import copy
import uuid
from datetime import datetime
from pathlib import Path

from sqlalchemy.orm import Session

from app import models

BACKEND_DIR = Path(__file__).resolve().parents[2]
MODEL_DIR = BACKEND_DIR / "data" / "mobile_face_models"

# Cached reference embeddings make repeated field scans much faster. Cache keys
# include file mtime, so replacing a portrait automatically triggers re-enrolment.
_FACE_FEATURE_CACHE = {}

def case_from_ref(db: Session, case_ref: str | int):
    """Accept a database id, CINTRA case id, or FIR number."""
    raw = str(case_ref).strip()
    case = None
    if raw.isdigit():
        case = db.query(models.Case).filter(models.Case.id == int(raw)).first()
    if not case:
        case = db.query(models.Case).filter(models.Case.case_id == raw).first()
    if not case:
        case = db.query(models.Case).filter(models.Case.fir_number == raw).first()
    return case


def person_from_ref(db: Session, person_ref: str | int | None):
    if person_ref is None or str(person_ref).strip() == "":
        return None
    raw = str(person_ref).strip()
    person = None
    if raw.isdigit():
        person = db.query(models.Person).filter(models.Person.id == int(raw)).first()
    if not person:
        person = db.query(models.Person).filter(models.Person.person_id == raw).first()
    return person


def ensure_case_person_link(db: Session, case_id: int, person: models.Person) -> None:
    existing = (
        db.query(models.CasePerson)
        .filter(
            models.CasePerson.case_id == case_id,
            models.CasePerson.person_id == person.id,
        )
        .first()
    )
    if not existing:
        db.add(
            models.CasePerson(
                case_id=case_id,
                person_id=person.id,
                role_in_case=person.role or "Person of Interest",
            )
        )
        db.flush()


def _graph_person_node(person: models.Person) -> dict:
    return {
        "id": f"PERSON::{person.person_id}",
        "type": "Person",
        "person_id": person.person_id,
        "name": person.name,
        "label": person.name,
        "role_in_case": person.role,
        "status": person.status,
        "profile_image_path": person.profile_image_path,
    }


def _graph_evidence_node(evidence: models.Evidence) -> dict:
    return {
        "id": f"EVIDENCE::{evidence.evidence_id}",
        "type": "Evidence",
        "evidence_id": evidence.evidence_id,
        "label": evidence.title,
        "title": evidence.title,
        "evidence_type": evidence.evidence_type,
        "file_path": evidence.file_path,
        "source": evidence.source,
        "sha256_hash": evidence.sha256_hash,
    }


def _graph_entity_node(entity: models.IntelligenceEntity) -> dict:
    return {
        "id": f"ENTITY::{entity.entity_id}",
        "type": entity.entity_type or "Entity",
        "entity_id": entity.entity_id,
        "label": entity.label or entity.value or entity.entity_id,
        "name": entity.label or entity.value or entity.entity_id,
        "value": entity.value,
        "description": entity.description,
        "confidence": entity.confidence,
        "verification_status": entity.verification_status,
        "source": entity.source,
    }


def _technical_node(node_id: str, node_type: str, label: str, **extra) -> dict:
    return {
        "id": node_id,
        "type": node_type or "Entity",
        "label": label or node_id,
        "name": label or node_id,
        **extra,
    }


def build_case_graph_snapshot(db: Session, case: models.Case) -> dict:
    """Build a relationship graph from the central case database.

    Mobile evidence must join the existing investigation network; it must not
    become a new two-node graph that hides the rest of the case.  We therefore
    start with the latest non-mobile analytical graph (when present) and enrich
    it from the current PostgreSQL records: case persons, intelligence entities,
    recorded intelligence relationships and case evidence.
    """
    # Start from the latest genuine intelligence analysis, not from a previous
    # mobile sync/rebuild snapshot. Otherwise an old two-node mobile snapshot
    # can become the base forever and visually hide the richer case network.
    base = (
        db.query(models.IntelligenceAnalysis)
        .filter(
            models.IntelligenceAnalysis.case_id == case.id,
            ~models.IntelligenceAnalysis.source_type.in_([
                "MOBILE_EVIDENCE_SYNC",
                "GRAPH_REBUILD",
            ]),
        )
        .order_by(models.IntelligenceAnalysis.created_at.desc(), models.IntelligenceAnalysis.id.desc())
        .first()
    )

    result = copy.deepcopy(base.result_json if base and isinstance(base.result_json, dict) else {})
    nodes = list(result.get("nodes") or [])
    edges = list(result.get("edges") or [])

    node_ids = {
        str(node.get("id"))
        for node in nodes
        if isinstance(node, dict) and node.get("id") is not None
    }
    edge_keys = set()
    for edge in edges:
        if not isinstance(edge, dict):
            continue
        edge_keys.add((
            str(edge.get("source") or edge.get("source_id") or edge.get("from") or ""),
            str(edge.get("target") or edge.get("target_id") or edge.get("to") or ""),
            str(edge.get("relationship") or edge.get("relationship_type") or edge.get("label") or "Linked"),
        ))

    def add_node(node: dict) -> str:
        node_id = str(node.get("id"))
        if node_id and node_id not in node_ids:
            nodes.append(node)
            node_ids.add(node_id)
        return node_id

    def add_edge(source: str, target: str, relationship: str, **extra) -> None:
        if not source or not target or source == target:
            return
        key = (str(source), str(target), str(relationship or "Linked"))
        if key in edge_keys:
            return
        edge_keys.add(key)
        edges.append({
            "id": f"EDGE::DB::{uuid.uuid4().hex[:12]}",
            "source": source,
            "target": target,
            "relationship": relationship or "Linked",
            "relationship_type": relationship or "Linked",
            **extra,
        })

    # A factual case-context hub keeps the graph connected without inventing
    # criminal relationships. CASE_PERSON / CASE_EVIDENCE / CASE_ENTITY mean
    # only "this record belongs to this FIR".
    case_node_id = add_node({
        "id": f"CASE::{case.case_id}",
        "type": "Case",
        "case_id": case.case_id,
        "fir_number": case.fir_number,
        "label": case.fir_number or case.case_id,
        "name": case.title,
        "status": case.status,
        "stage": case.stage,
    })

    # ---- existing persons in this FIR/case ----
    case_links = (
        db.query(models.CasePerson)
        .filter(models.CasePerson.case_id == case.id)
        .all()
    )
    persons_by_external = {}
    persons_by_db_id = {}
    for link in case_links:
        person = db.query(models.Person).filter(models.Person.id == link.person_id).first()
        if not person:
            continue
        node = _graph_person_node(person)
        node["role_in_case"] = link.role_in_case
        person_node_id = add_node(node)
        add_edge(
            case_node_id,
            person_node_id,
            "CASE_PERSON",
            provenance="Case-person registry",
            verification_status="Database record",
        )
        persons_by_external[str(person.person_id)] = (person, person_node_id)
        persons_by_db_id[str(person.id)] = (person, person_node_id)

        # These are factual fields already stored on the Person record. They give
        # the graph useful context even when an AI analysis has not yet been run.
        if person.phone:
            phone_id = add_node(_technical_node(
                f"PHONE::{person.person_id}",
                "Phone",
                person.phone,
                value=person.phone,
                verification_status="Database record",
            ))
            add_edge(
                person_node_id,
                phone_id,
                "HAS_PHONE",
                provenance="Database",
                verification_status="Verified",
            )
        if person.address:
            address_label = str(person.address).strip()
            if address_label:
                address_id = add_node(_technical_node(
                    f"LOCATION::{person.person_id}",
                    "Location",
                    address_label,
                    value=address_label,
                    verification_status="Database record",
                ))
                add_edge(
                    person_node_id,
                    address_id,
                    "ADDRESS_ON_RECORD",
                    provenance="Database",
                    verification_status="Verified",
                )

    # ---- extracted/verified technical entities for this case ----
    entity_rows = (
        db.query(models.IntelligenceEntity)
        .filter(models.IntelligenceEntity.case_id == case.id)
        .all()
    )
    entities_by_ref = {}
    for entity in entity_rows:
        entity_node_id = add_node(_graph_entity_node(entity))
        add_edge(
            case_node_id,
            entity_node_id,
            "CASE_ENTITY",
            provenance=entity.source or "Intelligence Entity",
            verification_status=entity.verification_status,
        )
        for key in (entity.entity_id, entity.label, entity.value, entity.id):
            if key is not None and str(key).strip():
                entities_by_ref[str(key).strip()] = (entity, entity_node_id)

        if entity.linked_person_id is not None:
            linked = persons_by_db_id.get(str(entity.linked_person_id))
            if linked:
                add_edge(
                    linked[1],
                    entity_node_id,
                    "LINKED_RECORD",
                    provenance=entity.source or "Intelligence Entity",
                    confidence=entity.confidence,
                    verification_status=entity.verification_status,
                )

    # ---- evidence already stored against this case ----
    evidence_rows = (
        db.query(models.Evidence)
        .filter(models.Evidence.case_id == case.id)
        .order_by(models.Evidence.id.asc())
        .all()
    )
    evidence_by_ref = {}
    for evidence_row in evidence_rows:
        evidence_node_id = add_node(_graph_evidence_node(evidence_row))
        add_edge(
            case_node_id,
            evidence_node_id,
            "CASE_EVIDENCE",
            provenance="Evidence register",
            verification_status="Database record",
        )
        evidence_by_ref[str(evidence_row.evidence_id)] = (evidence_row, evidence_node_id)
        evidence_by_ref[str(evidence_row.id)] = (evidence_row, evidence_node_id)

    def endpoint_node(ref_type: str, ref_value: str) -> str:
        ref_type = str(ref_type or "Entity").strip()
        ref = str(ref_value or "").strip()
        kind = ref_type.lower()

        if "person" in kind:
            found = persons_by_external.get(ref) or persons_by_db_id.get(ref)
            if found:
                return found[1]
            person = (
                db.query(models.Person)
                .filter(models.Person.person_id == ref)
                .first()
            )
            if person:
                return add_node(_graph_person_node(person))

        if "evidence" in kind:
            found = evidence_by_ref.get(ref)
            if found:
                return found[1]

        found_entity = entities_by_ref.get(ref)
        if found_entity:
            return found_entity[1]

        # Preserve a relationship even when the source table is external (CDR,
        # bank account, vehicle registry, device record, etc.). No fact is
        # invented: the label/type come directly from the stored relationship.
        safe_type = ref_type.replace(" ", "_").upper() or "ENTITY"
        return add_node(_technical_node(
            f"RELREF::{safe_type}::{ref}",
            ref_type,
            ref or ref_type,
        ))

    # ---- authoritative stored relationships for this case ----
    relationship_rows = (
        db.query(models.IntelligenceRelationship)
        .filter(models.IntelligenceRelationship.case_id == case.id)
        .order_by(models.IntelligenceRelationship.id.asc())
        .all()
    )
    for relationship_row in relationship_rows:
        source_id = endpoint_node(relationship_row.source_type, relationship_row.source_ref)
        target_id = endpoint_node(relationship_row.target_type, relationship_row.target_ref)
        add_edge(
            source_id,
            target_id,
            relationship_row.relationship_type or "Linked",
            relationship_id=relationship_row.relationship_id,
            description=relationship_row.description,
            confidence=relationship_row.confidence,
            verification_status=relationship_row.verification_status,
            provenance=relationship_row.source or relationship_row.data_origin,
        )

    result["nodes"] = nodes
    result["edges"] = edges
    result["graph_source"] = "central_case_database_plus_latest_analysis"
    return result


def append_evidence_to_latest_graph(
    db: Session,
    *,
    case: models.Case,
    evidence: models.Evidence,
    person: models.Person | None,
    officer_id: str,
    relationship_type: str,
) -> models.IntelligenceAnalysis:
    """Create a fresh full-case graph snapshot after a mobile upload."""
    result = build_case_graph_snapshot(db, case)
    result["last_mobile_sync"] = {
        "evidence_id": evidence.evidence_id,
        "at": datetime.utcnow().isoformat() + "Z",
        "officer_id": officer_id,
        "person_id": person.person_id if person else None,
    }

    analysis = models.IntelligenceAnalysis(
        case_id=case.id,
        source_type="MOBILE_EVIDENCE_SYNC",
        input_text=(
            f"Field evidence {evidence.evidence_id} uploaded from CINTRA Mobile"
            + (f" and linked to {person.person_id}." if person else ".")
        ),
        result_json=result,
        created_by=officer_id,
    )
    db.add(analysis)
    db.flush()
    return analysis


def create_relationship_records(
    db: Session,
    *,
    case: models.Case,
    person: models.Person,
    evidence: models.Evidence,
    officer_id: str,
    relationship_type: str,
) -> models.IntelligenceRelationship:
    relationship = models.IntelligenceRelationship(
        relationship_id=f"REL-MOB-{uuid.uuid4().hex[:16].upper()}",
        case_id=case.id,
        source_type="Person",
        source_ref=person.person_id,
        target_type="Evidence",
        target_ref=evidence.evidence_id,
        relationship_type=relationship_type,
        description=(
            f"Field evidence {evidence.evidence_id} uploaded from the mobile app "
            f"and linked to {person.person_id} ({person.name})."
        ),
        confidence=1.0,
        verification_status="Verified",
        source="CINTRA Mobile Field Upload",
        data_origin="Field Upload",
        synthetic=False,
        created_by=officer_id,
    )
    db.add(relationship)
    db.flush()
    db.add(
        models.RelationshipSource(
            relationship_id=relationship.id,
            evidence_id=evidence.id,
            source_type="Evidence",
            source_reference=evidence.evidence_id,
            explanation="Direct field upload linked by the submitting officer.",
            added_by=officer_id,
        )
    )
    return relationship


def _resolve_profile_image(profile_image_path: str | None):
    if not profile_image_path:
        return None
    raw = str(profile_image_path).replace("\\", "/")
    direct = Path(raw)
    if direct.is_absolute() and direct.exists():
        return direct
    if "/uploads/" in raw.lower():
        i = raw.lower().index("/uploads/")
        candidate = BACKEND_DIR / raw[i + 1:]
    else:
        candidate = BACKEND_DIR / raw.lstrip("/")
    return candidate if candidate.exists() else None


def _candidate_profile_images(person: models.Person) -> list[Path]:
    """Return usable enrollment images for a central Person record.

    Older CINTRA dumps can contain stale hashed profile_image_path values while
    the original portrait still exists under uploads/persons/<Person Name>.jpeg.
    The mobile matcher must never silently drop that person from enrollment.
    """
    person_dir = BACKEND_DIR / "uploads" / "persons"
    candidates: list[Path] = []

    resolved = _resolve_profile_image(person.profile_image_path)
    if resolved:
        candidates.append(resolved)

    for stem in (person.name, person.person_id):
        if not stem:
            continue
        for ext in (".jpeg", ".jpg", ".png", ".webp"):
            path = person_dir / f"{stem}{ext}"
            if path.exists() and path not in candidates:
                candidates.append(path)

    return candidates


def person_case_summaries(db: Session, person: models.Person) -> list[dict]:
    """Return rich existing case records linked to this person.

    The mobile database search previously returned only identity + a shallow
    case list. This now joins CasePerson, Case, legal sections and the latest
    chargesheet so the app can show FIR, offence, role, status/stage and the
    legal/chargesheet record without creating any duplicate data.
    """
    links = (
        db.query(models.CasePerson)
        .filter(models.CasePerson.person_id == person.id)
        .all()
    )
    rows = []
    for link in links:
        case = db.query(models.Case).filter(models.Case.id == link.case_id).first()
        if not case:
            continue

        latest_chargesheet = (
            db.query(models.Chargesheet)
            .filter(models.Chargesheet.case_id == case.id)
            .order_by(models.Chargesheet.prepared_at.desc(), models.Chargesheet.id.desc())
            .first()
        )

        legal_rows = (
            db.query(models.CaseLegalSection, models.LegalSection)
            .join(
                models.LegalSection,
                models.CaseLegalSection.legal_section_id == models.LegalSection.id,
            )
            .filter(models.CaseLegalSection.case_id == case.id)
            .order_by(models.CaseLegalSection.added_at.desc())
            .all()
        )
        legal_sections = [
            {
                "framework": section.framework_code,
                "section_number": section.section_number,
                "offence_name": section.offence_name,
                "status": link_row.status,
                "punishment": section.punishment,
                "rationale": link_row.rationale,
            }
            for link_row, section in legal_rows
        ]

        rows.append({
            "id": case.id,
            "case_id": case.case_id,
            "fir_number": case.fir_number,
            "title": case.title,
            "offence": case.offence,
            "offence_description": case.description,
            "police_station": case.police_station,
            "investigating_officer": case.investigating_officer,
            "registered_on": case.registered_on.isoformat() if case.registered_on else None,
            "status": case.status,
            "stage": case.stage,
            "role_in_case": link.role_in_case,
            "legal_sections": legal_sections,
            "chargesheet_id": latest_chargesheet.chargesheet_id if latest_chargesheet else None,
            "chargesheet_status": latest_chargesheet.filing_status if latest_chargesheet else None,
            "legal_provisions": latest_chargesheet.legal_provisions if latest_chargesheet else None,
            "investigation_conclusion": latest_chargesheet.conclusion if latest_chargesheet else None,
            # CINTRA currently stores chargesheet/investigation outcomes, not a
            # separate court-verdict model. Do not invent a verdict.
            "legal_outcome": latest_chargesheet.conclusion if latest_chargesheet else None,
        })
    return rows

def try_face_match(image_bytes: bytes, db: Session) -> dict | None:
    """Use YuNet + SFace against the SAME Persons records used by the website.

    A person is eligible for matching only when their central Person record has a
    profile_image_path that resolves to a local enrolled image. No mobile-only
    suspect database or deterministic fake match is used.
    """
    try:
        import cv2
        import numpy as np
    except Exception:
        return None

    yunet = MODEL_DIR / "face_detection_yunet_2023mar.onnx"
    sface = MODEL_DIR / "face_recognition_sface_2021dec.onnx"
    if not (yunet.exists() and sface.exists()):
        return None

    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    query = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if query is None:
        return {"match": False, "suspect": None, "message": "Invalid image"}

    detector = cv2.FaceDetectorYN.create(str(yunet), "", (320, 320), 0.55, 0.3, 5000)
    recognizer = cv2.FaceRecognizerSF.create(str(sface), "")

    def detect_one(image):
        detector.setInputSize((image.shape[1], image.shape[0]))
        _, faces = detector.detect(image)
        if faces is None or len(faces) == 0:
            return None
        return max(faces, key=lambda f: float(f[2] * f[3]))

    def feature(image, face):
        feat = recognizer.feature(recognizer.alignCrop(image, face)).astype(np.float32)
        norm = np.linalg.norm(feat)
        return feat / norm if norm else feat

    qface = detect_one(query)
    if qface is None:
        return {"match": False, "suspect": None, "message": "No face detected"}
    qfeat = feature(query, qface)

    scored_people = []
    enrolled_images = 0

    # Do not require profile_image_path to be valid: older DB dumps can retain
    # stale hashed paths while the actual portrait exists as <Person Name>.jpeg.
    for person in db.query(models.Person).all():
        person_best = -1.0
        for path in _candidate_profile_images(person):
            try:
                cache_key = (str(path.resolve()), path.stat().st_mtime_ns)
            except OSError:
                continue

            rfeat = _FACE_FEATURE_CACHE.get(cache_key)
            if rfeat is None:
                ref = cv2.imread(str(path))
                if ref is None:
                    continue
                rface = detect_one(ref)
                if rface is None:
                    continue
                rfeat = feature(ref, rface)
                _FACE_FEATURE_CACHE[cache_key] = rfeat

            enrolled_images += 1
            score = float(recognizer.match(qfeat, rfeat, cv2.FaceRecognizerSF_FR_COSINE))
            person_best = max(person_best, score)
        if person_best >= 0:
            scored_people.append((person_best, person))

    if not scored_people:
        return {"match": False, "suspect": None, "message": "No enrolled person photos available"}

    scored_people.sort(key=lambda item: item[0], reverse=True)
    best_score, best_person = scored_people[0]
    second_score = scored_people[1][0] if len(scored_people) > 1 else -1.0

    # SFace cosine similarities below this are not accepted as identities.
    # A close runner-up is treated as ambiguous instead of returning the wrong
    # person. This is especially important for field-camera images.
    threshold = 0.45
    ambiguity_margin = 0.06
    if best_score < threshold:
        return {
            "match": False,
            "suspect": None,
            "message": "No Match Found",
            "best_confidence": round(best_score * 100, 1),
        }
    if second_score >= threshold and (best_score - second_score) < ambiguity_margin:
        return {
            "match": False,
            "suspect": None,
            "message": "Possible matches are too similar. Capture a clearer front-facing image.",
            "best_confidence": round(best_score * 100, 1),
        }

    cases = person_case_summaries(db, best_person)
    return {
        "match": True,
        "suspect": {
            "suspect_id": best_person.person_id,
            "person_db_id": best_person.id,
            "name": best_person.name,
            "role": best_person.role,
            "status": best_person.status,
            "confidence": round(best_score * 100, 1),
            "wanted": best_person.status != "Cleared",
            "profile_image_path": best_person.profile_image_path,
            "case_ids": [case["id"] for case in cases],
            "cases": cases,
        },
        "message": "Possible Match Found — officer verification required",
    }

