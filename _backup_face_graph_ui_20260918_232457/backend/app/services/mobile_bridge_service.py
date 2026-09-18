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


def append_evidence_to_latest_graph(
    db: Session,
    *,
    case: models.Case,
    evidence: models.Evidence,
    person: models.Person | None,
    officer_id: str,
    relationship_type: str,
) -> models.IntelligenceAnalysis:
    """Create a new latest analysis snapshot with the uploaded evidence node.

    RelationshipAnalysis.jsx reads the most recent saved IntelligenceAnalysis,
    so using a new immutable snapshot makes the mobile sync visible without
    mutating/losing the prior graph.
    """
    latest = (
        db.query(models.IntelligenceAnalysis)
        .filter(models.IntelligenceAnalysis.case_id == case.id)
        .order_by(models.IntelligenceAnalysis.created_at.desc(), models.IntelligenceAnalysis.id.desc())
        .first()
    )

    result = copy.deepcopy(latest.result_json if latest and isinstance(latest.result_json, dict) else {})
    nodes = list(result.get("nodes") or [])
    edges = list(result.get("edges") or [])

    def has_node(node_id: str) -> bool:
        return any(str(n.get("id")) == node_id for n in nodes if isinstance(n, dict))

    evidence_node = _graph_evidence_node(evidence)
    if not has_node(evidence_node["id"]):
        nodes.append(evidence_node)

    if person:
        person_node = _graph_person_node(person)
        if not has_node(person_node["id"]):
            nodes.append(person_node)
        edge_key = (person_node["id"], evidence_node["id"], relationship_type)
        existing_edge = any(
            isinstance(e, dict)
            and str(e.get("source")) == edge_key[0]
            and str(e.get("target")) == edge_key[1]
            and str(e.get("relationship") or e.get("relationship_type")) == edge_key[2]
            for e in edges
        )
        if not existing_edge:
            edges.append(
                {
                    "id": f"EDGE::MOBILE::{uuid.uuid4().hex[:12]}",
                    "source": person_node["id"],
                    "target": evidence_node["id"],
                    "relationship": relationship_type,
                    "relationship_type": relationship_type,
                    "provenance": "Verified",
                    "supporting_evidence": [evidence.evidence_id],
                }
            )

    result["nodes"] = nodes
    result["edges"] = edges
    result["last_mobile_sync"] = {
        "evidence_id": evidence.evidence_id,
        "at": datetime.utcnow().isoformat() + "Z",
        "officer_id": officer_id,
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

    best_person = None
    best_score = -1.0
    enrolled = 0
    for person in db.query(models.Person).filter(models.Person.profile_image_path.isnot(None)).all():
        path = _resolve_profile_image(person.profile_image_path)
        if not path:
            continue
        ref = cv2.imread(str(path))
        if ref is None:
            continue
        rface = detect_one(ref)
        if rface is None:
            continue
        enrolled += 1
        rfeat = feature(ref, rface)
        score = float(recognizer.match(qfeat, rfeat, cv2.FaceRecognizerSF_FR_COSINE))
        if score > best_score:
            best_score = score
            best_person = person

    if enrolled == 0:
        return {"match": False, "suspect": None, "message": "No enrolled person photos available"}

    threshold = 0.40
    if not best_person or best_score < threshold:
        return {"match": False, "suspect": None, "message": "No Match Found"}

    return {
        "match": True,
        "suspect": {
            "suspect_id": best_person.person_id,
            "person_db_id": best_person.id,
            "name": best_person.name,
            "role": best_person.role,
            "confidence": round(best_score * 100, 1),
            "wanted": best_person.status != "Cleared",
            "profile_image_path": best_person.profile_image_path,
        },
        "message": "Possible Match Found",
    }

