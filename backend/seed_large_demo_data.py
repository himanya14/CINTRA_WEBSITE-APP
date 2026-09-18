from __future__ import annotations

import csv
import hashlib
import json
import random
from datetime import datetime, timedelta
from pathlib import Path

from app.database import SessionLocal
from app import models


RNG = random.Random(374)
NOW = datetime(2026, 9, 14, 1, 45, 0)
BACKEND_ROOT = Path(__file__).resolve().parent
EVIDENCE_DIR = BACKEND_ROOT / "uploads" / "evidence"
EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)

CASE_COUNT = 30
PERSON_COUNT = 120
EVIDENCE_PER_CASE = 10
RELATIONSHIPS_PER_CASE = 15
TIMELINE_PER_CASE = 18
DIARY_PER_CASE = 7
ALERTS_PER_CASE = 5
LEADS_PER_CASE = 4

FIRST_NAMES = [
    "Aarav", "Vivaan", "Aditya", "Arjun", "Kabir", "Rohan", "Kunal", "Nikhil", "Rahul", "Amit",
    "Neha", "Priya", "Ananya", "Kavya", "Riya", "Sneha", "Ishita", "Meera", "Pooja", "Naina",
]
LAST_NAMES = [
    "Mehra", "Kapoor", "Malhotra", "Khanna", "Sharma", "Verma", "Singh", "Gupta", "Bansal", "Saxena",
    "Iyer", "Nair", "Reddy", "Patel", "Joshi", "Chopra", "Ahuja", "Sethi", "Rao", "Mishra",
]
POLICE_STATIONS = [
    "Connaught Place Police Station", "Karol Bagh Police Station", "Saket Police Station",
    "Dwarka North Police Station", "Noida Sector 20 Police Station", "Gurugram Cyber Police Station",
    "South Campus Police Station", "Vasant Kunj Police Station", "Lajpat Nagar Police Station",
    "Rajouri Garden Police Station",
]
OFFENCES = [
    "Cheating and criminal conspiracy", "Cyber-enabled financial fraud", "Forgery and document misuse",
    "Identity misuse and impersonation", "Organised property offence", "Illicit financial transfer network",
    "Communication-linked extortion", "Coordinated digital fraud", "Vehicle-linked property offence",
    "Suspicious transaction network",
]
LOCATIONS = [
    "Karol Bagh, New Delhi", "Connaught Place, New Delhi", "Saket, New Delhi", "Dwarka, New Delhi",
    "Noida Sector 62", "Gurugram Cyber Hub", "Lajpat Nagar, New Delhi", "Vasant Kunj, New Delhi",
    "Rajouri Garden, New Delhi", "Nehru Place, New Delhi", "Rohini, New Delhi", "Faridabad Sector 15",
]
ORGANISATIONS = [
    "Northstar Logistics", "Apex Trading Co", "Bluegate Consulting", "Metroline Services", "Orion Infotech",
    "Crestline Exports", "Silveroak Ventures", "UrbanAxis Solutions", "Redwood Enterprises", "PrimeRoute Services",
]


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def ensure_file(relative_path: str, content: str) -> str:
    path = BACKEND_ROOT / relative_path
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        path.write_text(content, encoding="utf-8")
    return relative_path.replace("\\", "/")


def ensure_cdr_csv(case_ref: str, idx: int, phones: list[str]) -> str:
    relative = f"uploads/evidence/syn_{case_ref.lower()}_cdr.csv"
    path = BACKEND_ROOT / relative
    if not path.exists():
        rows = []
        base = NOW - timedelta(days=20 - idx)
        for j in range(18):
            caller = phones[j % len(phones)]
            receiver = phones[(j + 1 + (j % 3)) % len(phones)]
            rows.append([
                caller,
                receiver,
                (base + timedelta(minutes=37 * j)).strftime("%Y-%m-%d %H:%M:%S"),
                35 + (j * 17) % 210,
                f"TOWER-{(idx % 8) + 1:02d}",
            ])
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["caller", "receiver", "start_time", "duration", "tower"])
            writer.writerows(rows)
    return relative


def get_or_create_case(db, idx: int):
    ref = f"CINTRA-SYN-{idx:03d}"
    existing = db.query(models.Case).filter(models.Case.case_id == ref).first()
    if existing:
        return existing
    case = models.Case(
        case_id=ref,
        fir_number=f"FIR-SYN-{2026000 + idx}",
        title=f"Synthetic Connected Investigation {idx:02d}",
        offence=OFFENCES[(idx - 1) % len(OFFENCES)],
        police_station=POLICE_STATIONS[(idx - 1) % len(POLICE_STATIONS)],
        investigating_officer="INV-001",
        stage="Under Investigation" if idx % 5 else "Evidence Review",
        status="Active",
        description=(
            "Synthetic CINTRA demonstration investigation intentionally connected to other demo cases through "
            "shared persons, phones, vehicles, accounts, devices, organisations and locations."
        ),
        data_origin="Synthetic Demo Data",
        synthetic=True,
        source_reference="CINTRA large connected synthetic dataset",
        registered_on=NOW - timedelta(days=45 - idx),
    )
    db.add(case)
    db.flush()
    return case


def get_or_create_person(db, idx: int):
    person_ref = f"SYN-P-{idx:03d}"
    existing = db.query(models.Person).filter(models.Person.person_id == person_ref).first()
    if existing:
        return existing
    first = FIRST_NAMES[(idx - 1) % len(FIRST_NAMES)]
    last = LAST_NAMES[((idx - 1) * 7) % len(LAST_NAMES)]
    phone_group = (idx - 1) % 72
    phone = f"98{76500000 + phone_group:08d}"
    person = models.Person(
        person_id=person_ref,
        name=f"{first} {last} {idx:03d}",
        age=21 + ((idx * 3) % 38),
        gender="Female" if idx % 3 == 0 else "Male",
        phone=phone,
        address=LOCATIONS[(idx - 1) % len(LOCATIONS)],
        role="Person of Interest" if idx % 4 else "Associate",
        status="Under Investigation",
    )
    db.add(person)
    db.flush()
    return person


def ensure_case_person(db, case, person, role: str):
    row = db.query(models.CasePerson).filter(
        models.CasePerson.case_id == case.id,
        models.CasePerson.person_id == person.id,
    ).first()
    if not row:
        db.add(models.CasePerson(case_id=case.id, person_id=person.id, role_in_case=role))


def ensure_evidence(db, case, case_idx: int, ev_idx: int, linked_phones: list[str]):
    ev_ref = f"SYN-EVD-{case_idx:03d}-{ev_idx:02d}"
    existing = db.query(models.Evidence).filter(models.Evidence.evidence_id == ev_ref).first()
    if existing:
        return existing

    types = [
        "CDR", "Financial Record", "Location Record", "CCTV Footage", "Document",
        "Device Record", "Transaction Record", "Communication Record", "Surveillance Report", "Intelligence Note",
    ]
    ev_type = types[(ev_idx - 1) % len(types)]
    file_path = None
    if ev_idx == 1:
        file_path = ensure_cdr_csv(case.case_id, case_idx, linked_phones[:4])
        title = "Structured Call Detail Records"
    elif ev_idx == 2:
        file_path = ensure_file(
            f"uploads/evidence/syn_{case.case_id.lower()}_financial.txt",
            f"Synthetic financial summary for {case.case_id}. Shared account references: ACCT-{(case_idx % 15)+1:03d}.\n",
        )
        title = "Financial Transaction Summary"
    elif ev_idx == 3:
        file_path = ensure_file(
            f"uploads/evidence/syn_{case.case_id.lower()}_location.json",
            json.dumps({"case": case.case_id, "location": LOCATIONS[case_idx % len(LOCATIONS)], "synthetic": True}, indent=2),
        )
        title = "Location Correlation Record"
    else:
        title = f"{ev_type} Evidence {ev_idx:02d}"

    evidence = models.Evidence(
        evidence_id=ev_ref,
        case_id=case.id,
        title=title,
        evidence_type=ev_type,
        description=f"Synthetic {ev_type.lower()} record for connected CINTRA demonstration case {case.case_id}.",
        file_path=file_path,
        source="Synthetic Connected Dataset",
        collected_by="INV-001",
        collected_at=NOW - timedelta(days=30 - case_idx, hours=ev_idx),
        status="Collected",
    )
    db.add(evidence)
    db.flush()
    return evidence


def ensure_entity(db, case, case_idx: int, kind: str, value: str, description: str):
    entity_ref = f"SYN-ENT-{case_idx:03d}-{kind}-{hashlib.md5(value.encode()).hexdigest()[:8]}"
    existing = db.query(models.IntelligenceEntity).filter(models.IntelligenceEntity.entity_id == entity_ref).first()
    if existing:
        return existing
    entity = models.IntelligenceEntity(
        entity_id=entity_ref,
        case_id=case.id,
        entity_type=kind,
        label=value,
        value=value,
        description=description,
        source="Synthetic Connected Dataset",
        confidence=None,
        verification_status="Verified" if case_idx % 4 == 0 else "Unverified",
        data_origin="Synthetic Demo Data",
        synthetic=True,
        created_by="SYSTEM",
    )
    db.add(entity)
    db.flush()
    return entity


def ensure_identifier(db, case, kind: str, raw: str, person_id=None, evidence_id=None, entity_id=None, source="Synthetic Connected Dataset"):
    normalized = raw
    if kind in {"PHONE", "IMEI", "ACCOUNT", "VEHICLE"}:
        normalized = "".join(ch for ch in raw.upper() if ch.isalnum())
    else:
        normalized = " ".join(raw.lower().split())
    existing = db.query(models.EntityIdentifier).filter(
        models.EntityIdentifier.case_id == case.id,
        models.EntityIdentifier.identifier_type == kind,
        models.EntityIdentifier.normalized_value == normalized,
    ).first()
    if existing:
        return existing
    row = models.EntityIdentifier(
        case_id=case.id,
        person_id=person_id,
        evidence_id=evidence_id,
        entity_id=entity_id,
        identifier_type=kind,
        raw_value=raw,
        normalized_value=normalized,
        source=source,
        verified=True,
        created_by="SYSTEM",
    )
    db.add(row)
    db.flush()
    return row


def ensure_relationship(db, case, case_idx: int, rel_idx: int, source_type: str, source_ref: str, target_type: str, target_ref: str, rel_type: str, evidence):
    rel_ref = f"SYN-REL-{case_idx:03d}-{rel_idx:03d}"
    rel = db.query(models.IntelligenceRelationship).filter(models.IntelligenceRelationship.relationship_id == rel_ref).first()
    if not rel:
        rel = models.IntelligenceRelationship(
            relationship_id=rel_ref,
            case_id=case.id,
            source_type=source_type,
            source_ref=source_ref,
            target_type=target_type,
            target_ref=target_ref,
            relationship_type=rel_type,
            description=(
                f"Synthetic {rel_type.lower()} connection recorded between {source_ref} and {target_ref}. "
                f"Review {evidence.evidence_id} for supporting context."
            ),
            confidence=None,
            verification_status="Verified" if rel_idx % 5 == 0 else "Unverified",
            source="Synthetic Demo Dataset" if rel_idx % 3 else "Manual Analyst Input",
            data_origin="Synthetic Demo Data",
            synthetic=True,
            created_by="SYSTEM",
        )
        db.add(rel)
        db.flush()
    src = db.query(models.RelationshipSource).filter(models.RelationshipSource.relationship_id == rel.id).first()
    if not src:
        db.add(models.RelationshipSource(
            relationship_id=rel.id,
            evidence_id=evidence.id,
            source_type="Evidence",
            source_reference=evidence.evidence_id,
            explanation=f"{evidence.title} supports this recorded {rel_type.lower()} connection.",
            added_by="SYSTEM",
        ))
    return rel


def ensure_analysis_alerts_leads(db, case, case_idx: int, evidence_rows, entities):
    analyses = db.query(models.IntelligenceAnalysis).filter(models.IntelligenceAnalysis.case_id == case.id).all()
    while len(analyses) < 2:
        n = len(analyses) + 1
        analysis = models.IntelligenceAnalysis(
            case_id=case.id,
            source_type="SYNTHETIC_CONNECTED_DATASET",
            input_text=f"Structured synthetic analysis input {n} for {case.case_id}.",
            result_json={
                "case_reference": case.case_id,
                "network_summary": {"entities": len(entities), "evidence": len(evidence_rows)},
                "responsible_ai": "Analytical lead only; officer verification required.",
            },
            created_by="SYSTEM",
            created_at=NOW - timedelta(days=5, hours=n),
        )
        db.add(analysis)
        db.flush()
        analyses.append(analysis)

    alert_titles = [
        "Repeated communication pattern", "Shared identifier detected", "Financial pattern requires review",
        "Location overlap requires review", "Relationship provenance pending review",
    ]
    current_alerts = db.query(models.IntelligenceAlert).filter(models.IntelligenceAlert.case_id == case.id).count()
    for i in range(current_alerts, ALERTS_PER_CASE):
        db.add(models.IntelligenceAlert(
            case_id=case.id,
            analysis_id=analyses[i % len(analyses)].id,
            alert_type=["COMMUNICATION", "CROSS_CASE", "FINANCIAL", "LOCATION", "RELATIONSHIP"][i],
            title=alert_titles[i],
            description=(
                f"Synthetic alert for {case.case_id}: {alert_titles[i].lower()}. "
                "Open the supporting records before relying on this indicator."
            ),
            severity=["Medium", "High", "Medium", "Low", "Medium"][i],
            status="Open",
            created_by="SYSTEM",
            created_at=NOW - timedelta(hours=(case_idx * 2 + i)),
        ))

    current_leads = db.query(models.IntelligenceLead).filter(models.IntelligenceLead.case_id == case.id).count()
    lead_defs = [
        ("COMMUNICATION_PATTERN", "Repeated communication requires review"),
        ("CROSS_CASE", "Shared identifier across investigations"),
        ("FINANCIAL_PATTERN", "Recurring account activity requires review"),
        ("NETWORK_BRIDGE", "Potential network connector requires review"),
    ]
    for i in range(current_leads, LEADS_PER_CASE):
        lead_type, title = lead_defs[i]
        db.add(models.IntelligenceLead(
            case_id=case.id,
            lead_type=lead_type,
            title=title,
            explanation=(
                f"CINTRA surfaced this synthetic {lead_type.lower().replace('_', ' ')} indicator in {case.case_id}. "
                "It is an investigative lead only and requires officer verification against supporting evidence."
            ),
            supporting_json={
                "case_reference": case.case_id,
                "evidence": [e.evidence_id for e in evidence_rows[:3]],
                "source": "Synthetic Connected Dataset",
            },
            confidence=None,
            verification_status="Pending",
            created_by="SYSTEM",
            created_at=NOW - timedelta(hours=(case_idx + i)),
        ))


def ensure_timeline_diary(db, case, case_idx: int, evidence_rows):
    existing_timeline = db.query(models.TimelineEvent).filter(models.TimelineEvent.case_id == case.id).count()
    event_types = ["CASE", "PERSON", "EVIDENCE", "CDR", "FINANCIAL", "LOCATION", "RELATIONSHIP", "FORENSIC", "ALERT"]
    for i in range(existing_timeline, TIMELINE_PER_CASE):
        ev = evidence_rows[i % len(evidence_rows)]
        db.add(models.TimelineEvent(
            case_id=case.id,
            event_type=event_types[i % len(event_types)],
            title=f"{event_types[i % len(event_types)].title()} event {i + 1}",
            description=f"Synthetic chronological investigation event for {case.case_id}.",
            event_at=NOW - timedelta(days=20 - (i % 15), hours=(case_idx + i) % 20),
            source_type="Evidence" if i % 2 == 0 else "Investigation Record",
            source_id=ev.evidence_id if i % 2 == 0 else case.case_id,
            evidence_id=ev.id if i % 2 == 0 else None,
            officer_id="INV-001",
            confidence=None,
            metadata_json={"synthetic": True},
        ))

    existing_diary = db.query(models.CaseDiary).filter(models.CaseDiary.case_id == case.id).count()
    for i in range(existing_diary, DIARY_PER_CASE):
        db.add(models.CaseDiary(
            case_id=case.id,
            officer_id="INV-001",
            entry=f"Synthetic case diary entry {i + 1}: reviewed evidence and linked investigation records for {case.case_id}.",
            action_taken=["Evidence reviewed", "Person interviewed", "CDR reviewed", "Relationship examined"][i % 4],
            created_at=NOW - timedelta(days=7 - i, hours=case_idx % 8),
        ))


def ensure_legal_links(db, case, case_idx: int):
    sections = db.query(models.LegalSection).filter(models.LegalSection.active == True).order_by(models.LegalSection.id.asc()).all()  # noqa: E712
    if not sections:
        return
    for section in [sections[(case_idx * 2) % len(sections)], sections[(case_idx * 2 + 1) % len(sections)]]:
        exists = db.query(models.CaseLegalSection).filter(
            models.CaseLegalSection.case_id == case.id,
            models.CaseLegalSection.legal_section_id == section.id,
        ).first()
        if not exists:
            db.add(models.CaseLegalSection(
                case_id=case.id,
                legal_section_id=section.id,
                status="Confirmed",
                rationale="Synthetic demo provision selected for workflow testing; officer confirmation represented in demo data.",
                added_by="INV-001",
            ))


def ensure_forensic_assignments(db, case, case_idx: int, evidence_rows):
    officer_ids = {o.officer_id for o in db.query(models.Officer).all()}
    if "FA-001" not in officer_ids:
        return
    assigner = "SUP-001" if "SUP-001" in officer_ids else ("INV-001" if "INV-001" in officer_ids else "FA-001")
    targets = [None, evidence_rows[0].id] if case_idx <= 20 else []
    for pos, evidence_id in enumerate(targets, start=1):
        exists = db.query(models.ForensicAssignment).filter(
            models.ForensicAssignment.case_id == case.id,
            models.ForensicAssignment.assigned_to == "FA-001",
            models.ForensicAssignment.evidence_id == evidence_id,
        ).first()
        if exists:
            continue
        status = ["Assigned", "In Progress", "Completed"][(case_idx + pos) % 3]
        assigned_at = NOW - timedelta(days=4, hours=case_idx)
        started_at = assigned_at + timedelta(hours=2) if status in {"In Progress", "Completed"} else None
        completed_at = started_at + timedelta(hours=3) if status == "Completed" else None
        db.add(models.ForensicAssignment(
            case_id=case.id,
            evidence_id=evidence_id,
            assigned_to="FA-001",
            assigned_by=assigner,
            examination_type="Digital Evidence Examination" if evidence_id is None else "CDR Examination",
            instructions="Examine assigned synthetic records, preserve provenance, and document findings.",
            priority="High" if case_idx % 4 == 0 else "Normal",
            status=status,
            assigned_at=assigned_at,
            started_at=started_at,
            completed_at=completed_at,
        ))


def ensure_master_data(db):
    categories = {
        "PERSON_ROLE": ["Prime Suspect", "Suspect", "Associate", "Witness", "Victim", "Complainant", "Person of Interest"],
        "EVIDENCE_TYPE": ["CDR", "Financial Record", "Location Record", "CCTV Footage", "Document", "Device Record", "Surveillance Report"],
        "RELATIONSHIP_TYPE": ["Communication", "Financial Transfer", "Associated With", "Used By", "Owned By", "Seen At Same Location"],
        "CASE_STATUS": ["Active", "Under Review", "Evidence Review", "Chargesheet Preparation", "Closed"],
        "INVESTIGATION_STAGE": ["Initial Review", "Evidence Collection", "Analysis", "Forensic Examination", "Legal Review"],
        "POLICE_STATION": POLICE_STATIONS,
        "FORENSIC_EXAMINATION": ["Hash Verification", "CDR Examination", "Media Examination", "Metadata Review", "Device Review"],
        "ARTIFACT_TYPE": ["Forensic Report", "Extracted Frame", "Metadata Report", "Analysis Export"],
    }
    for category, labels in categories.items():
        for idx, label in enumerate(labels, start=1):
            code = f"{category}-{idx:02d}"
            if not db.query(models.MasterDataItem).filter(models.MasterDataItem.category == category, models.MasterDataItem.code == code).first():
                db.add(models.MasterDataItem(
                    category=category,
                    code=code,
                    label=label,
                    description=f"Synthetic/reference master-data value for {label}.",
                    metadata_json={"source": "CINTRA demo seed"},
                    active=True,
                    created_by="SYSTEM",
                ))


def main():
    print("CINTRA Large Connected Demo Data Seeder")
    print("=======================================")
    db = SessionLocal()
    try:
        ensure_master_data(db)
        db.commit()

        persons = [get_or_create_person(db, i) for i in range(1, PERSON_COUNT + 1)]
        db.commit()

        case_rows = []
        for idx in range(1, CASE_COUNT + 1):
            case = get_or_create_case(db, idx)
            case_rows.append(case)
            db.flush()

            # 8 people per case, deliberately overlapping across adjacent cases.
            person_indexes = sorted({
                ((idx * 3 + offset) % PERSON_COUNT) for offset in (0, 1, 2, 9, 17, 29, 41, 53)
            })
            linked_people = [persons[i] for i in person_indexes]
            roles = ["Prime Suspect", "Associate", "Witness", "Person of Interest", "Associate", "Witness", "Victim", "Associate"]
            for p, role in zip(linked_people, roles):
                ensure_case_person(db, case, p, role)
            db.flush()

            phones = [p.phone for p in linked_people if p.phone]
            evidence_rows = [ensure_evidence(db, case, idx, ev_idx, phones) for ev_idx in range(1, EVIDENCE_PER_CASE + 1)]
            db.flush()

            # Person identifiers enable same-person and phone cross-case matching.
            for p in linked_people:
                ensure_identifier(db, case, "PERSON", p.person_id, person_id=p.id, source="Case Person Link")
                ensure_identifier(db, case, "PERSON_NAME", p.name, person_id=p.id, source="Case Person Link")
                if p.phone:
                    ensure_identifier(db, case, "PHONE", p.phone, person_id=p.id, source="Person Record")

            cluster = (idx - 1) % 10
            shared_values = {
                "VEHICLE": f"DL{(cluster % 9) + 1:02d}AB{1200 + cluster}",
                "ACCOUNT": f"ACCT-{(cluster % 15) + 1:03d}",
                "IMEI": f"35693803564{3800 + cluster:04d}",
                "LOCATION": LOCATIONS[cluster % len(LOCATIONS)],
                "ORGANISATION": ORGANISATIONS[cluster % len(ORGANISATIONS)],
                "DEVICE": f"DEVICE-{(cluster % 12) + 1:03d}",
            }
            entity_rows = {}
            for kind, value in shared_values.items():
                entity = ensure_entity(db, case, idx, kind, value, f"Shared synthetic {kind.lower()} for cross-case demonstration.")
                entity_rows[kind] = entity
                ensure_identifier(db, case, kind, value, entity_id=entity.id, evidence_id=evidence_rows[(len(entity_rows)-1) % len(evidence_rows)].id)
            db.flush()

            # 15 valid relationship records per case with evidence provenance.
            rel_types = ["Communication", "Financial Transfer", "Associated With", "Used By", "Owned By", "Seen At Same Location"]
            all_targets = list(entity_rows.values())
            rel_idx = 1
            for p_pos, p in enumerate(linked_people):
                target = all_targets[p_pos % len(all_targets)]
                ensure_relationship(
                    db, case, idx, rel_idx,
                    "Person", p.person_id,
                    "Entity", target.entity_id,
                    rel_types[(p_pos + idx) % len(rel_types)],
                    evidence_rows[p_pos % len(evidence_rows)],
                )
                rel_idx += 1
            while rel_idx <= RELATIONSHIPS_PER_CASE:
                p1 = linked_people[(rel_idx * 2) % len(linked_people)]
                p2 = linked_people[(rel_idx * 3 + 1) % len(linked_people)]
                if p1.id == p2.id:
                    p2 = linked_people[(rel_idx * 3 + 2) % len(linked_people)]
                ensure_relationship(
                    db, case, idx, rel_idx,
                    "Person", p1.person_id,
                    "Person", p2.person_id,
                    rel_types[(rel_idx + idx) % len(rel_types)],
                    evidence_rows[rel_idx % len(evidence_rows)],
                )
                rel_idx += 1

            ensure_analysis_alerts_leads(db, case, idx, evidence_rows, list(entity_rows.values()))
            ensure_timeline_diary(db, case, idx, evidence_rows)
            ensure_legal_links(db, case, idx)
            ensure_forensic_assignments(db, case, idx, evidence_rows)
            db.commit()

            print(f"Seeded {case.case_id}: {len(linked_people)} people, {len(evidence_rows)} evidence, {RELATIONSHIPS_PER_CASE} relationships")

        # Materialize cross-case matches for repeated identifiers.
        identifiers = db.query(models.EntityIdentifier).all()
        grouped = {}
        for row in identifiers:
            grouped.setdefault((row.identifier_type, row.normalized_value), set()).add(row.case_id)
        created_matches = 0
        for (kind, value), case_ids in grouped.items():
            ids = sorted(case_ids)
            if len(ids) < 2:
                continue
            for a_pos in range(len(ids)):
                for b_pos in range(a_pos + 1, len(ids)):
                    a, b = ids[a_pos], ids[b_pos]
                    exists = db.query(models.CrossCaseMatch).filter(
                        models.CrossCaseMatch.identifier_type == kind,
                        models.CrossCaseMatch.normalized_value == value,
                        models.CrossCaseMatch.case_a_id == a,
                        models.CrossCaseMatch.case_b_id == b,
                    ).first()
                    if exists:
                        continue
                    db.add(models.CrossCaseMatch(
                        identifier_type=kind,
                        normalized_value=value,
                        case_a_id=a,
                        case_b_id=b,
                        confidence=None,
                        status="Pending Review",
                        rationale=f"Same normalized {kind.lower()} appears in both synthetic investigations.",
                        supporting_json={"source": "Synthetic Connected Dataset"},
                    ))
                    created_matches += 1
        db.commit()

        print("\nSummary")
        print("-------")
        for label, model in [
            ("Cases", models.Case),
            ("Persons", models.Person),
            ("Case-person links", models.CasePerson),
            ("Evidence", models.Evidence),
            ("Relationships", models.IntelligenceRelationship),
            ("Identifiers", models.EntityIdentifier),
            ("Cross-case matches", models.CrossCaseMatch),
            ("Leads", models.IntelligenceLead),
            ("Alerts", models.IntelligenceAlert),
            ("Timeline events", models.TimelineEvent),
            ("Diary entries", models.CaseDiary),
            ("Forensic assignments", models.ForensicAssignment),
            ("Legal links", models.CaseLegalSection),
            ("Master data", models.MasterDataItem),
        ]:
            print(f"{label:22}: {db.query(model).count()}")
        print(f"New cross-case matches  : {created_matches}")
        print("\nExisting CINTRA-DEMO evidence and integrity history were not deleted or modified.")
        print("Safe to re-run: records are created only when missing.")

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
