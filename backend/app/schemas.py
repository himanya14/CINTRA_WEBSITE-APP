from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from typing import Optional, Any, Dict


# ---------- CASES ----------

class CaseCreate(BaseModel):
    case_id: str
    fir_number: str
    title: str
    offence: str
    police_station: str
    investigating_officer: str
    stage: Optional[str] = "Under Investigation"
    status: Optional[str] = "Active"
    description: Optional[str] = None

    data_origin: Optional[str] = "Synthetic Demo Data"
    synthetic: Optional[bool] = True
    source_reference: Optional[str] = None


class CaseUpdate(BaseModel):
    title: Optional[str] = None
    offence: Optional[str] = None
    police_station: Optional[str] = None
    investigating_officer: Optional[str] = None
    stage: Optional[str] = None
    status: Optional[str] = None
    description: Optional[str] = None

    data_origin: Optional[str] = None
    synthetic: Optional[bool] = None
    source_reference: Optional[str] = None


class CaseResponse(BaseModel):
    id: int

    case_id: str
    fir_number: str
    title: str
    offence: str
    police_station: str
    investigating_officer: str

    stage: str
    status: str
    description: Optional[str] = None

    data_origin: str
    synthetic: bool
    source_reference: Optional[str] = None

    registered_on: datetime
    last_updated: datetime

    class Config:
        from_attributes = True


# ---------- PERSONS ----------

class PersonCreate(BaseModel):
    person_id: str
    name: str
    age: Optional[int] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    role: str
    status: Optional[str] = "Under Investigation"
    profile_image_path: Optional[str] = None


class PersonResponse(PersonCreate):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class PersonCaseMembershipResponse(BaseModel):
    case_database_id: int
    case_id: str
    fir_number: str
    title: str
    offence: str
    police_station: str
    investigating_officer: str
    stage: str
    status: str
    registered_on: datetime
    role_in_case: str


class PersonDetailResponse(PersonResponse):
    associated_cases: list[PersonCaseMembershipResponse] = Field(default_factory=list)
    # Evidence linked to this person through CINTRA relationship intelligence.
    # The existing Persons UI already renders this as "Documents & Records".
    documents: list[Dict[str, Any]] = Field(default_factory=list)


# ---------- CASE-PERSON LINK ----------

class CasePersonCreate(BaseModel):
    case_id: int
    person_id: int
    role_in_case: str


class CasePersonResponse(CasePersonCreate):
    id: int

    class Config:
        from_attributes = True


# ---------- EVIDENCE ----------

class EvidenceCreate(BaseModel):
    evidence_id: str
    case_id: int
    title: str
    evidence_type: str
    description: Optional[str] = None
    file_path: Optional[str] = None
    source: Optional[str] = None
    collected_at: Optional[datetime] = None
    status: Optional[str] = "Collected"


class EvidenceResponse(EvidenceCreate):
    id: int
    collected_by: str
    uploaded_at: datetime
    sha256_hash: Optional[str] = None

    class Config:
        from_attributes = True


# ---------- CASE DIARY ----------

class CaseDiaryCreate(BaseModel):
    case_id: int
    entry: str
    action_taken: Optional[str] = None


class CaseDiaryResponse(CaseDiaryCreate):
    id: int
    officer_id: str
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- AUTH ----------

class OfficerRegister(BaseModel):
    officer_id: str
    name: str
    designation: str
    police_station: str
    email: Optional[str] = None
    phone: Optional[str] = None
    password: str
    system_role: Optional[str] = "INVESTIGATOR"


class OfficerResponse(BaseModel):
    id: int
    officer_id: str
    name: str
    designation: str
    police_station: str
    email: Optional[str] = None
    phone: Optional[str] = None

    status: str
    system_role: str

    mfa_enabled: bool
    failed_login_attempts: int

    last_login_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class OfficerLogin(BaseModel):
    officer_id: str
    password: str


# ---------- CHARGESHEET ----------

class ChargesheetCreate(BaseModel):
    chargesheet_id: str
    case_id: int
    legal_provisions: Optional[str] = None
    investigation_summary: Optional[str] = None
    conclusion: Optional[str] = None
    filing_status: Optional[str] = "Draft"


class ChargesheetUpdate(BaseModel):
    legal_provisions: Optional[str] = None
    investigation_summary: Optional[str] = None
    conclusion: Optional[str] = None
    filing_status: Optional[str] = None


class ChargesheetResponse(BaseModel):
    id: int
    chargesheet_id: str
    case_id: int
    legal_provisions: Optional[str] = None
    investigation_summary: Optional[str] = None
    conclusion: Optional[str] = None
    filing_status: str
    prepared_by: str
    prepared_at: datetime
    generated_pdf_path: Optional[str] = None

    class Config:
        from_attributes = True


# ---------- SCANS ----------

class ScanCreate(BaseModel):
    scan_id: str
    case_id: Optional[int] = None
    image_path: str
    matched_person_id: Optional[int] = None
    confidence: Optional[float] = None
    match_status: Optional[str] = "Pending"
    verification_status: Optional[str] = "Unverified"
    source: Optional[str] = None
    device_id: Optional[str] = None


class ScanUpdate(BaseModel):
    matched_person_id: Optional[int] = None
    confidence: Optional[float] = None
    match_status: Optional[str] = None
    verification_status: Optional[str] = None
    source: Optional[str] = None
    device_id: Optional[str] = None


class ScanResponse(BaseModel):
    id: int
    scan_id: str
    case_id: Optional[int] = None
    image_path: str
    matched_person_id: Optional[int] = None
    confidence: Optional[float] = None
    match_status: str
    verification_status: str
    source: Optional[str] = None
    device_id: Optional[str] = None
    officer_id: str
    scanned_at: datetime

    class Config:
        from_attributes = True


# ---------- INTELLIGENCE ENTITIES ----------

class IntelligenceEntityCreate(BaseModel):
    entity_id: str
    case_id: Optional[int] = None
    linked_person_id: Optional[int] = None
    entity_type: str
    label: str
    value: Optional[str] = None
    description: Optional[str] = None
    source: Optional[str] = None
    confidence: Optional[float] = None
    verification_status: Optional[str] = "Unverified"
    data_origin: Optional[str] = "Synthetic"
    synthetic: Optional[bool] = True


class IntelligenceEntityUpdate(BaseModel):
    case_id: Optional[int] = None
    linked_person_id: Optional[int] = None
    entity_type: Optional[str] = None
    label: Optional[str] = None
    value: Optional[str] = None
    description: Optional[str] = None
    source: Optional[str] = None
    confidence: Optional[float] = None
    verification_status: Optional[str] = None
    data_origin: Optional[str] = None
    synthetic: Optional[bool] = None


class IntelligenceEntityResponse(BaseModel):
    id: int
    entity_id: str
    case_id: Optional[int] = None
    linked_person_id: Optional[int] = None
    entity_type: str
    label: str
    value: Optional[str] = None
    description: Optional[str] = None
    source: Optional[str] = None
    confidence: Optional[float] = None
    verification_status: str
    data_origin: str
    synthetic: bool
    created_by: str
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- INTELLIGENCE RELATIONSHIPS ----------

class IntelligenceRelationshipCreate(BaseModel):
    relationship_id: str
    case_id: Optional[int] = None
    source_type: str
    source_ref: str
    target_type: str
    target_ref: str
    relationship_type: str
    description: Optional[str] = None
    confidence: Optional[float] = None
    verification_status: Optional[str] = "Unverified"
    source: Optional[str] = None
    data_origin: Optional[str] = "Synthetic"
    synthetic: Optional[bool] = True


class IntelligenceRelationshipUpdate(BaseModel):
    case_id: Optional[int] = None
    source_type: Optional[str] = None
    source_ref: Optional[str] = None
    target_type: Optional[str] = None
    target_ref: Optional[str] = None
    relationship_type: Optional[str] = None
    description: Optional[str] = None
    confidence: Optional[float] = None
    verification_status: Optional[str] = None
    source: Optional[str] = None
    data_origin: Optional[str] = None
    synthetic: Optional[bool] = None


class IntelligenceRelationshipResponse(BaseModel):
    id: int
    relationship_id: str
    case_id: Optional[int] = None
    source_type: str
    source_ref: str
    target_type: str
    target_ref: str
    relationship_type: str
    description: Optional[str] = None
    confidence: Optional[float] = None
    verification_status: str
    source: Optional[str] = None
    data_origin: str
    synthetic: bool
    created_by: str
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- INTELLIGENCE ANALYSIS ----------

class IntelligenceAnalysisRequest(BaseModel):
    case_id: Optional[int] = None
    text: str
    source_type: Optional[str] = "FIR"


class IntelligenceAnalysisResponse(BaseModel):
    id: int
    case_id: int
    source_type: str
    input_text: str
    result_json: Dict[str, Any]
    created_by: str
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- INTELLIGENCE ALERTS ----------

class IntelligenceAlertUpdate(BaseModel):
    status: Optional[str] = None
    severity: Optional[str] = None


class IntelligenceAlertResponse(BaseModel):
    id: int
    case_id: int
    analysis_id: int
    alert_type: str
    title: str
    description: Optional[str] = None
    severity: str
    status: str
    created_by: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# ============================================================
# PHASE 1 — SECURITY SCHEMAS
# ============================================================


class MFAVerifyRequest(BaseModel):
    challenge_token: str
    code: str
    device_id: Optional[str] = None


class MFASetupVerifyRequest(BaseModel):
    challenge_token: str
    code: str
    device_id: Optional[str] = None


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str


class DeviceRegisterRequest(BaseModel):
    device_id: str
    device_name: Optional[str] = None
    station: Optional[str] = None


class DeviceApprovalRequest(BaseModel):
    approved: bool


class RoleUpdateRequest(BaseModel):
    system_role: str


class ApprovedDeviceResponse(BaseModel):
    id: int
    device_id: str
    device_name: Optional[str] = None
    station: Optional[str] = None
    status: str
    is_approved: bool
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    last_seen_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogResponse(BaseModel):
    id: int
    officer_id: Optional[str] = None
    action: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    description: Optional[str] = None
    ip_address: Optional[str] = None
    device_id: Optional[str] = None
    success: bool
    created_at: datetime

    class Config:
        from_attributes = True

# ============================================================
# BATCH 5 — SYSTEM ADMINISTRATION
# ============================================================


class AdminOfficerCreateRequest(BaseModel):
    officer_id: str
    name: str
    designation: str
    police_station: str
    email: Optional[str] = None
    phone: Optional[str] = None
    password: str
    system_role: str = "INVESTIGATOR"


class OfficerStatusUpdateRequest(BaseModel):
    active: bool


class AdminOfficerResponse(BaseModel):
    id: int
    officer_id: str
    name: str
    designation: str
    police_station: str
    email: Optional[str] = None
    phone: Optional[str] = None
    status: str
    system_role: str
    mfa_enabled: bool
    failed_login_attempts: int
    last_login_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class OfficerSessionResponse(BaseModel):
    id: int
    session_id: str
    officer_id: str
    device_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    is_active: bool
    created_at: datetime
    last_seen_at: Optional[datetime] = None
    revoked_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MFAResetResponse(BaseModel):
    message: str
    officer_id: str
    mfa_enabled: bool


class SessionRevokeResponse(BaseModel):
    message: str
    revoked_sessions: int
# ============================================================
# FORENSIC ASSIGNMENTS
# ============================================================

class ForensicAssignmentCreate(BaseModel):
    case_id: int
    evidence_id: Optional[int] = None
    assigned_to: str
    examination_type: str
    instructions: Optional[str] = None
    priority: str = "Normal"


class ForensicAssignmentStatusUpdate(BaseModel):
    status: str


class ForensicAssignmentResponse(BaseModel):
    id: int
    case_id: int
    evidence_id: Optional[int] = None

    assigned_to: str
    assigned_by: str

    examination_type: str
    instructions: Optional[str] = None

    priority: str
    status: str

    assigned_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )
# ============================================================
# CINTRA EXPANDED INVESTIGATION SCHEMAS
# ============================================================

class MasterDataCreate(BaseModel):
    category: str
    code: str
    label: str
    description: Optional[str] = None
    metadata_json: Optional[Dict[str, Any]] = None
    active: bool = True


class MasterDataResponse(MasterDataCreate):
    id: int
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class LegalSectionCreate(BaseModel):
    framework_code: str
    section_number: str
    offence_name: str
    description: Optional[str] = None
    punishment: Optional[str] = None
    bailability: Optional[str] = None
    cognizability: Optional[str] = None
    legacy_reference: Optional[str] = None
    source_reference: Optional[str] = None
    active: bool = True


class LegalSectionResponse(LegalSectionCreate):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class CaseLegalSectionCreate(BaseModel):
    legal_section_id: int
    status: str = "Confirmed"
    rationale: Optional[str] = None


class CaseLegalSectionResponse(BaseModel):
    id: int
    case_id: int
    legal_section_id: int
    status: str
    rationale: Optional[str] = None
    added_by: str
    added_at: datetime
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class EntityIdentifierCreate(BaseModel):
    case_id: int
    person_id: Optional[int] = None
    evidence_id: Optional[int] = None
    entity_id: Optional[int] = None
    identifier_type: str
    raw_value: str
    source: Optional[str] = None
    verified: bool = False


class TimelineEventCreate(BaseModel):
    case_id: int
    event_type: str
    title: str
    description: Optional[str] = None
    event_at: datetime
    source_type: Optional[str] = None
    source_id: Optional[str] = None
    evidence_id: Optional[int] = None
    confidence: Optional[float] = None
    metadata_json: Optional[Dict[str, Any]] = None


class TimelineEventResponse(TimelineEventCreate):
    id: int
    officer_id: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class CustodyEventCreate(BaseModel):
    action: str
    from_officer: Optional[str] = None
    to_officer: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None


class IntelligenceLeadReview(BaseModel):
    status: str


class RelationshipReviewRequest(BaseModel):
    status: str
    explanation: Optional[str] = None


class RelationshipSourceCreate(BaseModel):
    evidence_id: Optional[int] = None
    source_type: str = "Evidence"
    source_reference: Optional[str] = None
    explanation: Optional[str] = None
