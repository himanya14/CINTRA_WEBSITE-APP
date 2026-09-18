from __future__ import annotations

from datetime import datetime
from typing import Iterable

from sqlalchemy.orm import Session

from app import models


OFFICIAL_SOURCE_NOTE = (
    "Reference data is maintained for investigation support. "
    "A provision is not treated as applicable until confirmed by an authorized officer."
)

# Carefully limited reference set for the demo.  The mapping engine only proposes
# sections represented here; it never invents section numbers.
LEGAL_REFERENCE = [
    {
        "framework": "BNS",
        "section": "61",
        "offence": "Criminal conspiracy",
        "description": "Agreement to commit an illegal act or a legal act by illegal means.",
        "legacy": "Legacy IPC 120A/120B",
        "keywords": ["criminal conspiracy", "conspiracy", "coordinated", "concert", "network coordination"],
    },
    {
        "framework": "BNS",
        "section": "303",
        "offence": "Theft",
        "description": "Theft-related provision under the Bharatiya Nyaya Sanhita, 2023.",
        "legacy": "Legacy IPC 378/379",
        "keywords": ["theft", "stolen property", "stolen vehicle", "dishonest taking"],
    },
    {
        "framework": "BNS",
        "section": "316",
        "offence": "Criminal breach of trust",
        "description": "Criminal breach of trust provisions.",
        "legacy": "Legacy IPC 405/406",
        "keywords": ["breach of trust", "entrusted funds", "entrusted property", "misappropriation"],
    },
    {
        "framework": "BNS",
        "section": "318",
        "offence": "Cheating",
        "description": "Cheating and related dishonest inducement.",
        "legacy": "Legacy IPC 415/420",
        "keywords": ["cheating", "fraud", "dishonest inducement", "financial deception", "digital fraud"],
    },
    {
        "framework": "BNS",
        "section": "319",
        "offence": "Cheating by personation",
        "description": "Cheating by pretending to be another person or substituting one person for another.",
        "legacy": "Legacy IPC 416/419",
        "keywords": ["impersonation", "personation", "fake identity", "identity misuse"],
    },
    {
        "framework": "BNS",
        "section": "336",
        "offence": "Forgery",
        "description": "Making a false document or false electronic record with fraudulent or injurious intent.",
        "legacy": "Legacy IPC forgery provisions",
        "keywords": ["forgery", "forged", "false document", "false electronic record", "altered document", "document misuse"],
    },
    {
        "framework": "IPC",
        "section": "420",
        "offence": "Cheating and dishonestly inducing delivery of property",
        "description": "Legacy IPC reference for historical matters.",
        "legacy": "Current-law cross-reference: BNS 318",
        "keywords": [],
    },
    {
        "framework": "IPC",
        "section": "120B",
        "offence": "Criminal conspiracy",
        "description": "Legacy IPC reference for historical matters.",
        "legacy": "Current-law cross-reference: BNS 61",
        "keywords": [],
    },
    {
        "framework": "IT_ACT",
        "section": "66C",
        "offence": "Identity theft",
        "description": "Punishment for identity theft under the Information Technology Act, 2000.",
        "legacy": None,
        "keywords": ["identity theft", "password misuse", "credential misuse", "electronic identity"],
    },
    {
        "framework": "IT_ACT",
        "section": "66D",
        "offence": "Cheating by personation using computer resource",
        "description": "Cheating by personation by using a communication device or computer resource.",
        "legacy": None,
        "keywords": ["phishing", "online impersonation", "computer resource", "digital personation", "cyber fraud"],
    },
    {
        "framework": "PMLA",
        "section": "3",
        "offence": "Offence of money-laundering",
        "description": "Reference provision for proceeds-of-crime investigations under the Prevention of Money Laundering Act, 2002.",
        "legacy": None,
        "keywords": ["money laundering", "proceeds of crime", "layered transfers", "layering of funds"],
    },
    {
        "framework": "NDPS",
        "section": "20",
        "offence": "Contravention in relation to cannabis plant and cannabis",
        "description": "Reference provision under the Narcotic Drugs and Psychotropic Substances Act, 1985.",
        "legacy": None,
        "keywords": ["cannabis", "charas", "ganja"],
    },
    {
        "framework": "ARMS_ACT",
        "section": "25",
        "offence": "Punishment for certain offences",
        "description": "Reference provision under the Arms Act, 1959.",
        "legacy": None,
        "keywords": ["illegal firearm", "unauthorised firearm", "unlicensed weapon", "arms act"],
    },
]

FRAMEWORKS = [
    ("BNS", "Bharatiya Nyaya Sanhita, 2023"),
    ("IPC", "Indian Penal Code, 1860 (Legacy)"),
    ("BNSS", "Bharatiya Nagarik Suraksha Sanhita, 2023"),
    ("BSA", "Bharatiya Sakshya Adhiniyam, 2023"),
    ("IT_ACT", "Information Technology Act, 2000"),
    ("PMLA", "Prevention of Money Laundering Act, 2002"),
    ("NDPS", "Narcotic Drugs and Psychotropic Substances Act, 1985"),
    ("ARMS_ACT", "Arms Act, 1959"),
]


def ensure_legal_master(db: Session) -> None:
    for code, name in FRAMEWORKS:
        row = db.query(models.LegalFramework).filter(models.LegalFramework.code == code).first()
        if row is None:
            db.add(models.LegalFramework(code=code, name=name, description=OFFICIAL_SOURCE_NOTE))
    db.flush()

    for item in LEGAL_REFERENCE:
        row = db.query(models.LegalSection).filter(
            models.LegalSection.framework_code == item["framework"],
            models.LegalSection.section_number == item["section"],
        ).first()
        if row is None:
            row = models.LegalSection(
                framework_code=item["framework"],
                section_number=item["section"],
                offence_name=item["offence"],
                description=item["description"],
                legacy_reference=item["legacy"],
                source_reference=OFFICIAL_SOURCE_NOTE,
                active=True,
            )
            db.add(row)
        else:
            # Keep officer/admin edits intact except for empty reference fields.
            if not row.legacy_reference and item["legacy"]:
                row.legacy_reference = item["legacy"]
            if not row.source_reference:
                row.source_reference = OFFICIAL_SOURCE_NOTE
    db.flush()


def _officer_id(officer) -> str:
    return (
        getattr(officer, "officer_id", None)
        or (officer.get("officer_id") if isinstance(officer, dict) else None)
        or "SYSTEM"
    )


def _case_text(case) -> str:
    return " ".join(
        str(value or "")
        for value in [getattr(case, "title", None), getattr(case, "offence", None), getattr(case, "description", None)]
    ).lower()


def candidate_sections_for_text(db: Session, text: str) -> list[tuple[models.LegalSection, list[str]]]:
    ensure_legal_master(db)
    lowered = (text or "").lower()
    selected: list[tuple[models.LegalSection, list[str]]] = []
    used: set[tuple[str, str]] = set()

    for definition in LEGAL_REFERENCE:
        keywords = definition.get("keywords") or []
        matched = [kw for kw in keywords if kw in lowered]
        if not matched:
            continue
        key = (definition["framework"], definition["section"])
        if key in used:
            continue
        section = db.query(models.LegalSection).filter(
            models.LegalSection.framework_code == key[0],
            models.LegalSection.section_number == key[1],
        ).first()
        if section:
            selected.append((section, matched))
            used.add(key)

    # Contextual rules: cyber/online + ordinary fraud should add IT Act 66D,
    # but only when the case text explicitly contains a digital/computer cue.
    digital_cues = ["cyber", "online", "computer", "digital", "electronic", "phishing", "otp"]
    fraud_cues = ["fraud", "cheating", "impersonation", "personation", "identity"]
    if any(x in lowered for x in digital_cues) and any(x in lowered for x in fraud_cues):
        section = db.query(models.LegalSection).filter(
            models.LegalSection.framework_code == "IT_ACT",
            models.LegalSection.section_number == "66D",
        ).first()
        if section and ("IT_ACT", "66D") not in used:
            selected.append((section, ["digital/computer-enabled deception"])); used.add(("IT_ACT", "66D"))

    if any(x in lowered for x in ["identity", "credential", "password"]) and any(x in lowered for x in digital_cues):
        section = db.query(models.LegalSection).filter(
            models.LegalSection.framework_code == "IT_ACT",
            models.LegalSection.section_number == "66C",
        ).first()
        if section and ("IT_ACT", "66C") not in used:
            selected.append((section, ["digital identity/credential misuse"])); used.add(("IT_ACT", "66C"))

    return selected


def suggest_legal_provisions(db: Session, case, officer=None, source_note: str = "Case narrative") -> list[models.CaseLegalSection]:
    """Create PENDING REVIEW case-section rows from the case narrative.

    The function is idempotent and never confirms a provision automatically.
    """
    ensure_legal_master(db)
    suggestions = candidate_sections_for_text(db, _case_text(case))
    created: list[models.CaseLegalSection] = []
    actor = _officer_id(officer)

    for section, matched_keywords in suggestions:
        existing = db.query(models.CaseLegalSection).filter(
            models.CaseLegalSection.case_id == case.id,
            models.CaseLegalSection.legal_section_id == section.id,
        ).first()
        if existing:
            continue
        rationale = (
            f"Potential legal provision surfaced from {source_note}. "
            f"Matched indicator(s): {', '.join(sorted(set(matched_keywords)))}. "
            "Officer confirmation is required before this provision can appear as confirmed in a chargesheet."
        )
        link = models.CaseLegalSection(
            case_id=case.id,
            legal_section_id=section.id,
            status="Candidate",
            rationale=rationale,
            added_by=actor,
        )
        db.add(link)
        created.append(link)

    db.flush()
    return created


def review_case_legal_section(db: Session, link: models.CaseLegalSection, status: str, officer) -> models.CaseLegalSection:
    normalized = (status or "").strip().lower()
    if normalized not in {"confirmed", "rejected"}:
        raise ValueError("Status must be Confirmed or Rejected")
    link.status = "Confirmed" if normalized == "confirmed" else "Rejected"
    link.reviewed_by = _officer_id(officer)
    link.reviewed_at = datetime.utcnow()
    db.flush()
    return link


def confirmed_case_legal_sections(db: Session, case_id: int):
    return db.query(models.CaseLegalSection, models.LegalSection).join(
        models.LegalSection,
        models.CaseLegalSection.legal_section_id == models.LegalSection.id,
    ).filter(
        models.CaseLegalSection.case_id == case_id,
        models.CaseLegalSection.status == "Confirmed",
    ).order_by(models.LegalSection.framework_code, models.LegalSection.section_number).all()
