from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    File,
    Form
)
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app import models, schemas
from app.utils.security import get_current_officer
from app.services.file_service import save_scan_image


router = APIRouter(
    prefix="/scans",
    tags=["Scans"]
)


# ---------- CREATE SCAN ----------

@router.post(
    "/",
    response_model=schemas.ScanResponse
)
def create_scan(
    scan_id: str = Form(...),
    file: UploadFile = File(...),
    case_id: Optional[int] = Form(None),
    source: Optional[str] = Form(None),
    device_id: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer)
):
    existing_scan = db.query(
        models.Scan
    ).filter(
        models.Scan.scan_id == scan_id
    ).first()

    if existing_scan:
        raise HTTPException(
            status_code=400,
            detail="Scan ID already exists"
        )

    if case_id is not None:
        case = db.query(
            models.Case
        ).filter(
            models.Case.id == case_id
        ).first()

        if not case:
            raise HTTPException(
                status_code=404,
                detail="Case not found"
            )

    image_path = save_scan_image(
        file=file,
        scan_id=scan_id
    )

    new_scan = models.Scan(
        scan_id=scan_id,
        case_id=case_id,
        image_path=image_path,
        matched_person_id=None,
        confidence=None,
        match_status="Pending",
        verification_status="Unverified",
        source=source,
        device_id=device_id,
        officer_id=current_officer.officer_id
    )

    db.add(new_scan)
    db.commit()
    db.refresh(new_scan)

    return new_scan


# ---------- GET ALL SCANS ----------

@router.get(
    "/",
    response_model=List[schemas.ScanResponse]
)
def get_scans(
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer)
):
    return db.query(
        models.Scan
    ).order_by(
        models.Scan.scanned_at.desc()
    ).all()


# ---------- GET LATEST SCAN ----------

@router.get(
    "/latest",
    response_model=Optional[schemas.ScanResponse]
)
def get_latest_scan(
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer)
):
    return db.query(
        models.Scan
    ).order_by(
        models.Scan.scanned_at.desc()
    ).first()


# ---------- GET ONE SCAN ----------

@router.get(
    "/{scan_id}",
    response_model=schemas.ScanResponse
)
def get_scan(
    scan_id: int,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer)
):
    scan = db.query(
        models.Scan
    ).filter(
        models.Scan.id == scan_id
    ).first()

    if not scan:
        raise HTTPException(
            status_code=404,
            detail="Scan not found"
        )

    return scan


# ---------- UPDATE SCAN RESULT ----------

@router.put(
    "/{scan_id}",
    response_model=schemas.ScanResponse
)
def update_scan(
    scan_id: int,
    scan_data: schemas.ScanUpdate,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer)
):
    scan = db.query(
        models.Scan
    ).filter(
        models.Scan.id == scan_id
    ).first()

    if not scan:
        raise HTTPException(
            status_code=404,
            detail="Scan not found"
        )

    update_data = scan_data.model_dump(
        exclude_unset=True
    )

    matched_person_id = update_data.get(
        "matched_person_id"
    )

    if matched_person_id is not None:
        person = db.query(
            models.Person
        ).filter(
            models.Person.id == matched_person_id
        ).first()

        if not person:
            raise HTTPException(
                status_code=404,
                detail="Matched person not found"
            )

    for key, value in update_data.items():
        setattr(
            scan,
            key,
            value
        )

    db.commit()
    db.refresh(scan)

    return scan