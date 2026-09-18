from pathlib import Path
from datetime import datetime
import uuid

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle
)
from reportlab.lib import colors


BASE_DIR = Path(__file__).resolve().parents[2]

GENERATED_DIR = BASE_DIR / "uploads" / "generated"

GENERATED_DIR.mkdir(
    parents=True,
    exist_ok=True
)


def generate_chargesheet_pdf(
    chargesheet,
    case,
    persons,
    evidence,
    legal_sections=None
):
    filename = (
        f"{chargesheet.chargesheet_id}_"
        f"{uuid.uuid4().hex[:8]}.pdf"
    )

    physical_file_path = (
        GENERATED_DIR / filename
    )

    document = SimpleDocTemplate(
        str(physical_file_path),
        pagesize=A4,
        rightMargin=20 * mm,
        leftMargin=20 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "ChargesheetTitle",
        parent=styles["Title"],
        alignment=TA_CENTER,
        fontSize=16,
        spaceAfter=8
    )

    heading_style = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading2"],
        fontSize=12,
        spaceBefore=10,
        spaceAfter=6
    )

    normal_style = styles["BodyText"]

    story = []

    # ---------- HEADER ----------

    story.append(
        Paragraph(
            "CINTRA",
            title_style
        )
    )

    story.append(
        Paragraph(
            "Crime Intelligence and Tracking Response Apparatus",
            styles["Normal"]
        )
    )

    story.append(
        Spacer(1, 10)
    )

    story.append(
        Paragraph(
            "LEGAL CHARGESHEET",
            title_style
        )
    )

    story.append(
        Paragraph(
            f"Chargesheet ID: {chargesheet.chargesheet_id}",
            normal_style
        )
    )

    story.append(
        Spacer(1, 12)
    )

    # ---------- CASE DETAILS ----------

    story.append(
        Paragraph(
            "1. Case Details",
            heading_style
        )
    )

    case_data = [
        ["Case ID", case.case_id],
        ["FIR Number", case.fir_number],
        ["Case Title", case.title],
        ["Offence", case.offence],
        ["Police Station", case.police_station],
        [
            "Investigating Officer",
            case.investigating_officer
        ],
        ["Stage", case.stage],
        ["Status", case.status]
    ]

    case_table = Table(
        case_data,
        colWidths=[55 * mm, 105 * mm]
    )

    case_table.setStyle(
        TableStyle(
            [
                (
                    "GRID",
                    (0, 0),
                    (-1, -1),
                    0.5,
                    colors.grey
                ),
                (
                    "FONTNAME",
                    (0, 0),
                    (0, -1),
                    "Helvetica-Bold"
                ),
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "TOP"
                ),
                (
                    "PADDING",
                    (0, 0),
                    (-1, -1),
                    6
                )
            ]
        )
    )

    story.append(case_table)

    # ---------- PERSONS ----------

    story.append(
        Paragraph(
            "2. Persons Linked to Case",
            heading_style
        )
    )

    if persons:
        person_data = [
            [
                "Person ID",
                "Name",
                "Role",
                "Status"
            ]
        ]

        for link in persons:
            person = link.person

            person_data.append(
                [
                    person.person_id,
                    person.name,
                    link.role_in_case,
                    person.status
                ]
            )

        person_table = Table(
            person_data,
            repeatRows=1,
            colWidths=[
                32 * mm,
                48 * mm,
                40 * mm,
                40 * mm
            ]
        )

        person_table.setStyle(
            TableStyle(
                [
                    (
                        "GRID",
                        (0, 0),
                        (-1, -1),
                        0.5,
                        colors.grey
                    ),
                    (
                        "FONTNAME",
                        (0, 0),
                        (-1, 0),
                        "Helvetica-Bold"
                    ),
                    (
                        "VALIGN",
                        (0, 0),
                        (-1, -1),
                        "TOP"
                    ),
                    (
                        "PADDING",
                        (0, 0),
                        (-1, -1),
                        5
                    )
                ]
            )
        )

        story.append(person_table)

    else:
        story.append(
            Paragraph(
                "No persons linked to this case.",
                normal_style
            )
        )

    # ---------- LEGAL PROVISIONS ----------

    story.append(
        Paragraph(
            "3. Legal Provisions",
            heading_style
        )
    )

    if legal_sections:
        legal_data = [["Framework", "Section", "Offence / Subject", "Cross-reference"]]
        for section in legal_sections:
            legal_data.append([
                section.framework_code,
                section.section_number,
                section.offence_name,
                section.legacy_reference or "—",
            ])
        legal_table = Table(
            legal_data,
            repeatRows=1,
            colWidths=[28 * mm, 25 * mm, 72 * mm, 35 * mm]
        )
        legal_table.setStyle(TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("PADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(legal_table)
    else:
        story.append(
            Paragraph(
                chargesheet.legal_provisions
                or "Not specified.",
                normal_style
            )
        )

    # ---------- INVESTIGATION SUMMARY ----------

    story.append(
        Paragraph(
            "4. Investigation Summary",
            heading_style
        )
    )

    story.append(
        Paragraph(
            chargesheet.investigation_summary
            or "No investigation summary provided.",
            normal_style
        )
    )

    # ---------- EVIDENCE ----------

    story.append(
        Paragraph(
            "5. Evidence",
            heading_style
        )
    )

    if evidence:
        evidence_data = [
            [
                "Evidence ID",
                "Title",
                "Type",
                "Status"
            ]
        ]

        for item in evidence:
            evidence_data.append(
                [
                    item.evidence_id,
                    item.title,
                    item.evidence_type,
                    item.status
                ]
            )

        evidence_table = Table(
            evidence_data,
            repeatRows=1,
            colWidths=[
                35 * mm,
                65 * mm,
                30 * mm,
                30 * mm
            ]
        )

        evidence_table.setStyle(
            TableStyle(
                [
                    (
                        "GRID",
                        (0, 0),
                        (-1, -1),
                        0.5,
                        colors.grey
                    ),
                    (
                        "FONTNAME",
                        (0, 0),
                        (-1, 0),
                        "Helvetica-Bold"
                    ),
                    (
                        "VALIGN",
                        (0, 0),
                        (-1, -1),
                        "TOP"
                    ),
                    (
                        "PADDING",
                        (0, 0),
                        (-1, -1),
                        5
                    )
                ]
            )
        )

        story.append(evidence_table)

    else:
        story.append(
            Paragraph(
                "No evidence recorded for this case.",
                normal_style
            )
        )

    # ---------- CONCLUSION ----------

    story.append(
        Paragraph(
            "6. Conclusion",
            heading_style
        )
    )

    story.append(
        Paragraph(
            chargesheet.conclusion
            or "No conclusion provided.",
            normal_style
        )
    )

    # ---------- PREPARATION DETAILS ----------

    story.append(
        Spacer(1, 20)
    )

    story.append(
        Paragraph(
            f"Prepared By: {chargesheet.prepared_by}",
            normal_style
        )
    )

    prepared_date = (
        chargesheet.prepared_at.strftime(
            "%d-%m-%Y %H:%M"
        )
        if chargesheet.prepared_at
        else datetime.now().strftime(
            "%d-%m-%Y %H:%M"
        )
    )

    story.append(
        Paragraph(
            f"Prepared On: {prepared_date}",
            normal_style
        )
    )

    story.append(
        Paragraph(
            f"Filing Status: {chargesheet.filing_status}",
            normal_style
        )
    )

    document.build(story)

    # Return a frontend-usable URL,
    # not this computer's local Windows path.
    return (
        f"/uploads/generated/"
        f"{filename}"
    )