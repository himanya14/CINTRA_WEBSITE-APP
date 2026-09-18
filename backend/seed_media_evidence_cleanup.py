from __future__ import annotations

import hashlib
import shutil
from datetime import datetime, timedelta
from pathlib import Path

from app.database import SessionLocal
from app import models

BACKEND_ROOT = Path(__file__).resolve().parent
ASSET_ROOT = BACKEND_ROOT / "demo_media_assets"
EVIDENCE_DIR = BACKEND_ROOT / "uploads" / "evidence"
EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
NOW = datetime(2026, 9, 14, 2, 45, 0)

VIDEO_SPECS = {
    1: ("ATM Entrance Camera 03", "ATM vestibule camera showing synthetic subject movement before a communication event. Examination purpose: correlate camera timestamp with CDR and financial evidence."),
    2: ("Parking Area CCTV — North Gate", "Synthetic parking-area footage showing a person and vehicle entering the north gate. Examination purpose: correlate vehicle movement with location records."),
    3: ("Warehouse Gate Camera", "Synthetic fixed-camera footage from a warehouse gate. Examination purpose: review movement around the location referenced in the case timeline."),
    4: ("Apartment Lobby Camera", "Synthetic lobby footage showing movement through the building entrance. Examination purpose: compare entry time against device and call records."),
    5: ("Toll Plaza Vehicle Camera", "Synthetic toll-lane footage containing a vehicle movement event. Examination purpose: compare vehicle timing with location and communication records."),
    6: ("Retail Store Exterior CCTV", "Synthetic storefront footage showing two movement events. Examination purpose: support timeline reconstruction only; footage is not itself a legal conclusion."),
    7: ("Office Corridor Camera", "Synthetic office corridor footage. Examination purpose: compare access timing against recovered document and device records."),
    8: ("Loading Bay CCTV", "Synthetic loading-bay footage showing person and vehicle movement. Examination purpose: compare with location and communication evidence."),
    9: ("Service Alley Camera", "Synthetic alley camera footage. Examination purpose: review movement near a recurring cross-case location."),
    10: ("ATM Exterior Camera 02", "Synthetic ATM exterior footage. Examination purpose: correlate visual timing with a financial transaction window."),
    11: ("Commercial Lobby Camera", "Synthetic commercial-lobby footage. Examination purpose: reconstruct the sequence of entry and exit events."),
    12: ("Parking Exit Camera", "Synthetic parking-exit footage showing a vehicle leaving the area. Examination purpose: compare against witness and location evidence."),
    13: ("Metro Entrance CCTV", "Synthetic metro entrance footage. Examination purpose: support location timeline review."),
    14: ("Warehouse Rear Gate CCTV", "Synthetic rear-gate footage. Examination purpose: compare movement against recovered call and account-transfer timing."),
    15: ("Roadside Observation Camera", "Synthetic roadside footage containing person and vehicle movement. Examination purpose: compare with cross-case vehicle identifiers."),
    16: ("Service Lane CCTV", "Synthetic service-lane footage. Examination purpose: compare vehicle presence with a recovered call about the same location."),
}

AUDIO_SPECS = {
    2: ("Recovered Call Excerpt — Alternate Account", 'Speaker A: “Did the transfer go through?”\nSpeaker B: “Not yet. Send the money to the account I gave you.”\nSpeaker A: “The same one?”\nSpeaker B: “No. Use the second account.”', "Recovered synthetic call excerpt linked to financial and CDR review."),
    4: ("Recovered Voice Note — Payment Request", 'Speaker A: “Send me the money tonight. Do not use the account you used last time.”', "Synthetic recovered voice note. Officer review is required before drawing any legal inference."),
    6: ("Recovered Call — Document Check", 'Speaker A: “I sent the revised document. Check the amount before you forward it.”\nSpeaker B: “I have it. I will check the second page as well.”', "Synthetic call excerpt linked to document examination."),
    8: ("Recovered Conversation — Message Deletion", 'Speaker A: “Did you remove the old messages from the other phone?”\nSpeaker B: “Not yet. I will check it before we leave.”', "Synthetic two-speaker recovered conversation linked to device evidence."),
    10: ("Witness Voice Statement — Vehicle Observation", 'Witness: “I was closing the shop when I noticed a dark vehicle across the road. Two people got out and walked towards the building.”', "Synthetic witness statement for timeline correlation; not itself incriminating."),
    12: ("Recovered Call — Meeting Location", 'Speaker A: “Meet near the rear entrance after nine.”\nSpeaker B: “I will call when I reach the service lane.”', "Synthetic coordination call linked to location records."),
    14: ("Recovered Voice Note — Transfer Follow-up", 'Speaker A: “The payment has not reached this account. Transfer it to the other number I sent you.”', "Synthetic recovered voice note linked to financial records."),
    16: ("Recovered Call — Vehicle Location", 'Speaker A: “The vehicle is parked near the second entrance. Call me when you arrive.”\nSpeaker B: “Understood. I am ten minutes away.”', "Synthetic two-speaker call linked to vehicle and location evidence."),
    18: ("Witness Statement — Parking Exit", 'Witness: “I saw the vehicle leave the parking area a little after nine twenty. I could not see the driver clearly.”', "Synthetic witness audio; this is an observation, not an identification."),
    20: ("Recovered Call — Receipt and Transfer", 'Speaker A: “I have the receipt.”\nSpeaker B: “Keep it with the other papers. I will confirm the transfer later.”', "Synthetic recovered call excerpt linked to document and financial records."),
    22: ("Recovered Voice Note — Account Details", 'Speaker A: “I sent the account details in the message. Please verify the name before sending anything.”', "Synthetic voice note. Relevance requires officer review."),
    24: ("Witness Voice Note — Warehouse Activity", 'Witness: “There was a delivery van at the warehouse gate around eight thirty. I saw two people carrying boxes inside.”', "Synthetic witness observation linked to location and CCTV review."),
}

IMAGE_SPECS = {
    17: ("Recovered Payment Confirmation Screenshot", "Synthetic recovered payment-confirmation screenshot. Examination purpose: compare displayed transaction reference with financial records."),
    18: ("Vehicle Still from Entry Camera", "Synthetic vehicle observation still. Examination purpose: compare visible vehicle identifier with cross-case records."),
    19: ("Photograph of Altered Invoice", "Synthetic photograph of an altered invoice used for document-forensics demonstration."),
    20: ("ATM Camera Still — Person at Terminal", "Synthetic extracted CCTV still. Examination purpose: compare frame time against financial and CDR records."),
    21: ("Recovered Messaging Screenshot", "Synthetic recovered messaging screenshot containing a reference to an alternate account."),
    22: ("Photograph of ATM Receipt", "Synthetic ATM receipt image for transaction-reference comparison."),
    23: ("Seized Device Photograph", "Synthetic device exhibit photograph linked to device extraction records."),
    24: ("Warehouse Entrance Still", "Synthetic warehouse observation still linked to witness and location evidence."),
}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def rel(path: Path) -> str:
    return path.relative_to(BACKEND_ROOT).as_posix()


def get_case(db, number: int):
    return db.query(models.Case).filter(models.Case.case_id == f"CINTRA-SYN-{number:03d}").first()


def install_asset(relative_asset: str, output_name: str) -> Path:
    source = ASSET_ROOT / relative_asset
    if not source.exists():
        raise FileNotFoundError(f"Patch asset missing: {source}")
    target = EVIDENCE_DIR / output_name
    if not target.exists() or sha256(target) != sha256(source):
        shutil.copy2(source, target)
    return target


def ensure_evidence(db, case, ref: str, title: str, evidence_type: str, description: str, asset: str, filename: str, collected_at: datetime):
    row = db.query(models.Evidence).filter(models.Evidence.evidence_id == ref).first()
    if row:
        return row, False

    installed = install_asset(asset, filename)
    row = models.Evidence(
        evidence_id=ref,
        case_id=case.id,
        title=title,
        evidence_type=evidence_type,
        description=(
            "SYNTHETIC DEMO MEDIA — fictional evidence created only for CINTRA demonstration.\n\n"
            + description
        ),
        file_path=rel(installed),
        sha256_hash=sha256(installed),
        source="CINTRA Synthetic Demo Media Set",
        collected_by="INV-001",
        collected_at=collected_at,
        status="Collected",
    )
    db.add(row)
    db.flush()
    return row, True


def ensure_timeline(db, case, evidence, title: str, at: datetime):
    if not hasattr(models, "TimelineEvent"):
        return
    exists = db.query(models.TimelineEvent).filter(
        models.TimelineEvent.case_id == case.id,
        models.TimelineEvent.source_type == "Evidence",
        models.TimelineEvent.source_id == evidence.evidence_id,
    ).first()
    if exists:
        return
    db.add(models.TimelineEvent(
        case_id=case.id,
        event_type="MEDIA_EVIDENCE",
        title=title,
        description=f"Synthetic media evidence {evidence.evidence_id} added to the investigation timeline.",
        event_at=at,
        source_type="Evidence",
        source_id=evidence.evidence_id,
        evidence_id=evidence.id,
        officer_id="INV-001",
        confidence=None,
        metadata_json={"synthetic": True, "media_type": evidence.evidence_type},
    ))


def ensure_custody(db, evidence):
    if not hasattr(models, "ChainOfCustodyEvent"):
        return
    exists = db.query(models.ChainOfCustodyEvent).filter(
        models.ChainOfCustodyEvent.evidence_id == evidence.id,
        models.ChainOfCustodyEvent.action == "Synthetic Demo Media Ingested",
    ).first()
    if exists:
        return
    db.add(models.ChainOfCustodyEvent(
        evidence_id=evidence.id,
        action="Synthetic Demo Media Ingested",
        from_officer=None,
        to_officer="FA-001",
        location="CINTRA Demo Evidence Store",
        notes="Synthetic demonstration media ingested with SHA-256 baseline. Not real-world evidence.",
        recorded_by="SYSTEM",
    ))


def archive_legacy_placeholders(db):
    rows = db.query(models.Evidence).filter(models.Evidence.evidence_id.like("SYN-EVD-%")).all()
    changed = 0
    for row in rows:
        parts = str(row.evidence_id).split("-")
        if len(parts) < 5:
            continue
        suffix = parts[-1]
        if suffix not in {"04", "08"}:
            continue
        title = (row.title or "").lower()
        if "evidence 04" in title or "evidence 08" in title or "cctv image evidence" in title or "communication record evidence" in title:
            if row.status != "Archived Demo Placeholder":
                row.status = "Archived Demo Placeholder"
                changed += 1
    return changed


def main():
    print("CINTRA Media Evidence Cleanup + Real Demo Media")
    print("================================================")
    db = SessionLocal()
    created_video = created_audio = created_image = 0
    try:
        archived = archive_legacy_placeholders(db)

        for case_no, (title, desc) in VIDEO_SPECS.items():
            case = get_case(db, case_no)
            if not case:
                continue
            at = NOW - timedelta(days=case_no % 12, hours=3)
            ev, created = ensure_evidence(
                db, case, f"SYN-MEDIA-{case_no:03d}-V01", title, "CCTV Video",
                desc + "\n\nExamination note: visual observations require officer verification and must be interpreted with supporting records.",
                f"videos/case_{case_no:03d}_cctv.mp4", f"syn_case_{case_no:03d}_cctv.mp4", at,
            )
            created_video += int(created)
            ensure_timeline(db, case, ev, title, at)
            ensure_custody(db, ev)

        for case_no, (title, transcript, note) in AUDIO_SPECS.items():
            case = get_case(db, case_no)
            if not case:
                continue
            at = NOW - timedelta(days=case_no % 10, hours=2, minutes=case_no)
            description = f"{note}\n\nTranscript:\n{transcript}\n\nExamination purpose: compare spoken references and timing with CDR, location, device or financial evidence. Transcript is part of a synthetic demonstration record."
            ev, created = ensure_evidence(
                db, case, f"SYN-MEDIA-{case_no:03d}-A01", title, "Audio Recording",
                description, f"audio/case_{case_no:03d}_audio.wav", f"syn_case_{case_no:03d}_audio.wav", at,
            )
            created_audio += int(created)
            ensure_timeline(db, case, ev, title, at)
            ensure_custody(db, ev)

        for case_no, (title, desc) in IMAGE_SPECS.items():
            case = get_case(db, case_no)
            if not case:
                continue
            at = NOW - timedelta(days=case_no % 8, hours=1)
            ev, created = ensure_evidence(
                db, case, f"SYN-MEDIA-{case_no:03d}-I01", title, "Evidence Image",
                desc + "\n\nExamination purpose: compare visual details with structured case records. This is synthetic demonstration evidence.",
                f"images/case_{case_no:03d}_image.png", f"syn_case_{case_no:03d}_image.png", at,
            )
            created_image += int(created)
            ensure_timeline(db, case, ev, title, at)
            ensure_custody(db, ev)

        db.commit()

        total_media = db.query(models.Evidence).filter(models.Evidence.source == "CINTRA Synthetic Demo Media Set").count()
        print(f"Archived old repetitive media placeholders : {archived}")
        print(f"New CCTV video records created            : {created_video}")
        print(f"New spoken audio records created          : {created_audio}")
        print(f"New useful image records created          : {created_image}")
        print(f"Synthetic demo media records available    : {total_media}")
        print("\nOriginal EVD-VIDEO-001 and existing forensic integrity baselines were not modified.")
        print("Legacy repetitive records remain in the database for audit safety but are hidden from Media/CDR queues by the updated frontend.")
        print("Safe to re-run: existing SYN-MEDIA records are not duplicated.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
