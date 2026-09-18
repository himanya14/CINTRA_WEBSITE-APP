from datetime import datetime

from fastapi import (
    APIRouter,
    Depends,
    HTTPException
)
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app import models, schemas
from app.utils.security import get_current_officer
from app.services.chargesheet_service import (
    generate_chargesheet_pdf
)


router = APIRouter(
    prefix="/chargesheets",
    tags=["Chargesheets"]
)


# ---------- HELPERS ----------

def clean_text(value):
    if value is None:
        return ""

    return str(value).strip()


def format_datetime(value):
    if not value:
        return "Not recorded"

    try:
        return value.strftime(
            "%d %b %Y, %H:%M"
        )
    except Exception:
        return str(value)


def build_chargesheet_id(case):
    timestamp = datetime.now().strftime(
        "%Y%m%d-%H%M%S"
    )

    case_reference = clean_text(
        case.case_id
    ).replace(
        " ",
        "-"
    ).replace(
        "/",
        "-"
    )

    return (
        f"CS-{case_reference}-{timestamp}"
    )


def build_investigation_summary(
    case,
    person_links,
    evidence,
    diary_entries,
    relationships,
    alerts
):
    lines = []

    lines.append(
        (
            f"Investigation relates to case "
            f"{case.case_id}, FIR "
            f"{case.fir_number}, titled "
            f"'{case.title}'."
        )
    )

    if case.offence:
        lines.append(
            (
                f"The offence presently recorded "
                f"in the case file is: "
                f"{case.offence}."
            )
        )

    if case.description:
        lines.append(
            clean_text(
                case.description
            )
        )

    lines.append(
        (
            f"CINTRA currently records "
            f"{len(person_links)} person(s) "
            f"linked to this investigation, "
            f"{len(evidence)} evidence item(s), "
            f"{len(diary_entries)} case diary "
            f"entry or entries, "
            f"{len(relationships)} relationship "
            f"record(s), and "
            f"{len(alerts)} intelligence "
            f"alert(s)."
        )
    )

    if person_links:
        lines.append(
            "Persons linked to the investigation:"
        )

        for index, link in enumerate(
            person_links,
            start=1
        ):
            person = link.person

            if not person:
                continue

            person_line = (
                f"{index}. "
                f"{person.name} "
                f"({person.person_id})"
            )

            if person.role:
                person_line += (
                    f", general role: "
                    f"{person.role}"
                )

            if link.role_in_case:
                person_line += (
                    f", role in this case: "
                    f"{link.role_in_case}"
                )

            if person.status:
                person_line += (
                    f", status: "
                    f"{person.status}"
                )

            person_line += "."

            lines.append(
                person_line
            )

    if evidence:
        lines.append(
            "Evidence presently recorded:"
        )

        for index, item in enumerate(
            evidence,
            start=1
        ):
            evidence_line = (
                f"{index}. "
                f"{item.evidence_id} - "
                f"{item.title}"
            )

            if item.evidence_type:
                evidence_line += (
                    f" [{item.evidence_type}]"
                )

            if item.source:
                evidence_line += (
                    f", source: "
                    f"{item.source}"
                )

            if item.status:
                evidence_line += (
                    f", status: "
                    f"{item.status}"
                )

            evidence_line += "."

            lines.append(
                evidence_line
            )

    if diary_entries:
        lines.append(
            "Recent investigation chronology:"
        )

        ordered_entries = sorted(
            diary_entries,
            key=lambda item:
                item.created_at
                or datetime.min
        )

        for index, entry in enumerate(
            ordered_entries,
            start=1
        ):
            diary_line = (
                f"{index}. "
                f"{format_datetime(entry.created_at)} "
                f"- {clean_text(entry.entry)}"
            )

            if entry.action_taken:
                diary_line += (
                    f" Action taken: "
                    f"{clean_text(entry.action_taken)}"
                )

            diary_line += "."

            lines.append(
                diary_line
            )

    if relationships:
        lines.append(
            "Recorded relationship findings:"
        )

        for index, relation in enumerate(
            relationships,
            start=1
        ):
            relation_line = (
                f"{index}. "
                f"{relation.source_ref} "
                f"-> "
                f"{relation.target_ref}: "
                f"{relation.relationship_type}"
            )

            if relation.description:
                relation_line += (
                    f" - "
                    f"{clean_text(relation.description)}"
                )

            if relation.confidence is not None:
                confidence_value = (
                    relation.confidence
                )

                if (
                    isinstance(
                        confidence_value,
                        (int, float)
                    )
                    and confidence_value <= 1
                ):
                    confidence_value = (
                        confidence_value * 100
                    )

                relation_line += (
                    f" "
                    f"(confidence: "
                    f"{confidence_value:.0f}%)"
                )

            if relation.verification_status:
                relation_line += (
                    f", verification: "
                    f"{relation.verification_status}"
                )

            relation_line += "."

            lines.append(
                relation_line
            )

    if alerts:
        lines.append(
            "Intelligence alerts currently associated "
            "with the case:"
        )

        for index, alert in enumerate(
            alerts,
            start=1
        ):
            alert_line = (
                f"{index}. "
                f"{alert.title}"
            )

            if alert.severity:
                alert_line += (
                    f" [Severity: "
                    f"{alert.severity}]"
                )

            if alert.description:
                alert_line += (
                    f" - "
                    f"{clean_text(alert.description)}"
                )

            alert_line += "."

            lines.append(
                alert_line
            )

    lines.append(
        (
            "This draft summary is automatically "
            "assembled from records currently stored "
            "in CINTRA and must be reviewed by the "
            "investigating officer before filing."
        )
    )

    return "\n\n".join(
        lines
    )


def build_draft_conclusion(
    case,
    person_links,
    evidence,
    diary_entries,
    relationships
):
    return (
        f"Based on the investigation records currently "
        f"available in CINTRA for case "
        f"{case.case_id}, the system has assembled "
        f"{len(person_links)} linked person record(s), "
        f"{len(evidence)} evidence item(s), "
        f"{len(diary_entries)} diary entry or entries, "
        f"and {len(relationships)} recorded relationship "
        f"finding(s). "
        f"The material requires review and verification "
        f"by the investigating officer before any final "
        f"conclusion, attribution of criminal liability, "
        f"or filing decision is made."
    )


# ---------- CREATE CHARGESHEET ----------

@router.post(
    "/",
    response_model=schemas.ChargesheetResponse
)
def create_chargesheet(
    chargesheet: schemas.ChargesheetCreate,
    db: Session = Depends(get_db),
    current_officer=Depends(
        get_current_officer
    )
):
    case = db.query(
        models.Case
    ).filter(
        models.Case.id ==
        chargesheet.case_id
    ).first()

    if not case:
        raise HTTPException(
            status_code=404,
            detail="Case not found"
        )

    existing_chargesheet = db.query(
        models.Chargesheet
    ).filter(
        models.Chargesheet.chargesheet_id
        == chargesheet.chargesheet_id
    ).first()

    if existing_chargesheet:
        raise HTTPException(
            status_code=400,
            detail=(
                "Chargesheet ID already exists"
            )
        )

    chargesheet_data = (
        chargesheet.model_dump()
    )

    chargesheet_data[
        "prepared_by"
    ] = current_officer.officer_id

    new_chargesheet = (
        models.Chargesheet(
            **chargesheet_data
        )
    )

    db.add(
        new_chargesheet
    )

    db.commit()

    db.refresh(
        new_chargesheet
    )

    return new_chargesheet


# ---------- AUTO-GENERATE DRAFT CHARGESHEET ----------

@router.post(
    "/case/{case_id}/generate-draft",
    response_model=schemas.ChargesheetResponse
)
def generate_draft_chargesheet(
    case_id: int,
    db: Session = Depends(get_db),
    current_officer=Depends(
        get_current_officer
    )
):
    case = db.query(
        models.Case
    ).filter(
        models.Case.id == case_id
    ).first()

    if not case:
        raise HTTPException(
            status_code=404,
            detail="Case not found"
        )

    person_links = db.query(
        models.CasePerson
    ).filter(
        models.CasePerson.case_id ==
        case_id
    ).all()

    evidence = db.query(
        models.Evidence
    ).filter(
        models.Evidence.case_id ==
        case_id
    ).order_by(
        models.Evidence.uploaded_at.asc()
    ).all()

    diary_entries = db.query(
        models.CaseDiary
    ).filter(
        models.CaseDiary.case_id ==
        case_id
    ).order_by(
        models.CaseDiary.created_at.asc()
    ).all()

    relationships = db.query(
        models.IntelligenceRelationship
    ).filter(
        models.IntelligenceRelationship.case_id
        == case_id
    ).order_by(
        models.IntelligenceRelationship.created_at.asc()
    ).all()

    alerts = db.query(
        models.IntelligenceAlert
    ).filter(
        models.IntelligenceAlert.case_id
        == case_id
    ).order_by(
        models.IntelligenceAlert.created_at.asc()
    ).all()

    investigation_summary = (
        build_investigation_summary(
            case=case,
            person_links=person_links,
            evidence=evidence,
            diary_entries=diary_entries,
            relationships=relationships,
            alerts=alerts
        )
    )

    conclusion = (
        build_draft_conclusion(
            case=case,
            person_links=person_links,
            evidence=evidence,
            diary_entries=diary_entries,
            relationships=relationships
        )
    )

    existing_draft = db.query(
        models.Chargesheet
    ).filter(
        models.Chargesheet.case_id ==
        case_id,
        models.Chargesheet.filing_status
        == "Draft"
    ).order_by(
        models.Chargesheet.prepared_at.desc()
    ).first()

    if existing_draft:
        existing_draft.investigation_summary = (
            investigation_summary
        )

        existing_draft.conclusion = (
            conclusion
        )

        existing_draft.prepared_by = (
            current_officer.officer_id
        )

        if not clean_text(
            existing_draft.legal_provisions
        ):
            existing_draft.legal_provisions = (
                "Pending legal review. "
                f"Offence recorded in the case: "
                f"{case.offence}."
            )

        existing_draft.generated_pdf_path = (
            None
        )

        db.commit()

        db.refresh(
            existing_draft
        )

        return existing_draft

    chargesheet_id = (
        build_chargesheet_id(
            case
        )
    )

    new_chargesheet = models.Chargesheet(
        chargesheet_id=chargesheet_id,
        case_id=case_id,
        legal_provisions=(
            "Pending legal review. "
            f"Offence recorded in the case: "
            f"{case.offence}."
        ),
        investigation_summary=(
            investigation_summary
        ),
        conclusion=conclusion,
        filing_status="Draft",
        prepared_by=(
            current_officer.officer_id
        )
    )

    db.add(
        new_chargesheet
    )

    db.commit()

    db.refresh(
        new_chargesheet
    )

    return new_chargesheet


# ---------- GET ALL CHARGESHEETS ----------

@router.get(
    "/",
    response_model=List[
        schemas.ChargesheetResponse
    ]
)
def get_chargesheets(
    db: Session = Depends(get_db),
    current_officer=Depends(
        get_current_officer
    )
):
    return db.query(
        models.Chargesheet
    ).order_by(
        models.Chargesheet.prepared_at.desc()
    ).all()


# ---------- GET CHARGESHEETS BY CASE ----------

@router.get(
    "/case/{case_id}",
    response_model=List[
        schemas.ChargesheetResponse
    ]
)
def get_chargesheets_by_case(
    case_id: int,
    db: Session = Depends(get_db),
    current_officer=Depends(
        get_current_officer
    )
):
    case = db.query(
        models.Case
    ).filter(
        models.Case.id == case_id
    ).first()

    if not case:
        raise HTTPException(
            status_code=404,
            detail="Case not found"
        )

    return db.query(
        models.Chargesheet
    ).filter(
        models.Chargesheet.case_id ==
        case_id
    ).order_by(
        models.Chargesheet.prepared_at.desc()
    ).all()


# ---------- GENERATE CHARGESHEET PDF ----------

@router.post(
    "/{chargesheet_id}/generate-pdf",
    response_model=schemas.ChargesheetResponse
)
def generate_pdf(
    chargesheet_id: int,
    db: Session = Depends(get_db),
    current_officer=Depends(
        get_current_officer
    )
):
    chargesheet = db.query(
        models.Chargesheet
    ).filter(
        models.Chargesheet.id ==
        chargesheet_id
    ).first()

    if not chargesheet:
        raise HTTPException(
            status_code=404,
            detail="Chargesheet not found"
        )

    case = db.query(
        models.Case
    ).filter(
        models.Case.id ==
        chargesheet.case_id
    ).first()

    if not case:
        raise HTTPException(
            status_code=404,
            detail="Case not found"
        )

    persons = db.query(
        models.CasePerson
    ).filter(
        models.CasePerson.case_id ==
        case.id
    ).all()

    evidence = db.query(
        models.Evidence
    ).filter(
        models.Evidence.case_id ==
        case.id
    ).all()

    file_path = (
        generate_chargesheet_pdf(
            chargesheet=chargesheet,
            case=case,
            persons=persons,
            evidence=evidence
        )
    )

    chargesheet.generated_pdf_path = (
        file_path
    )

    db.commit()

    db.refresh(
        chargesheet
    )

    return chargesheet


# ---------- GET ONE CHARGESHEET ----------

@router.get(
    "/{chargesheet_id}",
    response_model=schemas.ChargesheetResponse
)
def get_chargesheet(
    chargesheet_id: int,
    db: Session = Depends(get_db),
    current_officer=Depends(
        get_current_officer
    )
):
    chargesheet = db.query(
        models.Chargesheet
    ).filter(
        models.Chargesheet.id ==
        chargesheet_id
    ).first()

    if not chargesheet:
        raise HTTPException(
            status_code=404,
            detail="Chargesheet not found"
        )

    return chargesheet


# ---------- UPDATE CHARGESHEET ----------

@router.put(
    "/{chargesheet_id}",
    response_model=schemas.ChargesheetResponse
)
def update_chargesheet(
    chargesheet_id: int,
    chargesheet_data:
        schemas.ChargesheetUpdate,
    db: Session = Depends(get_db),
    current_officer=Depends(
        get_current_officer
    )
):
    chargesheet = db.query(
        models.Chargesheet
    ).filter(
        models.Chargesheet.id ==
        chargesheet_id
    ).first()

    if not chargesheet:
        raise HTTPException(
            status_code=404,
            detail="Chargesheet not found"
        )

    update_data = (
        chargesheet_data.model_dump(
            exclude_unset=True
        )
    )

    update_data.pop(
        "prepared_by",
        None
    )

    for key, value in (
        update_data.items()
    ):
        setattr(
            chargesheet,
            key,
            value
        )

    db.commit()

    db.refresh(
        chargesheet
    )

    return chargesheet