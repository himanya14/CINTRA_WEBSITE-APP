from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException

from app import models, schemas


# ---------- CASES ----------

def create_case(
    db: Session,
    case: schemas.CaseCreate
):
    existing_case_id = db.query(
        models.Case
    ).filter(
        models.Case.case_id == case.case_id
    ).first()

    if existing_case_id:
        raise HTTPException(
            status_code=400,
            detail="Case ID already exists"
        )

    existing_fir = db.query(
        models.Case
    ).filter(
        models.Case.fir_number == case.fir_number
    ).first()

    if existing_fir:
        raise HTTPException(
            status_code=400,
            detail="FIR number already exists"
        )

    new_case = models.Case(
        **case.model_dump()
    )

    try:
        db.add(new_case)
        db.commit()
        db.refresh(new_case)

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=400,
            detail="Could not create case because duplicate data exists"
        )

    return new_case


def get_cases(
    db: Session
):
    return db.query(
        models.Case
    ).order_by(
        models.Case.registered_on.desc()
    ).all()


def get_case_by_id(
    db: Session,
    case_id: int
):
    return db.query(
        models.Case
    ).filter(
        models.Case.id == case_id
    ).first()


def update_case(
    db: Session,
    case_id: int,
    case_data: schemas.CaseUpdate
):
    case = db.query(
        models.Case
    ).filter(
        models.Case.id == case_id
    ).first()

    if not case:
        return None

    update_data = case_data.model_dump(
        exclude_unset=True
    )

    for key, value in update_data.items():
        setattr(
            case,
            key,
            value
        )

    try:
        db.commit()
        db.refresh(case)

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=400,
            detail="Could not update case because duplicate data exists"
        )

    return case


# ---------- PERSONS ----------

def create_person(
    db: Session,
    person: schemas.PersonCreate
):
    existing_person = db.query(
        models.Person
    ).filter(
        models.Person.person_id == person.person_id
    ).first()

    if existing_person:
        raise HTTPException(
            status_code=400,
            detail="Person ID already exists"
        )

    new_person = models.Person(
        **person.model_dump()
    )

    try:
        db.add(new_person)
        db.commit()
        db.refresh(new_person)

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=400,
            detail="Could not create person because duplicate data exists"
        )

    return new_person


def get_persons(
    db: Session
):
    return db.query(
        models.Person
    ).order_by(
        models.Person.created_at.desc()
    ).all()


def get_person_by_id(
    db: Session,
    person_id: int
):
    return db.query(
        models.Person
    ).filter(
        models.Person.id == person_id
    ).first()


# ---------- CASE-PERSON LINKS ----------

def link_person_to_case(
    db: Session,
    link: schemas.CasePersonCreate
):
    case = db.query(
        models.Case
    ).filter(
        models.Case.id == link.case_id
    ).first()

    person = db.query(
        models.Person
    ).filter(
        models.Person.id == link.person_id
    ).first()

    if not case or not person:
        return None

    existing_link = db.query(
        models.CasePerson
    ).filter(
        models.CasePerson.case_id == link.case_id,
        models.CasePerson.person_id == link.person_id
    ).first()

    if existing_link:
        raise HTTPException(
            status_code=400,
            detail="Person is already linked to this case"
        )

    new_link = models.CasePerson(
        case_id=link.case_id,
        person_id=link.person_id,
        role_in_case=link.role_in_case
    )

    db.add(new_link)
    db.commit()
    db.refresh(new_link)

    return new_link


def get_case_persons(
    db: Session,
    case_id: int
):
    return db.query(
        models.CasePerson
    ).filter(
        models.CasePerson.case_id == case_id
    ).all()


# ---------- EVIDENCE ----------

def create_evidence(
    db: Session,
    evidence: schemas.EvidenceCreate
):
    case = db.query(
        models.Case
    ).filter(
        models.Case.id == evidence.case_id
    ).first()

    if not case:
        return None

    existing_evidence = db.query(
        models.Evidence
    ).filter(
        models.Evidence.evidence_id
        == evidence.evidence_id
    ).first()

    if existing_evidence:
        raise HTTPException(
            status_code=400,
            detail="Evidence ID already exists"
        )

    new_evidence = models.Evidence(
        **evidence.model_dump()
    )

    try:
        db.add(new_evidence)
        db.commit()
        db.refresh(new_evidence)

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=400,
            detail="Could not create evidence because duplicate data exists"
        )

    return new_evidence


def get_all_evidence(
    db: Session
):
    return db.query(
        models.Evidence
    ).order_by(
        models.Evidence.uploaded_at.desc()
    ).all()


def get_evidence_by_id(
    db: Session,
    evidence_id: int
):
    return db.query(
        models.Evidence
    ).filter(
        models.Evidence.id == evidence_id
    ).first()


def get_evidence_by_case(
    db: Session,
    case_id: int
):
    return db.query(
        models.Evidence
    ).filter(
        models.Evidence.case_id == case_id
    ).order_by(
        models.Evidence.uploaded_at.desc()
    ).all()