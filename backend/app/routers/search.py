from fastapi import (
    APIRouter,
    Depends,
    Query,
)
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from app.utils.security import get_current_officer


router = APIRouter(
    prefix="/search",
    tags=["Search"]
)


# =========================================================
# HELPERS
# =========================================================

def build_pattern(value: str):
    return f"%{value.strip()}%"


def serialize_case(case):
    return {
        "id": case.id,
        "case_id": case.case_id,
        "fir_number": case.fir_number,
        "title": case.title,
        "offence": case.offence,
        "police_station": case.police_station,
        "investigating_officer": case.investigating_officer,
        "stage": case.stage,
        "status": case.status,
        "description": case.description,
        "data_origin": case.data_origin,
        "synthetic": case.synthetic,
        "source_reference": case.source_reference,
        "registered_on": case.registered_on,
        "last_updated": case.last_updated,
    }


def serialize_person(person):
    return {
        "id": person.id,
        "person_id": person.person_id,
        "name": person.name,
        "age": person.age,
        "gender": person.gender,
        "phone": person.phone,
        "address": person.address,
        "role": person.role,
        "status": person.status,
        "profile_image_path": person.profile_image_path,
        "created_at": person.created_at,
    }


def serialize_evidence(evidence):
    return {
        "id": evidence.id,
        "evidence_id": evidence.evidence_id,
        "case_id": evidence.case_id,
        "title": evidence.title,
        "evidence_type": evidence.evidence_type,
        "description": evidence.description,
        "file_path": evidence.file_path,
        "source": evidence.source,
        "collected_by": evidence.collected_by,
        "collected_at": evidence.collected_at,
        "status": evidence.status,
        "uploaded_at": evidence.uploaded_at,
    }


def unique_records(records):
    seen = set()
    result = []

    for record in records:
        record_id = getattr(
            record,
            "id",
            None
        )

        if record_id in seen:
            continue

        seen.add(record_id)
        result.append(record)

    return result


# =========================================================
# SEARCH
# =========================================================

@router.get("/")
def search(
    q: str = Query(
        ...,
        min_length=1
    ),
    db: Session = Depends(get_db),
    current_officer=Depends(
        get_current_officer
    )
):
    clean_query = q.strip()

    if not clean_query:
        return {
            "query": q,
            "cases": [],
            "persons": [],
            "evidence": [],
        }

    pattern = build_pattern(
        clean_query
    )


    # =====================================================
    # DIRECT CASE SEARCH
    # =====================================================

    direct_cases = (
        db.query(models.Case)
        .filter(
            or_(
                models.Case.case_id.ilike(
                    pattern
                ),

                models.Case.fir_number.ilike(
                    pattern
                ),

                models.Case.title.ilike(
                    pattern
                ),

                models.Case.offence.ilike(
                    pattern
                ),

                models.Case.police_station.ilike(
                    pattern
                ),

                models.Case.investigating_officer.ilike(
                    pattern
                ),

                models.Case.stage.ilike(
                    pattern
                ),

                models.Case.status.ilike(
                    pattern
                ),

                models.Case.description.ilike(
                    pattern
                ),
            )
        )
        .all()
    )


    # =====================================================
    # DIRECT PERSON SEARCH
    # =====================================================

    direct_persons = (
        db.query(models.Person)
        .filter(
            or_(
                models.Person.person_id.ilike(
                    pattern
                ),

                models.Person.name.ilike(
                    pattern
                ),

                models.Person.phone.ilike(
                    pattern
                ),

                models.Person.address.ilike(
                    pattern
                ),

                models.Person.role.ilike(
                    pattern
                ),

                models.Person.status.ilike(
                    pattern
                ),
            )
        )
        .all()
    )


    # =====================================================
    # DIRECT EVIDENCE SEARCH
    # =====================================================

    direct_evidence = (
        db.query(models.Evidence)
        .filter(
            or_(
                models.Evidence.evidence_id.ilike(
                    pattern
                ),

                models.Evidence.title.ilike(
                    pattern
                ),

                models.Evidence.evidence_type.ilike(
                    pattern
                ),

                models.Evidence.description.ilike(
                    pattern
                ),

                models.Evidence.source.ilike(
                    pattern
                ),

                models.Evidence.collected_by.ilike(
                    pattern
                ),

                models.Evidence.status.ilike(
                    pattern
                ),
            )
        )
        .all()
    )


    # =====================================================
    # LOCATION INTELLIGENCE ENTITY SEARCH
    # =====================================================

    location_entities = (
        db.query(
            models.IntelligenceEntity
        )
        .filter(
            or_(
                models.IntelligenceEntity.label.ilike(
                    pattern
                ),

                models.IntelligenceEntity.value.ilike(
                    pattern
                ),

                models.IntelligenceEntity.description.ilike(
                    pattern
                ),
            )
        )
        .filter(
            models.IntelligenceEntity.entity_type.ilike(
                "%location%"
            )
        )
        .all()
    )


    # =====================================================
    # CASES LINKED THROUGH LOCATION ENTITIES
    # =====================================================

    location_case_ids = {
        entity.case_id
        for entity in location_entities
        if entity.case_id is not None
    }


    location_cases = []

    if location_case_ids:
        location_cases = (
            db.query(models.Case)
            .filter(
                models.Case.id.in_(
                    location_case_ids
                )
            )
            .all()
        )


    # =====================================================
    # CASES LINKED TO MATCHED PERSONS
    # =====================================================

    matched_person_ids = {
        person.id
        for person in direct_persons
    }


    person_case_ids = set()

    if matched_person_ids:
        person_links = (
            db.query(
                models.CasePerson
            )
            .filter(
                models.CasePerson.person_id.in_(
                    matched_person_ids
                )
            )
            .all()
        )

        person_case_ids = {
            link.case_id
            for link in person_links
        }


    person_cases = []

    if person_case_ids:
        person_cases = (
            db.query(models.Case)
            .filter(
                models.Case.id.in_(
                    person_case_ids
                )
            )
            .all()
        )


    # =====================================================
    # MERGE CASES
    # =====================================================

    all_cases = unique_records(
        [
            *direct_cases,
            *location_cases,
            *person_cases,
        ]
    )


    # =====================================================
    # LINK EVIDENCE FROM MATCHED CASES
    # =====================================================

    linked_case_ids = {
        case.id
        for case in all_cases
    }


    linked_evidence = []

    if linked_case_ids:
        linked_evidence = (
            db.query(
                models.Evidence
            )
            .filter(
                models.Evidence.case_id.in_(
                    linked_case_ids
                )
            )
            .all()
        )


    all_evidence = unique_records(
        [
            *direct_evidence,
            *linked_evidence,
        ]
    )


    # =====================================================
    # PERSONS LINKED TO MATCHED CASES
    # =====================================================

    linked_person_ids = set()

    if linked_case_ids:
        case_person_links = (
            db.query(
                models.CasePerson
            )
            .filter(
                models.CasePerson.case_id.in_(
                    linked_case_ids
                )
            )
            .all()
        )

        linked_person_ids = {
            link.person_id
            for link in case_person_links
        }


    linked_persons = []

    if linked_person_ids:
        linked_persons = (
            db.query(
                models.Person
            )
            .filter(
                models.Person.id.in_(
                    linked_person_ids
                )
            )
            .all()
        )


    all_persons = unique_records(
        [
            *direct_persons,
            *linked_persons,
        ]
    )


    # =====================================================
    # NORMALIZED IDENTIFIER / CROSS-CASE SEARCH
    # =====================================================

    identifier_matches = []
    try:
        identifier_rows = (
            db.query(models.EntityIdentifier)
            .filter(
                or_(
                    models.EntityIdentifier.raw_value.ilike(pattern),
                    models.EntityIdentifier.normalized_value.ilike(pattern),
                )
            )
            .limit(100)
            .all()
        )
        grouped_identifiers = {}
        for row in identifier_rows:
            key = (row.identifier_type, row.normalized_value)
            item = grouped_identifiers.setdefault(key, {
                "identifier_type": row.identifier_type,
                "value": row.raw_value,
                "normalized_value": row.normalized_value,
                "case_ids": set(),
                "records": 0,
            })
            item["case_ids"].add(row.case_id)
            item["records"] += 1
        for item in grouped_identifiers.values():
            item["case_ids"] = sorted(item["case_ids"])
            item["case_count"] = len(item["case_ids"])
            item["cross_case"] = item["case_count"] > 1
            identifier_matches.append(item)
    except Exception:
        identifier_matches = []

    # =====================================================
    # ROLE-BASED RESULT SCOPE
    # =====================================================

    role = getattr(current_officer, "system_role", None)
    officer_id = getattr(current_officer, "officer_id", None)

    if role == "FORENSIC_ANALYST" and officer_id:
        allowed_case_ids = {
            row[0] for row in db.query(models.ForensicAssignment.case_id)
            .filter(models.ForensicAssignment.assigned_to == officer_id)
            .all()
        }
        all_cases = [case for case in all_cases if case.id in allowed_case_ids]
        all_evidence = [item for item in all_evidence if item.case_id in allowed_case_ids]
        allowed_person_ids = {
            link.person_id for link in db.query(models.CasePerson)
            .filter(models.CasePerson.case_id.in_(allowed_case_ids or {-1}))
            .all()
        }
        all_persons = [person for person in all_persons if person.id in allowed_person_ids]
        identifier_matches = [
            item for item in identifier_matches
            if any(case_id in allowed_case_ids for case_id in item["case_ids"])
        ]

    # =====================================================
    # RESPONSE
    # =====================================================

    return {
        "query": clean_query,
        "cases": [serialize_case(case) for case in all_cases],
        "persons": [serialize_person(person) for person in all_persons],
        "evidence": [serialize_evidence(item) for item in all_evidence],
        "identifiers": identifier_matches,
    }
