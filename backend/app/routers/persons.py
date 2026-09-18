from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    File
)
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app import crud, schemas, models
from app.utils.security import get_current_officer
from app.services.file_service import save_person_image


router = APIRouter(
    prefix="/persons",
    tags=["Persons"],
    dependencies=[Depends(get_current_officer)]
)


# ============================================================
# SEEDED DEMO IDENTITY GROUPS
# ============================================================

# The original synthetic dataset repeats the same 20 people
# every 20 IDs:
#   SYN-P-001, 021, 041, 061, 081, 101 -> one demo identity
#   SYN-P-002, 022, 042, ...          -> another identity
#
# IMPORTANT:
# Only the known seed range 001..120 is grouped.
# A future/manual record such as SYN-P-201 is NOT merged merely
# because its name matches somebody else.
CANONICAL_PERSON_GROUPS = {
    f"SYN-P-{base:03d}": [
        f"SYN-P-{base + (20 * offset):03d}"
        for offset in range(6)
    ]
    for base in range(1, 21)
}

SEED_ID_TO_CANONICAL = {
    member_id: canonical_id
    for canonical_id, member_ids in CANONICAL_PERSON_GROUPS.items()
    for member_id in member_ids
}


ROLE_PRIORITY = {
    "prime suspect": 0,
    "suspect": 1,
    "accused": 1,
    "person of interest": 2,
    "poi": 2,
    "associate": 3,
    "witness": 4,
    "victim": 5,
}


def _canonical_external_id(
    person_id: str | None
) -> str | None:
    value = str(person_id or "").strip().upper()

    if not value:
        return None

    return SEED_ID_TO_CANONICAL.get(
        value,
        value
    )


def _identity_key(
    person: models.Person
) -> tuple[str, str]:
    canonical_id = _canonical_external_id(
        person.person_id
    )

    if canonical_id in CANONICAL_PERSON_GROUPS:
        return (
            "seed-group",
            canonical_id
        )

    return (
        "person-row",
        str(person.id)
    )


def _get_unified_members(
    db: Session,
    person: models.Person
) -> list[models.Person]:
    """
    Return all Person rows belonging to the same known seed identity.

    Manual/unmapped rows remain separate even when names match.
    """
    canonical_id = _canonical_external_id(
        person.person_id
    )

    member_external_ids = CANONICAL_PERSON_GROUPS.get(
        canonical_id
    )

    if not member_external_ids:
        return [person]

    members = db.query(
        models.Person
    ).filter(
        models.Person.person_id.in_(
            member_external_ids
        )
    ).order_by(
        models.Person.id.asc()
    ).all()

    return members or [person]


def _canonical_record(
    db: Session,
    person: models.Person
) -> models.Person:
    members = _get_unified_members(
        db,
        person
    )

    canonical_id = _canonical_external_id(
        person.person_id
    )

    exact = next(
        (
            item
            for item in members
            if str(
                item.person_id
            ).upper() == canonical_id
        ),
        None
    )

    return exact or min(
        members,
        key=lambda item: item.id
    )


def _role_rank(
    role: str | None
) -> int:
    return ROLE_PRIORITY.get(
        str(role or "").strip().lower(),
        99
    )


def _best_role(
    roles: list[str]
) -> str:
    clean_roles = []

    for role in roles:
        value = str(role or "").strip()

        if (
            value
            and value not in clean_roles
        ):
            clean_roles.append(
                value
            )

    if not clean_roles:
        return "—"

    return sorted(
        clean_roles,
        key=_role_rank
    )[0]


def _merged_roles(
    roles: list[str]
) -> str:
    """
    Preserve conflicting old seed roles without repeating the case.
    Example:
      Person of Interest + Witness
      -> "Person of Interest / Witness"
    """
    clean_roles = []

    for role in roles:
        value = str(role or "").strip()

        if (
            value
            and value not in clean_roles
        ):
            clean_roles.append(
                value
            )

    clean_roles.sort(
        key=_role_rank
    )

    return " / ".join(
        clean_roles
    ) or "—"


def _get_unified_directory(
    db: Session
) -> list[models.Person]:
    """
    Return one visible record per known synthetic seed identity while
    leaving all manual/unmapped identities untouched.
    """
    all_people = db.query(
        models.Person
    ).order_by(
        models.Person.id.asc()
    ).all()

    result = []
    seen = set()

    for person in all_people:
        key = _identity_key(
            person
        )

        if key in seen:
            continue

        seen.add(key)

        result.append(
            _canonical_record(
                db,
                person
            )
        )

    return result


# ============================================================
# CREATE PERSON
# ============================================================

@router.post(
    "/",
    response_model=schemas.PersonResponse
)
def create_person(
    person: schemas.PersonCreate,
    db: Session = Depends(get_db)
):
    return crud.create_person(
        db,
        person
    )


# ============================================================
# GLOBAL PERSON DIRECTORY
# ============================================================

@router.get(
    "/",
    response_model=List[
        schemas.PersonResponse
    ]
)
def get_persons(
    db: Session = Depends(get_db)
):
    return _get_unified_directory(
        db
    )


# ============================================================
# PERSONS BY CASE
# ============================================================

@router.get(
    "/case/{case_id}"
)
def get_persons_by_case(
    case_id: int,
    db: Session = Depends(get_db)
):
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

    links = db.query(
        models.CasePerson
    ).filter(
        models.CasePerson.case_id == case_id
    ).all()

    grouped = {}

    for link in links:
        person = db.query(
            models.Person
        ).filter(
            models.Person.id == link.person_id
        ).first()

        if not person:
            continue

        key = _identity_key(
            person
        )

        if key not in grouped:
            grouped[key] = {
                "person": _canonical_record(
                    db,
                    person
                ),
                "roles": []
            }

        grouped[
            key
        ][
            "roles"
        ].append(
            link.role_in_case
        )

    results = []

    for item in grouped.values():
        display_person = item[
            "person"
        ]

        results.append(
            {
                "id": display_person.id,
                "person_id": display_person.person_id,
                "name": display_person.name,
                "age": display_person.age,
                "gender": display_person.gender,
                "phone": display_person.phone,
                "address": display_person.address,
                "role": display_person.role,
                "status": display_person.status,
                "profile_image_path":
                    display_person.profile_image_path,
                "created_at":
                    display_person.created_at,
                # One case-specific display role.
                "role_in_case":
                    _best_role(
                        item["roles"]
                    )
            }
        )

    return results


# ============================================================
# LINK PERSON TO CASE
# ============================================================

@router.post(
    "/link-to-case/",
    response_model=schemas.CasePersonResponse
)
def link_person_to_case(
    link: schemas.CasePersonCreate,
    db: Session = Depends(get_db)
):
    selected_person = db.query(
        models.Person
    ).filter(
        models.Person.id == link.person_id
    ).first()

    case = db.query(
        models.Case
    ).filter(
        models.Case.id == link.case_id
    ).first()

    if (
        not selected_person
        or not case
    ):
        raise HTTPException(
            status_code=404,
            detail="Case or person not found"
        )

    member_ids = [
        member.id
        for member in _get_unified_members(
            db,
            selected_person
        )
    ]

    existing = db.query(
        models.CasePerson
    ).filter(
        models.CasePerson.case_id == link.case_id,
        models.CasePerson.person_id.in_(
            member_ids
        )
    ).first()

    if existing:
        # Do not create a second link for the same unified person/case.
        return existing

    return crud.link_person_to_case(
        db,
        link
    )


# ============================================================
# UNIFIED PERSON DETAILS + UNIQUE ASSOCIATED CASES
# ============================================================

@router.get(
    "/{person_id}/profile",
    response_model=schemas.PersonDetailResponse
)
@router.get(
    "/{person_id}/details",
    response_model=schemas.PersonDetailResponse
)
def get_person_details(
    person_id: int,
    db: Session = Depends(get_db)
):
    selected_person = db.query(
        models.Person
    ).filter(
        models.Person.id == person_id
    ).first()

    if not selected_person:
        raise HTTPException(
            status_code=404,
            detail="Person not found"
        )

    members = _get_unified_members(
        db,
        selected_person
    )

    canonical_person = _canonical_record(
        db,
        selected_person
    )

    member_ids = [
        member.id
        for member in members
    ]

    links = db.query(
        models.CasePerson
    ).filter(
        models.CasePerson.person_id.in_(
            member_ids
        )
    ).all()

    # Key by the actual database case ID.
    # This guarantees one visible row per case.
    associated_cases_by_id = {}

    for link in links:
        case = db.query(
            models.Case
        ).filter(
            models.Case.id == link.case_id
        ).first()

        if not case:
            continue

        if (
            case.id not in
            associated_cases_by_id
        ):
            associated_cases_by_id[
                case.id
            ] = {
                "case_database_id": case.id,
                "case_id": case.case_id,
                "fir_number": case.fir_number,
                "title": case.title,
                "offence": case.offence,
                "police_station": case.police_station,
                "investigating_officer":
                    case.investigating_officer,
                "stage": case.stage,
                "status": case.status,
                "registered_on": case.registered_on,
                "_roles": []
            }

        associated_cases_by_id[
            case.id
        ][
            "_roles"
        ].append(
            link.role_in_case
        )

    associated_cases = []

    for item in associated_cases_by_id.values():
        roles = item.pop(
            "_roles",
            []
        )

        item[
            "role_in_case"
        ] = _merged_roles(
            roles
        )

        associated_cases.append(
            item
        )

    associated_cases.sort(
        key=lambda item: (
            item[
                "registered_on"
            ] is not None,
            item[
                "registered_on"
            ]
        ),
        reverse=True
    )

    # Evidence uploaded from the field app is linked through an
    # IntelligenceRelationship.  Expose those records as `documents` so the
    # existing Persons UI automatically shows them in Documents & Records.
    member_external_ids = [member.person_id for member in members]
    relationship_rows = db.query(models.IntelligenceRelationship).filter(
        (
            (models.IntelligenceRelationship.source_type == "Person")
            & (models.IntelligenceRelationship.source_ref.in_(member_external_ids))
            & (models.IntelligenceRelationship.target_type == "Evidence")
        )
        |
        (
            (models.IntelligenceRelationship.target_type == "Person")
            & (models.IntelligenceRelationship.target_ref.in_(member_external_ids))
            & (models.IntelligenceRelationship.source_type == "Evidence")
        )
    ).all()

    evidence_refs = set()
    for relationship in relationship_rows:
        if relationship.source_type == "Evidence":
            evidence_refs.add(relationship.source_ref)
        if relationship.target_type == "Evidence":
            evidence_refs.add(relationship.target_ref)

    documents = []
    if evidence_refs:
        evidence_rows = db.query(models.Evidence).filter(
            models.Evidence.evidence_id.in_(list(evidence_refs))
        ).order_by(models.Evidence.uploaded_at.desc()).all()
        for evidence in evidence_rows:
            documents.append({
                "id": evidence.id,
                "document_id": evidence.evidence_id,
                "evidence_id": evidence.evidence_id,
                "title": evidence.title,
                "type": evidence.evidence_type,
                "document_type": evidence.evidence_type,
                "file_path": evidence.file_path,
                "source": evidence.source,
                "description": evidence.description,
                "sha256_hash": evidence.sha256_hash,
                "case_id": evidence.case_id,
                "uploaded_at": evidence.uploaded_at,
            })

    return {
        "id": canonical_person.id,
        "person_id":
            canonical_person.person_id,
        "name":
            canonical_person.name,
        "age":
            canonical_person.age,
        "gender":
            canonical_person.gender,
        "phone":
            canonical_person.phone,
        "address":
            canonical_person.address,
        "role":
            canonical_person.role,
        "status":
            canonical_person.status,
        "profile_image_path":
            canonical_person.profile_image_path,
        "created_at":
            canonical_person.created_at,
        "associated_cases":
            associated_cases,
        "documents": documents
    }


# ============================================================
# UPLOAD PERSON PHOTO
# ============================================================

@router.post(
    "/{person_id}/upload-photo",
    response_model=schemas.PersonResponse
)
def upload_person_photo(
    person_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    selected_person = db.query(
        models.Person
    ).filter(
        models.Person.id == person_id
    ).first()

    if not selected_person:
        raise HTTPException(
            status_code=404,
            detail="Person not found"
        )

    person = _canonical_record(
        db,
        selected_person
    )

    image_path = save_person_image(
        file=file,
        person_id=person.person_id
    )

    person.profile_image_path = (
        image_path
    )

    db.commit()
    db.refresh(person)

    return person


# ============================================================
# GET ONE PERSON
# ============================================================

@router.get(
    "/{person_id}",
    response_model=schemas.PersonResponse
)
def get_person(
    person_id: int,
    db: Session = Depends(get_db)
):
    person = crud.get_person_by_id(
        db,
        person_id
    )

    if not person:
        raise HTTPException(
            status_code=404,
            detail="Person not found"
        )

    return _canonical_record(
        db,
        person
    )
