"""Rebuild derived Relationship Analysis snapshots from the existing central DB.

Safe for demo recovery: this does NOT delete/replace cases, persons, evidence,
relationships, MFA, hashes, or custody records. It only appends one new derived
IntelligenceAnalysis snapshot per case so the web Relationship page sees the
current full case network.
"""
from datetime import datetime

from app.database import SessionLocal
from app import models
from app.services.mobile_bridge_service import build_case_graph_snapshot


def main():
    db = SessionLocal()
    try:
        cases = db.query(models.Case).order_by(models.Case.id.asc()).all()
        if not cases:
            print("No cases found.")
            return

        for case in cases:
            result = build_case_graph_snapshot(db, case)
            result["manual_rebuild"] = {
                "at": datetime.utcnow().isoformat() + "Z",
                "officer_id": "SYSTEM-INTEGRATION",
            }
            analysis = models.IntelligenceAnalysis(
                case_id=case.id,
                source_type="GRAPH_REBUILD",
                input_text="Full relationship graph rebuilt from existing central CINTRA records.",
                result_json=result,
                created_by="SYSTEM-INTEGRATION",
            )
            db.add(analysis)
            db.flush()
            print(
                f"Case {case.id} | {case.fir_number}: "
                f"{len(result.get('nodes') or [])} nodes, "
                f"{len(result.get('edges') or [])} edges"
            )

        db.commit()
        print("Relationship snapshots rebuilt successfully. Existing records were preserved.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
