from __future__ import annotations

import csv
import hashlib
import json
import math
import re
import struct
import wave
import zlib
from datetime import datetime, timedelta
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors

from app.database import SessionLocal
from app import models
from app.services.legal_mapping_service import ensure_legal_master, suggest_legal_provisions

BACKEND_ROOT = Path(__file__).resolve().parent
EVIDENCE_DIR = BACKEND_ROOT / "uploads" / "evidence"
PERSON_DIR = BACKEND_ROOT / "uploads" / "persons"
EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
PERSON_DIR.mkdir(parents=True, exist_ok=True)
NOW = datetime(2026, 9, 14, 2, 30, 0)

SCENARIOS = [
    ("Coordinated Financial Deception", "Cheating and criminal conspiracy", "Multiple persons are alleged in the synthetic scenario to have coordinated dishonest inducement and linked financial transfers."),
    ("Cyber Payment Impersonation", "Cyber-enabled financial fraud and identity misuse", "Synthetic phishing and online impersonation indicators include digital identity misuse and fraudulent payment instructions."),
    ("Forged Electronic Record Investigation", "Forgery and document misuse", "Synthetic false electronic records and altered documents were submitted in support of a deceptive transaction."),
    ("Entrusted Funds Diversion", "Criminal breach of trust and financial deception", "Synthetic entrusted funds were diverted through linked accounts, requiring review for breach of trust and cheating indicators."),
    ("Stolen Property Network", "Theft, stolen property and criminal conspiracy", "Synthetic property and vehicle records indicate theft-related activity and coordinated movement between associates."),
    ("Layered Proceeds Investigation", "Money laundering and proceeds of crime pattern", "Synthetic layered transfers and repeated beneficiary accounts are provided for PMLA workflow demonstration; legal applicability requires officer review."),
    ("Digital Personation Network", "Identity misuse, online impersonation and cyber fraud", "Synthetic credential misuse, online personation and computer-resource based deception indicators are linked across records."),
    ("False Invoice and Cheating Investigation", "Forgery and cheating", "Synthetic invoices and electronic records contain forgery indicators and are linked to dishonest inducement of payment."),
    ("Coordinated Account Fraud", "Cheating, financial deception and criminal conspiracy", "Synthetic communications and accounts indicate coordinated financial deception across multiple participants."),
    ("Cannabis Contravention Investigation", "Cannabis-related contravention", "Synthetic seizure and communication records are provided only to demonstrate NDPS legal-reference workflow."),
    ("Unlicensed Firearm Investigation", "Illegal firearm and Arms Act investigation", "Synthetic weapon seizure documentation is provided only to demonstrate Arms Act legal-reference workflow."),
    ("Electronic Identity and Payment Fraud", "Identity theft and digital fraud", "Synthetic digital identity, credential and payment records are provided for BNS and Information Technology Act review."),
]


def file_hash(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def rel(path: Path) -> str:
    return path.relative_to(BACKEND_ROOT).as_posix()


def png_chunk(chunk_type: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + chunk_type + data + struct.pack(">I", zlib.crc32(chunk_type + data) & 0xFFFFFFFF)


def make_cctv_png(path: Path, seed: int, width: int = 640, height: int = 360):
    if path.exists():
        return
    rows = []
    for y in range(height):
        row = bytearray([0])
        for x in range(width):
            base = 44 + ((x * 7 + y * 11 + seed * 17) % 45)
            if 80 < x < 180 and 90 < y < 310:
                base += 35
            if 350 < x < 500 and 130 < y < 320:
                base += 25
            if y % 8 == 0:
                base = max(0, base - 18)
            row.extend([min(255, base)] * 3)
        rows.append(bytes(row))
    raw = b"".join(rows)
    signature = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    path.write_bytes(signature + png_chunk(b"IHDR", ihdr) + png_chunk(b"IDAT", zlib.compress(raw, 7)) + png_chunk(b"IEND", b""))


def make_wav(path: Path, seed: int):
    if path.exists():
        return
    rate = 8000
    duration = 2.5
    total = int(rate * duration)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(rate)
        frames = bytearray()
        freq = 410 + (seed % 7) * 35
        for i in range(total):
            value = int(6000 * math.sin(2 * math.pi * freq * i / rate))
            if i % 1900 < 220:
                value //= 4
            frames.extend(struct.pack("<h", value))
        wav.writeframes(bytes(frames))


def make_pdf(path: Path, title: str, rows: list[tuple[str, str]], note: str):
    if path.exists():
        return
    doc = SimpleDocTemplate(str(path), pagesize=A4)
    styles = getSampleStyleSheet()
    story = [Paragraph("CINTRA — SYNTHETIC DEMO EVIDENCE", styles["Heading2"]), Spacer(1, 8), Paragraph(title, styles["Title"]), Spacer(1, 12)]
    data = [["Field", "Recorded value"]] + [[a, b] for a, b in rows]
    table = Table(data, colWidths=[130, 330], repeatRows=1)
    table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    story.extend([table, Spacer(1, 12), Paragraph(note, styles["BodyText"]), Spacer(1, 14), Paragraph("Synthetic demonstration record — not a real allegation or police record.", styles["Italic"])])
    doc.build(story)


def make_avatar_svg(path: Path, person):
    if path.exists():
        return
    initials = "".join(part[:1].upper() for part in person.name.split()[:2]) or "C"
    hue = (person.id * 47) % 360
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="320" height="400" viewBox="0 0 320 400">
<rect width="320" height="400" fill="hsl({hue},25%,88%)"/>
<circle cx="160" cy="137" r="70" fill="hsl({hue},18%,68%)"/>
<path d="M65 380c10-100 60-145 95-145s85 45 95 145" fill="hsl({hue},20%,55%)"/>
<rect x="18" y="18" width="284" height="364" fill="none" stroke="#64748b" stroke-width="2"/>
<text x="160" y="360" font-family="Arial" font-size="28" text-anchor="middle" fill="#1e293b">{initials}</text>
<text x="160" y="390" font-family="Arial" font-size="12" text-anchor="middle" fill="#475569">SYNTHETIC DEMO PORTRAIT</text>
</svg>'''
    path.write_text(svg, encoding="utf-8")


def clean_demo_names(db):
    changed = 0
    for person in db.query(models.Person).filter(models.Person.person_id.like("SYN-P-%")).all():
        cleaned = re.sub(r"\s+\d{3}$", "", person.name or "").strip()
        if cleaned and cleaned != person.name:
            person.name = cleaned
            changed += 1
        avatar = PERSON_DIR / f"{person.person_id.lower()}.svg"
        make_avatar_svg(avatar, person)
        if not person.profile_image_path:
            person.profile_image_path = rel(avatar)
    return changed


def case_people(db, case_id: int):
    links = db.query(models.CasePerson).filter(models.CasePerson.case_id == case_id).all()
    return [link.person for link in links if getattr(link, "person", None)]


def case_entities(db, case_id: int):
    return db.query(models.EntityIdentifier).filter(models.EntityIdentifier.case_id == case_id).all()


def write_asset_for_evidence(db, evidence, case, people, identifiers):
    seed = evidence.id or 1
    safe = evidence.evidence_id.lower().replace("/", "-")
    kind = (evidence.evidence_type or "").lower()
    phones = [p.phone for p in people if p.phone][:4]
    accounts = [r.raw_value for r in identifiers if r.identifier_type == "ACCOUNT"][:3]
    vehicles = [r.raw_value for r in identifiers if r.identifier_type == "VEHICLE"][:3]
    imeis = [r.raw_value for r in identifiers if r.identifier_type == "IMEI"][:3]
    locations = [r.raw_value for r in identifiers if r.identifier_type == "LOCATION"][:3]

    if "cdr" in kind or "call" in kind:
        path = EVIDENCE_DIR / f"{safe}.csv"
        if not path.exists():
            with path.open("w", newline="", encoding="utf-8") as handle:
                writer = csv.writer(handle)
                writer.writerow(["caller", "receiver", "start_time", "duration", "tower"])
                base = NOW - timedelta(days=(seed % 20) + 1)
                p = phones or ["9876501001", "9876501002"]
                for i in range(22):
                    writer.writerow([p[i % len(p)], p[(i + 1) % len(p)], (base + timedelta(minutes=i * 29)).isoformat(sep=" "), 30 + (i * 19) % 260, f"TOWER-{(seed+i)%12:02d}"])
    elif "financial" in kind or "transaction" in kind:
        path = EVIDENCE_DIR / f"{safe}.csv"
        if not path.exists():
            with path.open("w", newline="", encoding="utf-8") as handle:
                writer = csv.writer(handle)
                writer.writerow(["timestamp", "from_account", "to_account", "amount_inr", "reference"])
                ac = accounts or ["ACCT-001", "ACCT-002"]
                for i in range(12):
                    writer.writerow([(NOW - timedelta(days=10-i)).isoformat(sep=" "), ac[i % len(ac)], f"BEN-{(seed+i)%17:03d}", 25000 + (i * 37500), f"TXN-{case.case_id}-{i+1:02d}"])
    elif "location" in kind:
        path = EVIDENCE_DIR / f"{safe}.json"
        payload = {
            "case": case.case_id,
            "synthetic": True,
            "locations": locations or ["Connaught Place, New Delhi"],
            "observations": [{"at": (NOW - timedelta(hours=i*3)).isoformat(), "location": (locations or ["Connaught Place, New Delhi"])[i % len(locations or [1])]} for i in range(6)],
        }
        path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    elif "cctv" in kind or "image" in kind or "photo" in kind:
        path = EVIDENCE_DIR / f"{safe}.png"
        make_cctv_png(path, seed)
        evidence.evidence_type = "CCTV Image"
        evidence.title = evidence.title.replace("Footage", "Image") if evidence.title else "CCTV Image"
    elif "communication" in kind or "audio" in kind:
        path = EVIDENCE_DIR / f"{safe}.wav"
        make_wav(path, seed)
    elif "device" in kind:
        path = EVIDENCE_DIR / f"{safe}.json"
        payload = {
            "case": case.case_id,
            "synthetic": True,
            "device_identifiers": imeis,
            "phones": phones,
            "applications": ["Messaging Client", "Browser", "Payments App"],
            "extraction_note": "Synthetic device extraction summary for CINTRA demonstration.",
        }
        path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    else:
        path = EVIDENCE_DIR / f"{safe}.pdf"
        rows = [
            ("Case", case.case_id),
            ("Evidence ID", evidence.evidence_id),
            ("Evidence Type", evidence.evidence_type),
            ("Source", evidence.source or "Synthetic Demo Dataset"),
            ("People", ", ".join(p.name for p in people[:4]) or "No linked people"),
            ("Phones", ", ".join(phones) or "None recorded"),
            ("Vehicle", ", ".join(vehicles) or "None recorded"),
        ]
        make_pdf(path, evidence.title, rows, evidence.description or "Synthetic evidence record.")

    evidence.file_path = rel(path)
    # Setting file_path triggers the Evidence model's baseline calculation.  We
    # still set explicitly for clarity when working against older model versions.
    evidence.sha256_hash = file_hash(path)
    return path


def rebuild_synthetic_legal_mapping(db):
    ensure_legal_master(db)
    # Remove only the old random workflow-testing links created by the previous
    # large demo seed. Officer-created/confirmed links are left untouched.
    random_links = db.query(models.CaseLegalSection).filter(
        models.CaseLegalSection.rationale.like("Synthetic demo provision selected for workflow testing%")
    ).all()
    for row in random_links:
        db.delete(row)
    db.flush()

    confirmed = 0
    candidates = 0
    for case in db.query(models.Case).filter(models.Case.case_id.like("CINTRA-SYN-%")).order_by(models.Case.id).all():
        try:
            case_num = int(str(case.case_id).split("-")[-1])
        except Exception:
            case_num = case.id
        scenario_title, offence, narrative = SCENARIOS[(case_num - 1) % len(SCENARIOS)]
        case.title = f"{scenario_title} — Demo {case_num:02d}"
        case.offence = offence
        case.description = (
            narrative + " All persons, allegations and records in this case are synthetic demonstration data. "
            "CINTRA surfaces potential legal provisions for officer review and does not make a guilt determination."
        )
        created = suggest_legal_provisions(db, case, {"officer_id": "INV-001"}, "synthetic case scenario")
        # For demonstration data, represent a prior officer review on the first
        # one or two candidate sections. This is *not* automatic legal charging;
        # it is seeded historical demo state.
        all_candidates = db.query(models.CaseLegalSection).filter(
            models.CaseLegalSection.case_id == case.id,
            models.CaseLegalSection.status == "Candidate",
        ).order_by(models.CaseLegalSection.id).all()
        for pos, row in enumerate(all_candidates):
            if pos == 0 or (case.id % 4 == 0 and pos == 1):
                row.status = "Confirmed"
                row.reviewed_by = "INV-001"
                row.reviewed_at = NOW - timedelta(days=2)
                row.rationale = (row.rationale or "") + " Synthetic demo state: previously confirmed by INV-001."
                confirmed += 1
            else:
                candidates += 1
    return confirmed, candidates


def main():
    print("CINTRA Realistic Evidence + Legal Scenario Upgrade")
    print("==================================================")
    db = SessionLocal()
    try:
        renamed = clean_demo_names(db)
        db.flush()
        assets = 0
        synthetic = db.query(models.Evidence).join(models.Case, models.Evidence.case_id == models.Case.id).filter(models.Case.case_id.like("CINTRA-SYN-%")).all()
        case_cache = {}
        for evidence in synthetic:
            case = case_cache.get(evidence.case_id)
            if case is None:
                case = db.query(models.Case).filter(models.Case.id == evidence.case_id).first()
                case_cache[evidence.case_id] = case
            people = case_people(db, case.id)
            identifiers = case_entities(db, case.id)
            write_asset_for_evidence(db, evidence, case, people, identifiers)
            assets += 1
        confirmed, candidates = rebuild_synthetic_legal_mapping(db)
        db.commit()

        with_files = db.query(models.Evidence).filter(models.Evidence.file_path.isnot(None)).count()
        with_hash = db.query(models.Evidence).filter(models.Evidence.sha256_hash.isnot(None)).count()
        portraits = db.query(models.Person).filter(models.Person.profile_image_path.isnot(None)).count()
        print(f"Synthetic display names cleaned : {renamed}")
        print(f"Evidence assets processed       : {assets}")
        print(f"Evidence with physical file     : {with_files}")
        print(f"Evidence with SHA-256 baseline  : {with_hash}")
        print(f"Persons with demo portrait      : {portraits}")
        print(f"Demo legal provisions confirmed: {confirmed}")
        print(f"Legal candidates pending review : {candidates}")
        print("\nExisting non-synthetic CINTRA evidence was not rewritten.")
        print("Chargesheets will use only officer-confirmed case legal provisions.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
