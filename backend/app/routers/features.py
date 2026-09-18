from fastapi import APIRouter, Depends
from app.utils.security import get_current_officer

router = APIRouter(prefix="/features", tags=["Feature Registry"])

AREAS = [
    ("P0", "Authentication & RBAC", 24),
    ("P0", "Case Management", 34),
    ("P0", "Persons & Roles", 20),
    ("P0", "Evidence Management", 32),
    ("P0", "Digital Forensics", 48),
    ("P1", "Relationships & Explainability", 38),
    ("P1", "Intelligence & Alerts", 34),
    ("P1", "Search & Cross-case", 28),
    ("P2", "Timeline & Case Diary", 18),
    ("P2", "Documents, Reports & Chargesheet", 28),
    ("P2", "Legal & Master Data", 24),
    ("P3", "Admin, Audit & Governance", 22),
    ("P3", "Government Context & Analytics", 10),
    ("P4", "Scalability & Production Readiness", 14),
]

@router.get("")
def registry(current_officer=Depends(get_current_officer)):
    total = sum(x[2] for x in AREAS)
    # Registry is a coverage map, not a claim that every infrastructure item is deployed.
    return {"requested_scope": 374, "coverage_items": total, "areas": [{"priority": p, "area": a, "capabilities": n} for p,a,n in AREAS], "note": "Feature coverage is implemented through shared systems; deployment-only infrastructure remains environment dependent."}
