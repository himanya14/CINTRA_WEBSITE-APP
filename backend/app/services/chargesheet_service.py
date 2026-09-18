from __future__ import annotations

from datetime import datetime
from html import escape
from pathlib import Path
import uuid
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Flowable,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app import models


BASE_DIR = Path(__file__).resolve().parents[2]
GENERATED_DIR = BASE_DIR / "uploads" / "generated"
GENERATED_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Dynamic database document builder
# ---------------------------------------------------------------------------

def _iso(value):
    return value.isoformat() if value is not None else None


def _officer_payload(officer):
    if not officer:
        return None
    return {
        "officer_id": officer.officer_id,
        "name": officer.name,
        "designation": officer.designation,
        "police_station": officer.police_station,
        "email": officer.email,
        "phone": officer.phone,
        "status": officer.status,
        "system_role": officer.system_role,
    }


def _find_officer(db: Session, value: str | None):
    if not value:
        return None
    return (
        db.query(models.Officer)
        .filter(
            or_(
                func.lower(models.Officer.officer_id) == str(value).lower(),
                func.lower(models.Officer.name) == str(value).lower(),
            )
        )
        .first()
    )


def build_chargesheet_document(db: Session, case_id: int) -> dict[str, Any]:
    """Build the complete chargesheet from persisted CINTRA records only.

    Nothing in this function invents an accused, legal section, officer,
    evidence item, chronology event, hash, custody status, or legal outcome.
    Missing data is returned as null/empty collections so the UI can show that
    it has not yet been recorded.
    """

    case = db.query(models.Case).filter(models.Case.id == case_id).first()
    if not case:
        raise ValueError("Case not found")

    chargesheet = (
        db.query(models.Chargesheet)
        .filter(models.Chargesheet.case_id == case_id)
        .order_by(models.Chargesheet.prepared_at.desc(), models.Chargesheet.id.desc())
        .first()
    )

    case_links = (
        db.query(models.CasePerson)
        .filter(models.CasePerson.case_id == case_id)
        .order_by(models.CasePerson.id.asc())
        .all()
    )

    persons = []
    for link in case_links:
        person = link.person
        if not person:
            continue
        persons.append(
            {
                "database_id": person.id,
                "person_id": person.person_id,
                "name": person.name,
                "age": person.age,
                "gender": person.gender,
                "phone": person.phone,
                "address": person.address,
                "master_role": person.role,
                "role_in_case": link.role_in_case,
                "status": person.status,
                "profile_image_path": person.profile_image_path,
            }
        )

    evidence_rows = (
        db.query(models.Evidence)
        .filter(models.Evidence.case_id == case_id)
        .order_by(
            models.Evidence.collected_at.asc().nullslast(),
            models.Evidence.uploaded_at.asc(),
            models.Evidence.id.asc(),
        )
        .all()
    )

    evidence_ids = [row.id for row in evidence_rows]

    security_by_evidence = {}
    custody_by_evidence = {}

    if evidence_ids:
        security_rows = (
            db.query(models.EvidenceSecurity)
            .filter(models.EvidenceSecurity.evidence_db_id.in_(evidence_ids))
            .all()
        )
        security_by_evidence = {row.evidence_db_id: row for row in security_rows}

        custody_rows = (
            db.query(models.ChainOfCustodyEvent)
            .filter(models.ChainOfCustodyEvent.evidence_id.in_(evidence_ids))
            .order_by(
                models.ChainOfCustodyEvent.evidence_id.asc(),
                models.ChainOfCustodyEvent.recorded_at.desc(),
                models.ChainOfCustodyEvent.id.desc(),
            )
            .all()
        )
        for row in custody_rows:
            custody_by_evidence.setdefault(row.evidence_id, row)

    evidence = []
    for item in evidence_rows:
        security = security_by_evidence.get(item.id)
        custody = custody_by_evidence.get(item.id)
        evidence.append(
            {
                "database_id": item.id,
                "evidence_id": item.evidence_id,
                "title": item.title,
                "evidence_type": item.evidence_type,
                "description": item.description,
                "file_path": item.file_path,
                "source": item.source,
                "collected_by": item.collected_by,
                "collected_at": _iso(item.collected_at),
                "uploaded_at": _iso(item.uploaded_at),
                "status": item.status,
                "sha256": (
                    security.original_sha256
                    if security
                    else item.sha256_hash
                ),
                "integrity_status": (
                    security.integrity_status if security else None
                ),
                "encryption_algorithm": (
                    security.encryption_algorithm if security else None
                ),
                "latest_custody": (
                    {
                        "action": custody.action,
                        "from_officer": custody.from_officer,
                        "to_officer": custody.to_officer,
                        "location": custody.location,
                        "notes": custody.notes,
                        "recorded_by": custody.recorded_by,
                        "recorded_at": _iso(custody.recorded_at),
                    }
                    if custody
                    else None
                ),
            }
        )

    legal_rows = (
        db.query(models.CaseLegalSection, models.LegalSection)
        .join(
            models.LegalSection,
            models.CaseLegalSection.legal_section_id == models.LegalSection.id,
        )
        .filter(
            models.CaseLegalSection.case_id == case_id,
            func.lower(models.CaseLegalSection.status) == "confirmed",
        )
        .order_by(models.CaseLegalSection.added_at.asc(), models.CaseLegalSection.id.asc())
        .all()
    )

    legal_provisions = []
    for mapping, section in legal_rows:
        legal_provisions.append(
            {
                "mapping_id": mapping.id,
                "framework_code": section.framework_code,
                "section_number": section.section_number,
                "offence_name": section.offence_name,
                "description": section.description,
                "punishment": section.punishment,
                "bailability": section.bailability,
                "cognizability": section.cognizability,
                "legacy_reference": section.legacy_reference,
                "rationale": mapping.rationale,
                "status": mapping.status,
                "added_by": mapping.added_by,
                "added_at": _iso(mapping.added_at),
                "reviewed_by": mapping.reviewed_by,
                "reviewed_at": _iso(mapping.reviewed_at),
            }
        )

    chronology_rows = (
        db.query(models.TimelineEvent)
        .filter(models.TimelineEvent.case_id == case_id)
        .order_by(models.TimelineEvent.event_at.asc(), models.TimelineEvent.id.asc())
        .all()
    )

    chronology = [
        {
            "id": row.id,
            "event_type": row.event_type,
            "title": row.title,
            "description": row.description,
            "event_at": _iso(row.event_at),
            "source_type": row.source_type,
            "source_id": row.source_id,
            "evidence_id": row.evidence_id,
            "officer_id": row.officer_id,
            "confidence": row.confidence,
            "metadata": row.metadata_json,
        }
        for row in chronology_rows
    ]

    prepared_officer = _find_officer(
        db,
        chargesheet.prepared_by if chargesheet else None,
    )
    investigating_officer = _find_officer(db, case.investigating_officer)

    filing_status = chargesheet.filing_status if chargesheet else None
    status_key = str(filing_status or "").strip().lower()
    verified = status_key in {"verified", "approved", "filed", "final", "forwarded"}

    return {
        "case": {
            "database_id": case.id,
            "case_id": case.case_id,
            "fir_number": case.fir_number,
            "title": case.title,
            "offence": case.offence,
            "police_station": case.police_station,
            "investigating_officer": case.investigating_officer,
            "stage": case.stage,
            "status": case.status,
            "description": case.description,
            "data_origin": case.data_origin,
            "synthetic": case.synthetic,
            "source_reference": case.source_reference,
            "registered_on": _iso(case.registered_on),
            "last_updated": _iso(case.last_updated),
        },
        "chargesheet": (
            {
                "id": chargesheet.id,
                "chargesheet_id": chargesheet.chargesheet_id,
                "case_id": chargesheet.case_id,
                "legal_provisions_text": chargesheet.legal_provisions,
                "investigation_summary": chargesheet.investigation_summary,
                "conclusion": chargesheet.conclusion,
                "filing_status": chargesheet.filing_status,
                "prepared_by": chargesheet.prepared_by,
                "prepared_at": _iso(chargesheet.prepared_at),
                "generated_pdf_path": chargesheet.generated_pdf_path,
            }
            if chargesheet
            else None
        ),
        "persons": persons,
        "accused": [
            p
            for p in persons
            if any(
                token in str(p.get("role_in_case") or "").lower()
                for token in ("accused", "suspect")
            )
        ],
        "evidence": evidence,
        "legal_provisions": legal_provisions,
        "chronology": chronology,
        "prepared_officer": _officer_payload(prepared_officer),
        "investigating_officer_record": _officer_payload(investigating_officer),
        "verification": {
            "filing_status": filing_status,
            "verified": verified,
            # There is no verified_by field in the current chargesheets table.
            # Deliberately do not invent an officer identity here.
            "verified_by": None,
        },
    }


# ---------------------------------------------------------------------------
# PDF helpers
# ---------------------------------------------------------------------------

PAPER = colors.HexColor("#FAF2DF")
BORDER = colors.HexColor("#BBA980")
TEXT = colors.HexColor("#17130C")
MUTED = colors.HexColor("#6D5B43")
SEAL = colors.HexColor("#A81B1B")
NAVY = colors.HexColor("#1C2F69")


def _safe(value, empty="Not recorded"):
    if value is None:
        return empty
    value = str(value).strip()
    return value if value else empty


def _paragraph_text(value):
    return escape(_safe(value)).replace("\n", "<br/>")


def _date(value):
    if value is None:
        return "Not recorded"
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except Exception:
            return value
    if hasattr(value, "strftime"):
        return value.strftime("%d %b %Y %H:%M")
    return str(value)


class StatusSeal(Flowable):
    """A visual seal whose text comes from database filing status."""

    def __init__(self, text: str):
        super().__init__()
        self.width = 42 * mm
        self.height = 42 * mm
        self.text = (text or "STATUS NOT RECORDED").upper()[:24]

    def draw(self):
        c = self.canv
        cx = self.width / 2
        cy = self.height / 2
        r = 17 * mm
        c.saveState()
        c.setStrokeColor(SEAL)
        c.setFillColor(SEAL)
        c.setLineWidth(1.5)
        c.circle(cx, cy, r, stroke=1, fill=0)
        c.setLineWidth(0.7)
        c.circle(cx, cy, r - 2.5 * mm, stroke=1, fill=0)
        c.setFont("Helvetica-Bold", 8)
        c.drawCentredString(cx, cy + 3 * mm, self.text)
        c.setFont("Helvetica", 6)
        c.drawCentredString(cx, cy - 2 * mm, "CINTRA • DOCUMENT STATUS")
        c.restoreState()


def _page_frame(canvas, doc):
    width, height = A4
    canvas.saveState()
    canvas.setFillColor(PAPER)
    canvas.rect(0, 0, width, height, fill=1, stroke=0)
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.7)
    canvas.rect(8 * mm, 8 * mm, width - 16 * mm, height - 16 * mm, fill=0, stroke=1)
    canvas.setLineWidth(0.3)
    canvas.rect(11 * mm, 11 * mm, width - 22 * mm, height - 22 * mm, fill=0, stroke=1)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 6.5)
    canvas.drawCentredString(width / 2, 7 * mm, "COMPUTER GENERATED COPY • CINTRA INVESTIGATION RECORD")
    canvas.restoreState()


def _table(rows, widths=None, header=False):
    table = Table(rows, colWidths=widths, repeatRows=1 if header else 0)
    style = [
        ("GRID", (0, 0), (-1, -1), 0.35, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("TEXTCOLOR", (0, 0), (-1, -1), TEXT),
        ("BACKGROUND", (0, 0), (-1, -1), PAPER),
    ]
    if header:
        style.extend(
            [
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EFE6D2")),
            ]
        )
    table.setStyle(TableStyle(style))
    return table


def generate_chargesheet_pdf(document_data: dict[str, Any]) -> str:
    chargesheet = document_data.get("chargesheet")
    if not chargesheet:
        raise ValueError("No chargesheet record exists for this case")

    case = document_data["case"]
    persons = document_data["persons"]
    evidence = document_data["evidence"]
    legal = document_data["legal_provisions"]
    chronology = document_data["chronology"]
    prepared_officer = document_data.get("prepared_officer")
    verification = document_data.get("verification") or {}

    filename = f"{chargesheet['chargesheet_id']}_{uuid.uuid4().hex[:8]}.pdf"
    physical_file_path = GENERATED_DIR / filename

    doc = SimpleDocTemplate(
        str(physical_file_path),
        pagesize=A4,
        rightMargin=17 * mm,
        leftMargin=17 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title=f"Chargesheet {chargesheet['chargesheet_id']}",
        author=(prepared_officer or {}).get("name") or chargesheet.get("prepared_by"),
    )

    styles = getSampleStyleSheet()
    title = ParagraphStyle(
        "CintraTitle",
        parent=styles["Title"],
        fontName="Times-Bold",
        fontSize=18,
        leading=20,
        alignment=TA_CENTER,
        textColor=TEXT,
        spaceAfter=2,
    )
    subtitle = ParagraphStyle(
        "CintraSubtitle",
        parent=styles["Normal"],
        fontName="Times-Roman",
        fontSize=8.5,
        leading=11,
        alignment=TA_CENTER,
        textColor=MUTED,
        spaceAfter=10,
    )
    heading = ParagraphStyle(
        "CintraHeading",
        parent=styles["Heading2"],
        fontName="Times-Bold",
        fontSize=10,
        leading=12,
        textColor=TEXT,
        spaceBefore=9,
        spaceAfter=5,
    )
    body = ParagraphStyle(
        "CintraBody",
        parent=styles["BodyText"],
        fontName="Times-Roman",
        fontSize=8.5,
        leading=12,
        textColor=TEXT,
        alignment=TA_LEFT,
    )
    small = ParagraphStyle(
        "CintraSmall",
        parent=body,
        fontSize=7,
        leading=9,
    )

    story = [
        Paragraph("CHARGESHEET", title),
        Paragraph("Investigation Report for Official Review", subtitle),
        _table(
            [
                ["Police Station", _safe(case.get("police_station")), "FIR Number", _safe(case.get("fir_number"))],
                ["Case ID", _safe(case.get("case_id")), "Registered On", _date(case.get("registered_on"))],
                ["Case Status", _safe(case.get("status")), "Investigation Stage", _safe(case.get("stage"))],
                ["Chargesheet ID", _safe(chargesheet.get("chargesheet_id")), "Filing Status", _safe(chargesheet.get("filing_status"))],
            ],
            widths=[28 * mm, 56 * mm, 30 * mm, 56 * mm],
        ),
        Paragraph("1. CASE SUMMARY", heading),
        Paragraph(f"<b>Title:</b> {_paragraph_text(case.get('title'))}", body),
        Spacer(1, 2),
        Paragraph(f"<b>Nature / Offence:</b> {_paragraph_text(case.get('offence'))}", body),
        Spacer(1, 3),
        Paragraph(_paragraph_text(case.get("description")), body),
        Paragraph("2. ACCUSED / PERSONS INVOLVED", heading),
    ]

    if persons:
        person_rows = [["Person ID", "Name", "Role in Case", "Status"]]
        for person in persons:
            person_rows.append(
                [
                    _safe(person.get("person_id")),
                    _safe(person.get("name")),
                    _safe(person.get("role_in_case")),
                    _safe(person.get("status")),
                ]
            )
        story.append(_table(person_rows, widths=[32 * mm, 48 * mm, 45 * mm, 45 * mm], header=True))
    else:
        story.append(Paragraph("No persons are linked to this case in the database.", body))

    story.append(Paragraph("3. EVIDENCE RELIED UPON", heading))
    if evidence:
        evidence_rows = [["Evidence ID", "Type / Title", "SHA-256 / Integrity", "Custody"]]
        for item in evidence:
            hash_value = item.get("sha256")
            hash_text = (hash_value[:16] + "…") if hash_value else "Not recorded"
            integrity = item.get("integrity_status")
            if integrity:
                hash_text += f"\n{integrity}"
            custody = item.get("latest_custody") or {}
            custody_text = custody.get("action") or "Not recorded"
            evidence_rows.append(
                [
                    _safe(item.get("evidence_id")),
                    f"{_safe(item.get('evidence_type'))}\n{_safe(item.get('title'))}",
                    hash_text,
                    custody_text,
                ]
            )
        story.append(_table(evidence_rows, widths=[34 * mm, 56 * mm, 50 * mm, 30 * mm], header=True))
    else:
        story.append(Paragraph("No evidence is recorded for this case.", body))

    story.append(Paragraph("4. LEGAL PROVISIONS", heading))
    if legal:
        legal_rows = [["Framework", "Section", "Offence / Subject", "Officer Rationale"]]
        for item in legal:
            legal_rows.append(
                [
                    _safe(item.get("framework_code")),
                    _safe(item.get("section_number")),
                    _safe(item.get("offence_name")),
                    _safe(item.get("rationale")),
                ]
            )
        story.append(_table(legal_rows, widths=[25 * mm, 25 * mm, 55 * mm, 65 * mm], header=True))
    else:
        story.append(Paragraph("No officer-confirmed legal provisions are recorded for this case.", body))

    story.append(Paragraph("5. CHRONOLOGY", heading))
    if chronology:
        chronology_rows = [["Date / Time", "Event", "Description", "Source"]]
        for event in chronology:
            chronology_rows.append(
                [
                    _date(event.get("event_at")),
                    _safe(event.get("title")),
                    _safe(event.get("description")),
                    _safe(event.get("source_type")),
                ]
            )
        story.append(_table(chronology_rows, widths=[35 * mm, 45 * mm, 65 * mm, 25 * mm], header=True))
    else:
        story.append(Paragraph("No chronology events are recorded for this case.", body))

    story.extend(
        [
            Paragraph("6. INVESTIGATION SUMMARY", heading),
            Paragraph(_paragraph_text(chargesheet.get("investigation_summary")), body),
            Paragraph("7. INVESTIGATION CONCLUSION", heading),
            Paragraph(_paragraph_text(chargesheet.get("conclusion")), body),
            Paragraph("8. RECORD / SIGN-OFF", heading),
        ]
    )

    officer_rows = [
        ["Prepared By", _safe((prepared_officer or {}).get("name") or chargesheet.get("prepared_by"))],
        ["Officer ID", _safe((prepared_officer or {}).get("officer_id") or chargesheet.get("prepared_by"))],
        ["Designation", _safe((prepared_officer or {}).get("designation"))],
        ["Police Station", _safe((prepared_officer or {}).get("police_station"))],
        ["Prepared On", _date(chargesheet.get("prepared_at"))],
    ]

    seal_text = verification.get("filing_status") or "STATUS NOT RECORDED"
    signoff = Table(
        [[_table(officer_rows, widths=[32 * mm, 70 * mm]), StatusSeal(seal_text)]],
        colWidths=[115 * mm, 50 * mm],
    )
    signoff.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.35, BORDER),
                ("BACKGROUND", (0, 0), (-1, -1), PAPER),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(KeepTogether(signoff))

    doc.build(story, onFirstPage=_page_frame, onLaterPages=_page_frame)
    return f"/uploads/generated/{filename}"
