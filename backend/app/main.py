from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import Base, engine
from app import models

from app.routers import (
    cases,
    persons,
    evidence,
    diary,
    search,
    auth,
    chargesheet,
    scans,
    intelligence,
    relationships,
    government_data,
    admin,
    forensics,
    forensic_integrity,
    legal,
    master_data,
    cross_case,
    cross_case_graph,
    timeline,
    custody,
    case_intelligence,
    features,
    mobile_api,
)


# ============================================================
# DATABASE
# ============================================================

Base.metadata.create_all(bind=engine)


# ============================================================
# APPLICATION
# ============================================================

app = FastAPI(
    title="CINTRA API",
    version="1.0.0",
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:3000",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:5174",
        "http://localhost:5174",
        "https://cintra-sand.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# ROUTERS
# ============================================================

app.include_router(auth.router)
app.include_router(admin.router)

app.include_router(cases.router)
app.include_router(persons.router)
app.include_router(evidence.router)
app.include_router(diary.router)

app.include_router(search.router)
app.include_router(chargesheet.router)
app.include_router(scans.router)

app.include_router(intelligence.router)
app.include_router(relationships.router)

app.include_router(government_data.router)

app.include_router(forensics.router)
app.include_router(forensic_integrity.router)

app.include_router(legal.router)
app.include_router(master_data.router)

app.include_router(cross_case.router)

# GLOBAL CROSS-CASE NETWORK
app.include_router(cross_case_graph.router)

app.include_router(timeline.router)
app.include_router(custody.router)
app.include_router(case_intelligence.router)
app.include_router(features.router)

# Shared API used by the React Native field companion.
app.include_router(mobile_api.router)


# ============================================================
# UPLOAD DIRECTORIES
# ============================================================

BASE_DIR = (
    Path(__file__)
    .resolve()
    .parent
    .parent
)

EVIDENCE_DIR = (
    BASE_DIR
    / "uploads"
    / "evidence"
)

PERSONS_DIR = (
    BASE_DIR
    / "uploads"
    / "persons"
)

SCANS_DIR = (
    BASE_DIR
    / "uploads"
    / "scans"
)

GENERATED_DIR = (
    BASE_DIR
    / "uploads"
    / "generated"
)

FORENSIC_ARTIFACTS_DIR = (
    BASE_DIR
    / "uploads"
    / "forensic_artifacts"
)


# ============================================================
# CREATE UPLOAD DIRECTORIES
# ============================================================

EVIDENCE_DIR.mkdir(
    parents=True,
    exist_ok=True,
)

PERSONS_DIR.mkdir(
    parents=True,
    exist_ok=True,
)

SCANS_DIR.mkdir(
    parents=True,
    exist_ok=True,
)

GENERATED_DIR.mkdir(
    parents=True,
    exist_ok=True,
)

FORENSIC_ARTIFACTS_DIR.mkdir(
    parents=True,
    exist_ok=True,
)


# ============================================================
# STATIC FILES — EVIDENCE
# ============================================================

app.mount(
    "/uploads/evidence",
    StaticFiles(
        directory=EVIDENCE_DIR,
    ),
    name="evidence-files",
)


# ============================================================
# STATIC FILES — PERSON PROFILE IMAGES
# ============================================================

app.mount(
    "/uploads/persons",
    StaticFiles(
        directory=PERSONS_DIR,
    ),
    name="person-images",
)


# ============================================================
# STATIC FILES — FACE SCAN IMAGES
# ============================================================

app.mount(
    "/uploads/scans",
    StaticFiles(
        directory=SCANS_DIR,
    ),
    name="scan-images",
)


# ============================================================
# STATIC FILES — GENERATED CHARGESHEETS
# ============================================================

app.mount(
    "/uploads/generated",
    StaticFiles(
        directory=GENERATED_DIR,
    ),
    name="generated-files",
)


# ============================================================
# STATIC FILES — FORENSIC ARTIFACTS
# ============================================================

app.mount(
    "/uploads/forensic_artifacts",
    StaticFiles(
        directory=FORENSIC_ARTIFACTS_DIR,
    ),
    name="forensic-artifact-files",
)


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():
    return {
        "message": "CINTRA API is running",
    }