import hashlib
from pathlib import Path
from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    Text,
    ForeignKey,
    Float,
    Boolean,
    JSON,
    event,
    inspect as sqlalchemy_inspect
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


# ---------- CASE ----------

class Case(Base):
    __tablename__ = "cases"

    id = Column(Integer, primary_key=True, index=True)

    case_id = Column(String, unique=True, nullable=False)
    fir_number = Column(String, unique=True, nullable=False)

    title = Column(String, nullable=False)
    offence = Column(String, nullable=False)

    police_station = Column(String, nullable=False)
    investigating_officer = Column(String, nullable=False)

    stage = Column(String, default="Under Investigation")
    status = Column(String, default="Active")

    description = Column(Text, nullable=True)

    data_origin = Column(
        String,
        default="Synthetic Demo Data"
    )

    synthetic = Column(
        Boolean,
        default=True
    )

    source_reference = Column(
        Text,
        nullable=True
    )

    registered_on = Column(
        DateTime,
        server_default=func.now()
    )

    last_updated = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now()
    )

    persons = relationship(
        "CasePerson",
        back_populates="case",
        cascade="all, delete-orphan"
    )

    evidence = relationship(
        "Evidence",
        back_populates="case",
        cascade="all, delete-orphan"
    )

    diary_entries = relationship(
        "CaseDiary",
        back_populates="case",
        cascade="all, delete-orphan"
    )

    chargesheets = relationship(
        "Chargesheet",
        back_populates="case",
        cascade="all, delete-orphan"
    )

    scans = relationship(
        "Scan",
        back_populates="case"
    )

    intelligence_entities = relationship(
        "IntelligenceEntity",
        back_populates="case"
    )

    intelligence_relationships = relationship(
        "IntelligenceRelationship",
        back_populates="case"
    )

    intelligence_analyses = relationship(
        "IntelligenceAnalysis",
        back_populates="case",
        cascade="all, delete-orphan"
    )

    intelligence_alerts = relationship(
        "IntelligenceAlert",
        back_populates="case",
        cascade="all, delete-orphan"
    )


# ---------- PERSON ----------

class Person(Base):
    __tablename__ = "persons"

    id = Column(Integer, primary_key=True, index=True)

    person_id = Column(
        String,
        unique=True,
        nullable=False
    )

    name = Column(String, nullable=False)
    age = Column(Integer, nullable=True)
    gender = Column(String, nullable=True)

    phone = Column(String, nullable=True)
    address = Column(Text, nullable=True)

    role = Column(String, nullable=False)

    status = Column(
        String,
        default="Under Investigation"
    )

    profile_image_path = Column(
        String,
        nullable=True
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )

    cases = relationship(
        "CasePerson",
        back_populates="person",
        cascade="all, delete-orphan"
    )

    scans = relationship(
        "Scan",
        back_populates="matched_person"
    )

    intelligence_entities = relationship(
        "IntelligenceEntity",
        back_populates="linked_person"
    )


# ---------- CASE-PERSON LINK ----------

class CasePerson(Base):
    __tablename__ = "case_persons"

    id = Column(Integer, primary_key=True, index=True)

    case_id = Column(
        Integer,
        ForeignKey("cases.id"),
        nullable=False
    )

    person_id = Column(
        Integer,
        ForeignKey("persons.id"),
        nullable=False
    )

    role_in_case = Column(
        String,
        nullable=False
    )

    case = relationship(
        "Case",
        back_populates="persons"
    )

    person = relationship(
        "Person",
        back_populates="cases"
    )


# ---------- EVIDENCE ----------

class Evidence(Base):
    __tablename__ = "evidence"

    id = Column(Integer, primary_key=True, index=True)

    evidence_id = Column(
        String,
        unique=True,
        nullable=False
    )

    case_id = Column(
        Integer,
        ForeignKey("cases.id"),
        nullable=False
    )

    title = Column(String, nullable=False)

    evidence_type = Column(
        String,
        nullable=False
    )

    description = Column(
        Text,
        nullable=True
    )

    file_path = Column(
        String,
        nullable=True
    )

    sha256_hash = Column(
        String(64),
        nullable=True
    )

    source = Column(
        String,
        nullable=True
    )

    collected_by = Column(
        String,
        nullable=False
    )

    collected_at = Column(
        DateTime,
        nullable=True
    )

    status = Column(
        String,
        default="Collected"
    )

    uploaded_at = Column(
        DateTime,
        server_default=func.now()
    )

    case = relationship(
        "Case",
        back_populates="evidence"
    )


# ---------- EVIDENCE HASHING ----------

def _resolve_evidence_file_path(file_path):
    """
    Resolve an Evidence.file_path value to the actual file on disk.

    Supports:
    - full Windows/POSIX paths
    - /uploads/evidence/<file>
    - uploads/evidence/<file>
    """

    if not file_path:
        return None

    raw = str(file_path).strip()

    if not raw:
        return None

    direct_path = Path(raw)

    if direct_path.is_absolute() and direct_path.exists():
        return direct_path

    normalized = raw.replace("\\", "/")

    if "/uploads/" in normalized.lower():
        lower_value = normalized.lower()
        uploads_index = lower_value.index("/uploads/")
        relative_path = normalized[uploads_index + 1:]
    else:
        relative_path = normalized.lstrip("/")

    backend_root = (
        Path(__file__)
        .resolve()
        .parent
        .parent
    )

    candidate = (
        backend_root /
        relative_path
    )

    if candidate.exists():
        return candidate

    return None


def _calculate_evidence_sha256(file_path):
    resolved_path = (
        _resolve_evidence_file_path(
            file_path
        )
    )

    if resolved_path is None:
        return None

    digest = hashlib.sha256()

    with resolved_path.open("rb") as evidence_file:
        while True:
            chunk = evidence_file.read(
                1024 * 1024
            )

            if not chunk:
                break

            digest.update(chunk)

    return digest.hexdigest()


@event.listens_for(
    Evidence,
    "before_insert"
)
def _set_evidence_hash_before_insert(
    mapper,
    connection,
    target
):
    """
    When new evidence is inserted, establish its official
    SHA-256 baseline from the actual stored file.
    """

    if (
        target.file_path
        and not target.sha256_hash
    ):
        target.sha256_hash = (
            _calculate_evidence_sha256(
                target.file_path
            )
        )


@event.listens_for(
    Evidence,
    "before_update"
)
def _refresh_evidence_hash_when_file_changes(
    mapper,
    connection,
    target
):
    """
    If the official evidence file is replaced, create a new
    baseline hash for the replacement. Metadata-only edits do
    not overwrite the existing baseline hash.
    """

    state = sqlalchemy_inspect(
        target
    )

    file_path_history = (
        state.attrs.file_path.history
    )

    if file_path_history.has_changes():
        target.sha256_hash = (
            _calculate_evidence_sha256(
                target.file_path
            )
        )


# ---------- CASE DIARY ----------

class CaseDiary(Base):
    __tablename__ = "case_diary"

    id = Column(Integer, primary_key=True, index=True)

    case_id = Column(
        Integer,
        ForeignKey("cases.id"),
        nullable=False
    )

    officer_id = Column(
        String,
        nullable=False
    )

    entry = Column(
        Text,
        nullable=False
    )

    action_taken = Column(
        Text,
        nullable=True
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )

    case = relationship(
        "Case",
        back_populates="diary_entries"
    )


# ---------- OFFICER ----------

class Officer(Base):
    __tablename__ = "officers"

    id = Column(Integer, primary_key=True, index=True)

    officer_id = Column(
        String,
        unique=True,
        nullable=False,
        index=True
    )

    name = Column(
        String,
        nullable=False
    )

    designation = Column(
        String,
        nullable=False
    )

    police_station = Column(
        String,
        nullable=False
    )

    email = Column(
        String,
        unique=True,
        nullable=True
    )

    phone = Column(
        String,
        nullable=True
    )

    hashed_password = Column(
        String,
        nullable=False
    )

    status = Column(
        String,
        default="Active"
    )

    # ========================================================
    # PHASE 1 — SECURITY
    # ========================================================

    system_role = Column(
        String(50),
        default="INVESTIGATOR",
        nullable=False
    )

    mfa_enabled = Column(
        Boolean,
        default=False,
        nullable=False
    )

    mfa_secret = Column(
        String(255),
        nullable=True
    )

    failed_login_attempts = Column(
        Integer,
        default=0,
        nullable=False
    )

    locked_until = Column(
        DateTime,
        nullable=True
    )

    password_changed_at = Column(
        DateTime,
        nullable=True
    )

    last_login_at = Column(
        DateTime,
        nullable=True
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )


# ---------- CHARGESHEET ----------

class Chargesheet(Base):
    __tablename__ = "chargesheets"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    chargesheet_id = Column(
        String,
        unique=True,
        nullable=False,
        index=True
    )

    case_id = Column(
        Integer,
        ForeignKey("cases.id"),
        nullable=False
    )

    legal_provisions = Column(
        Text,
        nullable=True
    )

    investigation_summary = Column(
        Text,
        nullable=True
    )

    conclusion = Column(
        Text,
        nullable=True
    )

    filing_status = Column(
        String,
        default="Draft"
    )

    prepared_by = Column(
        String,
        nullable=False
    )

    prepared_at = Column(
        DateTime,
        server_default=func.now()
    )

    generated_pdf_path = Column(
        String,
        nullable=True
    )

    case = relationship(
        "Case",
        back_populates="chargesheets"
    )


# ---------- FACE SCAN ----------

class Scan(Base):
    __tablename__ = "scans"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    scan_id = Column(
        String,
        unique=True,
        nullable=False,
        index=True
    )

    case_id = Column(
        Integer,
        ForeignKey("cases.id"),
        nullable=True
    )

    image_path = Column(
        String,
        nullable=False
    )

    matched_person_id = Column(
        Integer,
        ForeignKey("persons.id"),
        nullable=True
    )

    confidence = Column(
        Float,
        nullable=True
    )

    match_status = Column(
        String,
        default="Pending"
    )

    verification_status = Column(
        String,
        default="Unverified"
    )

    source = Column(
        String,
        nullable=True
    )

    device_id = Column(
        String,
        nullable=True
    )

    officer_id = Column(
        String,
        nullable=False
    )

    scanned_at = Column(
        DateTime,
        server_default=func.now()
    )

    case = relationship(
        "Case",
        back_populates="scans"
    )

    matched_person = relationship(
        "Person",
        back_populates="scans"
    )


# ---------- INTELLIGENCE ENTITY ----------

class IntelligenceEntity(Base):
    __tablename__ = "intelligence_entities"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    entity_id = Column(
        String,
        unique=True,
        nullable=False,
        index=True
    )

    case_id = Column(
        Integer,
        ForeignKey("cases.id"),
        nullable=True
    )

    linked_person_id = Column(
        Integer,
        ForeignKey("persons.id"),
        nullable=True
    )

    entity_type = Column(
        String,
        nullable=False
    )

    label = Column(
        String,
        nullable=False
    )

    value = Column(
        String,
        nullable=True
    )

    description = Column(
        Text,
        nullable=True
    )

    source = Column(
        String,
        nullable=True
    )

    confidence = Column(
        Float,
        nullable=True
    )

    verification_status = Column(
        String,
        default="Unverified"
    )

    data_origin = Column(
        String,
        default="Synthetic"
    )

    synthetic = Column(
        Boolean,
        default=True
    )

    created_by = Column(
        String,
        nullable=False
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )

    case = relationship(
        "Case",
        back_populates="intelligence_entities"
    )

    linked_person = relationship(
        "Person",
        back_populates="intelligence_entities"
    )


# ---------- INTELLIGENCE RELATIONSHIP ----------

class IntelligenceRelationship(Base):
    __tablename__ = "intelligence_relationships"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    relationship_id = Column(
        String,
        unique=True,
        nullable=False,
        index=True
    )

    case_id = Column(
        Integer,
        ForeignKey("cases.id"),
        nullable=True
    )

    source_type = Column(
        String,
        nullable=False
    )

    source_ref = Column(
        String,
        nullable=False
    )

    target_type = Column(
        String,
        nullable=False
    )

    target_ref = Column(
        String,
        nullable=False
    )

    relationship_type = Column(
        String,
        nullable=False
    )

    description = Column(
        Text,
        nullable=True
    )

    confidence = Column(
        Float,
        nullable=True
    )

    verification_status = Column(
        String,
        default="Unverified"
    )

    source = Column(
        String,
        nullable=True
    )

    data_origin = Column(
        String,
        default="Synthetic"
    )

    synthetic = Column(
        Boolean,
        default=True
    )

    created_by = Column(
        String,
        nullable=False
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )

    case = relationship(
        "Case",
        back_populates="intelligence_relationships"
    )


# ---------- INTELLIGENCE ANALYSIS ----------

class IntelligenceAnalysis(Base):
    __tablename__ = "intelligence_analyses"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    case_id = Column(
        Integer,
        ForeignKey("cases.id"),
        nullable=False,
        index=True
    )

    source_type = Column(
        String,
        default="FIR",
        nullable=False
    )

    input_text = Column(
        Text,
        nullable=False
    )

    result_json = Column(
        JSON,
        nullable=False
    )

    created_by = Column(
        String,
        nullable=False
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )

    case = relationship(
        "Case",
        back_populates="intelligence_analyses"
    )

    alerts = relationship(
        "IntelligenceAlert",
        back_populates="analysis",
        cascade="all, delete-orphan"
    )


# ---------- INTELLIGENCE ALERT ----------

class IntelligenceAlert(Base):
    __tablename__ = "intelligence_alerts"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    case_id = Column(
        Integer,
        ForeignKey("cases.id"),
        nullable=False,
        index=True
    )

    analysis_id = Column(
        Integer,
        ForeignKey("intelligence_analyses.id"),
        nullable=False,
        index=True
    )

    alert_type = Column(
        String,
        nullable=False
    )

    title = Column(
        String,
        nullable=False
    )

    description = Column(
        Text,
        nullable=True
    )

    severity = Column(
        String,
        default="Medium",
        nullable=False
    )

    status = Column(
        String,
        default="Open",
        nullable=False
    )

    created_by = Column(
        String,
        nullable=False
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )

    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now()
    )

    case = relationship(
        "Case",
        back_populates="intelligence_alerts"
    )

    analysis = relationship(
        "IntelligenceAnalysis",
        back_populates="alerts"
    )


# ============================================================
# PHASE 1 — SECURITY MODELS
# ============================================================


# ---------- APPROVED DEVICE ----------

class ApprovedDevice(Base):
    __tablename__ = "approved_devices"

    id = Column(Integer, primary_key=True, index=True)

    device_id = Column(
        String(255),
        unique=True,
        nullable=False,
        index=True
    )

    device_name = Column(
        String(255),
        nullable=True
    )

    station = Column(
        String(255),
        nullable=True
    )

    status = Column(
        String(50),
        default="Active",
        nullable=False
    )

    is_approved = Column(
        Boolean,
        default=False,
        nullable=False
    )

    approved_by = Column(
        String(100),
        nullable=True
    )

    approved_at = Column(
        DateTime,
        nullable=True
    )

    last_seen_at = Column(
        DateTime,
        nullable=True
    )

    created_at = Column(
        DateTime,
        server_default=func.now(),
        nullable=False
    )


# ---------- OFFICER SESSION ----------

class OfficerSession(Base):
    __tablename__ = "officer_sessions"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    session_id = Column(
        String(255),
        unique=True,
        nullable=False,
        index=True
    )

    officer_id = Column(
        String(100),
        nullable=False,
        index=True
    )

    device_id = Column(
        String(255),
        nullable=True
    )

    refresh_token_hash = Column(
        String(255),
        nullable=True
    )

    ip_address = Column(
        String(100),
        nullable=True
    )

    user_agent = Column(
        Text,
        nullable=True
    )

    is_active = Column(
        Boolean,
        default=True,
        nullable=False
    )

    created_at = Column(
        DateTime,
        server_default=func.now(),
        nullable=False
    )

    expires_at = Column(
        DateTime,
        nullable=True
    )

    last_activity_at = Column(
        DateTime,
        server_default=func.now(),
        nullable=False
    )

    revoked_at = Column(
        DateTime,
        nullable=True
    )


# ---------- AUDIT LOG ----------

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    officer_id = Column(
        String(100),
        nullable=True,
        index=True
    )

    action = Column(
        String(150),
        nullable=False,
        index=True
    )

    resource_type = Column(
        String(100),
        nullable=True
    )

    resource_id = Column(
        String(255),
        nullable=True
    )

    description = Column(
        Text,
        nullable=True
    )

    ip_address = Column(
        String(100),
        nullable=True
    )

    device_id = Column(
        String(255),
        nullable=True
    )

    success = Column(
        Boolean,
        default=True,
        nullable=False
    )

    created_at = Column(
        DateTime,
        server_default=func.now(),
        nullable=False,
        index=True
    )


# ---------- MFA CHALLENGE ----------

class MFAChallenge(Base):
    __tablename__ = "mfa_challenges"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    challenge_token = Column(
        String(255),
        unique=True,
        nullable=False,
        index=True
    )

    officer_id = Column(
        String(100),
        nullable=False,
        index=True
    )

    device_id = Column(
        String(255),
        nullable=True
    )

    expires_at = Column(
        DateTime,
        nullable=False
    )

    used = Column(
        Boolean,
        default=False,
        nullable=False
    )

    created_at = Column(
        DateTime,
        server_default=func.now(),
        nullable=False
    )


# ---------- FORENSIC ASSIGNMENT ----------

class ForensicAssignment(Base):
    __tablename__ = "forensic_assignments"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    case_id = Column(
        Integer,
        ForeignKey("cases.id"),
        nullable=False,
        index=True
    )

    evidence_id = Column(
        Integer,
        ForeignKey("evidence.id"),
        nullable=True,
        index=True
    )

    assigned_to = Column(
        String,
        ForeignKey("officers.officer_id"),
        nullable=False,
        index=True
    )

    assigned_by = Column(
        String,
        ForeignKey("officers.officer_id"),
        nullable=False
    )

    examination_type = Column(
        String,
        nullable=False
    )

    instructions = Column(
        Text,
        nullable=True
    )

    priority = Column(
        String,
        default="Normal",
        nullable=False
    )

    status = Column(
        String,
        default="Assigned",
        nullable=False
    )

    assigned_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    started_at = Column(
        DateTime,
        nullable=True
    )

    completed_at = Column(
        DateTime,
        nullable=True
    )

    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )
# ============================================================
# CINTRA EXPANDED INVESTIGATION MODELS
# Added for legal/master data, provenance, timeline and
# cross-case intelligence without altering existing tables.
# ============================================================

class MasterDataItem(Base):
    __tablename__ = "master_data_items"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String(80), nullable=False, index=True)
    code = Column(String(80), nullable=False, index=True)
    label = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    metadata_json = Column(JSON, nullable=True)
    active = Column(Boolean, default=True, nullable=False)
    created_by = Column(String(80), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class LegalFramework(Base):
    __tablename__ = "legal_frameworks"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(40), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    effective_from = Column(DateTime, nullable=True)
    effective_to = Column(DateTime, nullable=True)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class LegalSection(Base):
    __tablename__ = "legal_sections"

    id = Column(Integer, primary_key=True, index=True)
    framework_code = Column(String(40), nullable=False, index=True)
    section_number = Column(String(80), nullable=False, index=True)
    offence_name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    punishment = Column(Text, nullable=True)
    bailability = Column(String(80), nullable=True)
    cognizability = Column(String(80), nullable=True)
    legacy_reference = Column(String(255), nullable=True)
    source_reference = Column(Text, nullable=True)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class CaseLegalSection(Base):
    __tablename__ = "case_legal_sections"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False, index=True)
    legal_section_id = Column(Integer, ForeignKey("legal_sections.id"), nullable=False, index=True)
    status = Column(String(40), default="Confirmed", nullable=False)
    rationale = Column(Text, nullable=True)
    added_by = Column(String(80), nullable=False)
    added_at = Column(DateTime, server_default=func.now())
    reviewed_by = Column(String(80), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)


class EntityIdentifier(Base):
    __tablename__ = "entity_identifiers"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False, index=True)
    person_id = Column(Integer, ForeignKey("persons.id"), nullable=True, index=True)
    evidence_id = Column(Integer, ForeignKey("evidence.id"), nullable=True, index=True)
    entity_id = Column(Integer, ForeignKey("intelligence_entities.id"), nullable=True, index=True)
    identifier_type = Column(String(50), nullable=False, index=True)
    raw_value = Column(String(500), nullable=False)
    normalized_value = Column(String(500), nullable=False, index=True)
    source = Column(String(255), nullable=True)
    verified = Column(Boolean, default=False, nullable=False)
    created_by = Column(String(80), nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class CrossCaseMatch(Base):
    __tablename__ = "cross_case_matches"

    id = Column(Integer, primary_key=True, index=True)
    identifier_type = Column(String(50), nullable=False, index=True)
    normalized_value = Column(String(500), nullable=False, index=True)
    case_a_id = Column(Integer, ForeignKey("cases.id"), nullable=False, index=True)
    case_b_id = Column(Integer, ForeignKey("cases.id"), nullable=False, index=True)
    confidence = Column(Float, nullable=True)
    status = Column(String(40), default="Pending Review", nullable=False)
    rationale = Column(Text, nullable=True)
    supporting_json = Column(JSON, nullable=True)
    reviewed_by = Column(String(80), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class RelationshipSource(Base):
    __tablename__ = "relationship_sources"

    id = Column(Integer, primary_key=True, index=True)
    relationship_id = Column(Integer, ForeignKey("intelligence_relationships.id"), nullable=False, index=True)
    evidence_id = Column(Integer, ForeignKey("evidence.id"), nullable=True, index=True)
    source_type = Column(String(80), default="Evidence", nullable=False)
    source_reference = Column(String(255), nullable=True)
    explanation = Column(Text, nullable=True)
    added_by = Column(String(80), nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class TimelineEvent(Base):
    __tablename__ = "timeline_events"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False, index=True)
    event_type = Column(String(80), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    event_at = Column(DateTime, nullable=False, index=True)
    source_type = Column(String(80), nullable=True)
    source_id = Column(String(120), nullable=True)
    evidence_id = Column(Integer, ForeignKey("evidence.id"), nullable=True, index=True)
    officer_id = Column(String(80), nullable=True)
    confidence = Column(Float, nullable=True)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class ChainOfCustodyEvent(Base):
    __tablename__ = "chain_of_custody_events"

    id = Column(Integer, primary_key=True, index=True)
    evidence_id = Column(Integer, ForeignKey("evidence.id"), nullable=False, index=True)
    action = Column(String(80), nullable=False)
    from_officer = Column(String(80), nullable=True)
    to_officer = Column(String(80), nullable=True)
    location = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    recorded_by = Column(String(80), nullable=False)
    recorded_at = Column(DateTime, server_default=func.now(), index=True)


class IntelligenceLead(Base):
    __tablename__ = "intelligence_leads"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False, index=True)
    lead_type = Column(String(80), nullable=False)
    title = Column(String(255), nullable=False)
    explanation = Column(Text, nullable=False)
    supporting_json = Column(JSON, nullable=True)
    confidence = Column(Float, nullable=True)
    verification_status = Column(String(40), default="Pending", nullable=False)
    created_by = Column(String(80), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    reviewed_by = Column(String(80), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)


class DocumentRecord(Base):
    __tablename__ = "document_records"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False, index=True)
    document_type = Column(String(80), nullable=False, index=True)
    document_reference = Column(String(120), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    file_path = Column(Text, nullable=True)
    sha256_hash = Column(String(64), nullable=True)
    status = Column(String(40), default="Recorded", nullable=False)
    metadata_json = Column(JSON, nullable=True)
    created_by = Column(String(80), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

# ============================================================
# SECURE EVIDENCE STORAGE / LEDGER RECEIPTS
# New tables only: safe to create alongside the existing CINTRA schema.
# ============================================================

class EvidenceSecurity(Base):
    __tablename__ = "evidence_security"

    id = Column(Integer, primary_key=True, index=True)
    evidence_db_id = Column(Integer, ForeignKey("evidence.id"), unique=True, nullable=False, index=True)
    evidence_code = Column(String(120), unique=True, nullable=False, index=True)
    original_filename = Column(String(255), nullable=False)
    mime_type = Column(String(160), nullable=True)
    size_bytes = Column(Integer, nullable=True)
    original_sha256 = Column(String(64), nullable=False, index=True)
    encryption_algorithm = Column(String(40), default="AES-256-GCM", nullable=False)
    encrypted_path = Column(Text, nullable=False)
    integrity_status = Column(String(40), default="VERIFIED", nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class CustodyLedgerReceipt(Base):
    __tablename__ = "custody_ledger_receipts"

    id = Column(Integer, primary_key=True, index=True)
    custody_event_id = Column(Integer, ForeignKey("chain_of_custody_events.id"), unique=True, nullable=False, index=True)
    evidence_db_id = Column(Integer, ForeignKey("evidence.id"), nullable=False, index=True)
    blockchain_status = Column(String(40), default="DISABLED", nullable=False)
    blockchain_tx_id = Column(String(160), nullable=True)
    gateway_error = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
