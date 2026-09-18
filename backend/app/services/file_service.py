import os
import uuid
import shutil
from pathlib import Path

from fastapi import UploadFile, HTTPException


BASE_DIR = Path(__file__).resolve().parents[2]

EVIDENCE_UPLOAD_DIR = BASE_DIR / "uploads" / "evidence"
PERSON_UPLOAD_DIR = BASE_DIR / "uploads" / "persons"
SCAN_UPLOAD_DIR = BASE_DIR / "uploads" / "scans"


EVIDENCE_UPLOAD_DIR.mkdir(
    parents=True,
    exist_ok=True
)

PERSON_UPLOAD_DIR.mkdir(
    parents=True,
    exist_ok=True
)

SCAN_UPLOAD_DIR.mkdir(
    parents=True,
    exist_ok=True
)


ALLOWED_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".pdf",
    ".mp4",
    ".mov",
    ".avi",
    ".mp3",
    ".wav",
    ".doc",
    ".docx",
    ".txt",
    ".csv",
    ".json"
}


ALLOWED_PERSON_IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png"
}


ALLOWED_SCAN_IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png"
}


# ---------- EVIDENCE FILE ----------

def save_evidence_file(
    file: UploadFile
) -> str:
    original_filename = file.filename

    if not original_filename:
        raise HTTPException(
            status_code=400,
            detail="File must have a filename"
        )

    extension = Path(
        original_filename
    ).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Unsupported evidence file type"
        )

    unique_filename = (
        f"{uuid.uuid4().hex}{extension}"
    )

    physical_file_path = (
        EVIDENCE_UPLOAD_DIR /
        unique_filename
    )

    try:
        with open(
            physical_file_path,
            "wb"
        ) as buffer:
            shutil.copyfileobj(
                file.file,
                buffer
            )

    except Exception:
        if physical_file_path.exists():
            os.remove(
                physical_file_path
            )

        raise HTTPException(
            status_code=500,
            detail="Could not save evidence file"
        )

    return (
        f"/uploads/evidence/"
        f"{unique_filename}"
    )


# ---------- PERSON PROFILE IMAGE ----------

def save_person_image(
    file: UploadFile,
    person_id: str
) -> str:
    original_filename = file.filename

    if not original_filename:
        raise HTTPException(
            status_code=400,
            detail="Image must have a filename"
        )

    extension = Path(
        original_filename
    ).suffix.lower()

    if extension not in ALLOWED_PERSON_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Person photo must be JPG, JPEG, or PNG"
        )

    unique_filename = (
        f"{person_id}_"
        f"{uuid.uuid4().hex[:8]}"
        f"{extension}"
    )

    physical_file_path = (
        PERSON_UPLOAD_DIR /
        unique_filename
    )

    try:
        with open(
            physical_file_path,
            "wb"
        ) as buffer:
            shutil.copyfileobj(
                file.file,
                buffer
            )

    except Exception:
        if physical_file_path.exists():
            os.remove(
                physical_file_path
            )

        raise HTTPException(
            status_code=500,
            detail="Could not save person image"
        )

    return (
        f"/uploads/persons/"
        f"{unique_filename}"
    )


# ---------- SCAN IMAGE ----------

def save_scan_image(
    file: UploadFile,
    scan_id: str
) -> str:
    original_filename = file.filename

    if not original_filename:
        raise HTTPException(
            status_code=400,
            detail="Scan image must have a filename"
        )

    extension = Path(
        original_filename
    ).suffix.lower()

    if extension not in ALLOWED_SCAN_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Scan image must be JPG, JPEG, or PNG"
        )

    unique_filename = (
        f"{scan_id}_"
        f"{uuid.uuid4().hex[:8]}"
        f"{extension}"
    )

    physical_file_path = (
        SCAN_UPLOAD_DIR /
        unique_filename
    )

    try:
        with open(
            physical_file_path,
            "wb"
        ) as buffer:
            shutil.copyfileobj(
                file.file,
                buffer
            )

    except Exception:
        if physical_file_path.exists():
            os.remove(
                physical_file_path
            )

        raise HTTPException(
            status_code=500,
            detail="Could not save scan image"
        )

    return (
        f"/uploads/scans/"
        f"{unique_filename}"
    )