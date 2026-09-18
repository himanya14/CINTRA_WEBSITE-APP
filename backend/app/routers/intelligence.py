from fastapi import (
    APIRouter,
    Depends,
    HTTPException
)
from sqlalchemy.orm import Session
from typing import List
import json

from app.database import get_db
from app import models, schemas
from app.utils.security import get_current_officer
from app.services.analysis_service import run_case_analysis


router = APIRouter(
    prefix="/intelligence",
    tags=["Intelligence"]
)


# ---------- HELPER: CONVERT VALUE TO TEXT ----------

def value_to_text(value):
    if value is None:
        return None

    if isinstance(value, str):
        return value

    if isinstance(value, (dict, list)):
        return json.dumps(
            value,
            ensure_ascii=False
        )

    return str(value)


# ---------- HELPER: SAVE AI ALERTS ----------

def save_analysis_alerts(
    db: Session,
    analysis_result: dict,
    saved_analysis: models.IntelligenceAnalysis,
    officer_id: str
):
    """
    Save alerts returned by the intelligence pipeline.

    Alert formats may evolve on the AI side, so this
    function accepts several common field names.
    """

    alerts = analysis_result.get(
        "alerts",
        []
    )

    if not isinstance(alerts, list):
        return

    for alert in alerts:

        # ---------------------------------------------
        # ALERT RETURNED AS PLAIN TEXT
        # ---------------------------------------------

        if isinstance(alert, str):

            new_alert = models.IntelligenceAlert(
                case_id=saved_analysis.case_id,
                analysis_id=saved_analysis.id,
                alert_type="Intelligence Alert",
                title=alert,
                description=None,
                severity="Medium",
                status="Open",
                created_by=officer_id
            )

            db.add(new_alert)

            continue

        # ---------------------------------------------
        # ALERT RETURNED AS DICTIONARY
        # ---------------------------------------------

        if not isinstance(alert, dict):
            continue

        alert_type = (
            alert.get("alert_type")
            or alert.get("type")
            or alert.get("category")
            or "Intelligence Alert"
        )

        severity = (
            alert.get("severity")
            or alert.get("level")
            or alert.get("priority")
            or "Medium"
        )

        title = (
            alert.get("title")
            or alert.get("message")
            or alert.get("alert")
            or alert_type
        )

        description = (
            alert.get("description")
            or alert.get("details")
            or alert.get("evidence")
            or alert.get("reason")
        )

        new_alert = models.IntelligenceAlert(
            case_id=saved_analysis.case_id,
            analysis_id=saved_analysis.id,
            alert_type=value_to_text(
                alert_type
            ),
            title=value_to_text(
                title
            ),
            description=value_to_text(
                description
            ),
            severity=value_to_text(
                severity
            ),
            status="Open",
            created_by=officer_id
        )

        db.add(new_alert)



# ---------- PERSON ASSESSMENT HELPERS ----------

def _normalise(value):
    return str(value or "").strip().lower().replace("_", " ")


def _edge_source(edge):
    if not isinstance(edge, dict):
        return None

    return (
        edge.get("source")
        or edge.get("source_id")
        or edge.get("from")
        or edge.get("from_id")
    )


def _edge_target(edge):
    if not isinstance(edge, dict):
        return None

    return (
        edge.get("target")
        or edge.get("target_id")
        or edge.get("to")
        or edge.get("to_id")
    )


def _edge_label(edge):
    if not isinstance(edge, dict):
        return "Linked"

    return (
        edge.get("relationship")
        or edge.get("relationship_type")
        or edge.get("label")
        or edge.get("type")
        or "Linked"
    )


def _node_label(node):
    if not isinstance(node, dict):
        return ""

    return (
        node.get("name")
        or node.get("label")
        or node.get("entity_name")
        or node.get("title")
        or ""
    )


def _node_person_id(node):
    if not isinstance(node, dict):
        return None

    return (
        node.get("person_id")
        or node.get("personId")
    )


def _relationship_category(label):
    value = _normalise(label)

    if any(
        token in value
        for token in (
            "call",
            "contact",
            "phone",
            "message",
        )
    ):
        return "communication"

    if any(
        token in value
        for token in (
            "transfer",
            "paid",
            "money",
            "financial",
        )
    ):
        return "financial"

    if any(
        token in value
        for token in (
            "device",
            "imei",
        )
    ):
        return "device"

    if any(
        token in value
        for token in (
            "location",
            "seen",
            "observed",
        )
    ):
        return "location"

    if "vehicle" in value:
        return "vehicle"

    if any(
        token in value
        for token in (
            "own",
            "control",
            "account",
        )
    ):
        return "ownership"

    return "general"


def _compute_person_assessment(
    db: Session,
    case_id: int,
    person: models.Person,
):
    case_person = db.query(
        models.CasePerson
    ).filter(
        models.CasePerson.case_id == case_id,
        models.CasePerson.person_id == person.id,
    ).first()

    # Seed aliases can point to a different Person row while still
    # representing the same synthetic identity in the case.
    if not case_person:
        case_person = db.query(
            models.CasePerson
        ).join(
            models.Person,
            models.Person.id == models.CasePerson.person_id,
        ).filter(
            models.CasePerson.case_id == case_id,
            models.Person.name == person.name,
        ).first()

    role = (
        case_person.role_in_case
        if case_person
        else person.role
    )

    latest_analysis = db.query(
        models.IntelligenceAnalysis
    ).filter(
        models.IntelligenceAnalysis.case_id == case_id
    ).order_by(
        models.IntelligenceAnalysis.created_at.desc()
    ).first()

    result = (
        latest_analysis.result_json
        if latest_analysis
        and isinstance(
            latest_analysis.result_json,
            dict,
        )
        else {}
    )

    nodes = result.get(
        "nodes",
        [],
    )

    edges = result.get(
        "edges",
        [],
    )

    if not isinstance(nodes, list):
        nodes = []

    if not isinstance(edges, list):
        edges = []

    matching_node_ids = set()

    person_external_id = str(
        person.person_id
    )

    person_name = _normalise(
        person.name
    )

    for node in nodes:
        if not isinstance(
            node,
            dict,
        ):
            continue

        node_id = node.get(
            "id"
        )

        if node_id is None:
            continue

        node_person_id = _node_person_id(
            node
        )

        node_name = _normalise(
            _node_label(
                node
            )
        )

        if (
            (
                node_person_id
                is not None
                and str(
                    node_person_id
                ) == person_external_id
            )
            or (
                node_name
                and node_name
                == person_name
            )
        ):
            matching_node_ids.add(
                str(node_id)
            )

    incident_edges = []

    for edge in edges:
        if not isinstance(
            edge,
            dict,
        ):
            continue

        source = _edge_source(
            edge
        )

        target = _edge_target(
            edge
        )

        if (
            str(source)
            in matching_node_ids
            or str(target)
            in matching_node_ids
        ):
            incident_edges.append(
                edge
            )

    connection_categories = sorted(
        {
            _relationship_category(
                _edge_label(
                    edge
                )
            )
            for edge
            in incident_edges
        }
    )

    linked_entities = db.query(
        models.IntelligenceEntity
    ).filter(
        models.IntelligenceEntity.case_id == case_id,
        models.IntelligenceEntity.linked_person_id == person.id,
    ).all()

    linked_entity_count = len(
        linked_entities
    )

    role_text = _normalise(
        role
    )

    score = 8

    if "prime suspect" in role_text:
        score += 34
    elif (
        "suspect" in role_text
        or "accused" in role_text
    ):
        score += 27
    elif (
        "person of interest"
        in role_text
        or role_text == "poi"
    ):
        score += 20
    elif "associate" in role_text:
        score += 13
    elif "witness" in role_text:
        score += 6
    elif "victim" in role_text:
        score += 3

    connection_count = len(
        incident_edges
    )

    score += min(
        connection_count * 4,
        28,
    )

    score += min(
        linked_entity_count * 3,
        15,
    )

    score += min(
        len(
            connection_categories
        ) * 4,
        16,
    )

    score = min(
        100,
        int(
            round(score)
        ),
    )

    if score >= 65:
        priority_level = "High"
    elif score >= 35:
        priority_level = "Medium"
    else:
        priority_level = "Low"

    reasons = []

    if role:
        reasons.append(
            "Investigator-assigned case role: "
            + str(role)
        )

    reasons.append(
        f"{connection_count} recorded relationship"
        + (
            ""
            if connection_count == 1
            else "s"
        )
        + " in the latest saved analysis"
    )

    if linked_entity_count:
        reasons.append(
            f"{linked_entity_count} linked intelligence "
            + (
                "entity"
                if linked_entity_count == 1
                else "entities"
            )
        )

    if connection_categories:
        reasons.append(
            "Connection categories: "
            + ", ".join(
                connection_categories
            )
        )

    if not latest_analysis:
        reasons.append(
            "No saved analysis was available; the score "
            "uses case-role and linked-entity records only"
        )

    return {
        "person_id": person.person_id,
        "person_name": person.name,
        "case_id": case_id,
        "role_in_case": role,
        "priority_level": priority_level,
        "investigation_priority": score,
        "connection_count": connection_count,
        "linked_entity_count": linked_entity_count,
        "connection_types": connection_categories,
        "reasons": reasons,
        "analysis_id": (
            latest_analysis.id
            if latest_analysis
            else None
        ),
        "basis": (
            "Latest saved analysis, investigator-assigned "
            "case role, and linked intelligence entities"
        ),
        "computed": True,
        "disclaimer": (
            "Analytical triage aid only. It does not determine "
            "guilt and does not replace investigator judgement."
        ),
    }


# ---------- ANALYZE AND SAVE CASE TEXT ----------


@router.post(
    "/analyze",
    response_model=schemas.IntelligenceAnalysisResponse
)
def analyze_intelligence(
    request: schemas.IntelligenceAnalysisRequest,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer)
):
    """
    Analyze FIR, report, or other investigation text,
    save the complete intelligence analysis, and store
    any alerts produced by the intelligence pipeline.

    Results are analytical indicators only and do not
    establish guilt or legal responsibility.
    """

    if not request.text or not request.text.strip():

        raise HTTPException(
            status_code=400,
            detail="Analysis text cannot be empty"
        )

    if request.case_id is None:

        raise HTTPException(
            status_code=400,
            detail="Case ID is required to save analysis"
        )

    case = db.query(
        models.Case
    ).filter(
        models.Case.id == request.case_id
    ).first()

    if not case:

        raise HTTPException(
            status_code=404,
            detail="Case not found"
        )

    # ---------------------------------------------
    # RUN INTELLIGENCE PIPELINE
    # ---------------------------------------------

    try:

        analysis = run_case_analysis(
            text=request.text,
            source_type=request.source_type or "FIR"
        )

    except ValueError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc)
        )

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=(
                "Intelligence analysis failed: "
                + str(exc)
            )
        )

    # ---------------------------------------------
    # CREATE ANALYSIS RECORD
    # ---------------------------------------------

    saved_analysis = models.IntelligenceAnalysis(
        case_id=request.case_id,
        source_type=request.source_type or "FIR",
        input_text=request.text.strip(),
        result_json=analysis,
        created_by=current_officer.officer_id
    )

    try:

        db.add(saved_analysis)

        # Gives saved_analysis its database ID
        # before alerts are created.
        db.flush()

        # -----------------------------------------
        # SAVE ALERTS RETURNED BY AI
        # -----------------------------------------

        save_analysis_alerts(
            db=db,
            analysis_result=analysis,
            saved_analysis=saved_analysis,
            officer_id=current_officer.officer_id
        )

        db.commit()
        db.refresh(saved_analysis)

    except Exception:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to save intelligence analysis "
                "and alerts"
            )
        )

    return saved_analysis


# ---------- GET ANALYSES BY CASE ----------

@router.get(
    "/analysis/case/{case_id}",
    response_model=List[
        schemas.IntelligenceAnalysisResponse
    ]
)
def get_case_analyses(
    case_id: int,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer)
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

    return db.query(
        models.IntelligenceAnalysis
    ).filter(
        models.IntelligenceAnalysis.case_id == case_id
    ).order_by(
        models.IntelligenceAnalysis.created_at.desc()
    ).all()



# ---------- GET PERSON INTELLIGENCE ASSESSMENT ----------

@router.get(
    "/assessment/case/{case_id}/person/{person_id}"
)
def get_person_intelligence_assessment(
    case_id: int,
    person_id: str,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer)
):
    """
    Return a reproducible analytical attention score for one
    person in one case.

    The score is a triage aid based on the investigator-assigned
    role, the latest saved relationship graph, and linked
    intelligence entities. It does not establish guilt.
    """

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

    person = db.query(
        models.Person
    ).filter(
        models.Person.person_id == person_id
    ).first()

    if not person:
        raise HTTPException(
            status_code=404,
            detail="Person not found"
        )

    return _compute_person_assessment(
        db=db,
        case_id=case_id,
        person=person,
    )


# ---------- GET ONE ANALYSIS ----------


@router.get(
    "/analysis/{analysis_id}",
    response_model=schemas.IntelligenceAnalysisResponse
)
def get_analysis(
    analysis_id: int,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer)
):
    analysis = db.query(
        models.IntelligenceAnalysis
    ).filter(
        models.IntelligenceAnalysis.id == analysis_id
    ).first()

    if not analysis:

        raise HTTPException(
            status_code=404,
            detail="Intelligence analysis not found"
        )

    return analysis


# ---------- GET ALL ALERTS ----------

@router.get(
    "/alerts",
    response_model=List[
        schemas.IntelligenceAlertResponse
    ]
)
def get_alerts(
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer)
):
    return db.query(
        models.IntelligenceAlert
    ).order_by(
        models.IntelligenceAlert.created_at.desc()
    ).all()


# ---------- GET ALERTS BY CASE ----------

@router.get(
    "/alerts/case/{case_id}",
    response_model=List[
        schemas.IntelligenceAlertResponse
    ]
)
def get_alerts_by_case(
    case_id: int,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer)
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

    return db.query(
        models.IntelligenceAlert
    ).filter(
        models.IntelligenceAlert.case_id == case_id
    ).order_by(
        models.IntelligenceAlert.created_at.desc()
    ).all()


# ---------- UPDATE ALERT ----------

@router.put(
    "/alerts/{alert_id}",
    response_model=schemas.IntelligenceAlertResponse
)
def update_alert(
    alert_id: int,
    alert_data: schemas.IntelligenceAlertUpdate,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer)
):
    alert = db.query(
        models.IntelligenceAlert
    ).filter(
        models.IntelligenceAlert.id == alert_id
    ).first()

    if not alert:

        raise HTTPException(
            status_code=404,
            detail="Intelligence alert not found"
        )

    update_data = alert_data.model_dump(
        exclude_unset=True
    )

    for key, value in update_data.items():

        setattr(
            alert,
            key,
            value
        )

    try:

        db.commit()
        db.refresh(alert)

    except Exception:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Failed to update intelligence alert"
        )

    return alert


# ---------- CREATE ENTITY ----------

@router.post(
    "/entities",
    response_model=schemas.IntelligenceEntityResponse
)
def create_entity(
    entity: schemas.IntelligenceEntityCreate,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer)
):
    existing_entity = db.query(
        models.IntelligenceEntity
    ).filter(
        models.IntelligenceEntity.entity_id
        == entity.entity_id
    ).first()

    if existing_entity:

        raise HTTPException(
            status_code=400,
            detail="Entity ID already exists"
        )

    if entity.case_id is not None:

        case = db.query(
            models.Case
        ).filter(
            models.Case.id == entity.case_id
        ).first()

        if not case:

            raise HTTPException(
                status_code=404,
                detail="Case not found"
            )

    if entity.linked_person_id is not None:

        person = db.query(
            models.Person
        ).filter(
            models.Person.id
            == entity.linked_person_id
        ).first()

        if not person:

            raise HTTPException(
                status_code=404,
                detail="Linked person not found"
            )

    new_entity = models.IntelligenceEntity(
        **entity.model_dump(),
        created_by=current_officer.officer_id
    )

    db.add(new_entity)
    db.commit()
    db.refresh(new_entity)

    return new_entity


# ---------- GET ALL ENTITIES ----------

@router.get(
    "/entities",
    response_model=List[
        schemas.IntelligenceEntityResponse
    ]
)
def get_entities(
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer)
):
    return db.query(
        models.IntelligenceEntity
    ).order_by(
        models.IntelligenceEntity.created_at.desc()
    ).all()


# ---------- GET ENTITIES BY CASE ----------

@router.get(
    "/entities/case/{case_id}",
    response_model=List[
        schemas.IntelligenceEntityResponse
    ]
)
def get_entities_by_case(
    case_id: int,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer)
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

    return db.query(
        models.IntelligenceEntity
    ).filter(
        models.IntelligenceEntity.case_id == case_id
    ).order_by(
        models.IntelligenceEntity.created_at.desc()
    ).all()


# ---------- GET ONE ENTITY ----------

@router.get(
    "/entities/{entity_id}",
    response_model=schemas.IntelligenceEntityResponse
)
def get_entity(
    entity_id: int,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer)
):
    entity = db.query(
        models.IntelligenceEntity
    ).filter(
        models.IntelligenceEntity.id == entity_id
    ).first()

    if not entity:

        raise HTTPException(
            status_code=404,
            detail="Entity not found"
        )

    return entity


# ---------- UPDATE ENTITY ----------

@router.put(
    "/entities/{entity_id}",
    response_model=schemas.IntelligenceEntityResponse
)
def update_entity(
    entity_id: int,
    entity_data: schemas.IntelligenceEntityUpdate,
    db: Session = Depends(get_db),
    current_officer=Depends(get_current_officer)
):
    entity = db.query(
        models.IntelligenceEntity
    ).filter(
        models.IntelligenceEntity.id == entity_id
    ).first()

    if not entity:

        raise HTTPException(
            status_code=404,
            detail="Entity not found"
        )

    update_data = entity_data.model_dump(
        exclude_unset=True
    )

    if "case_id" in update_data:

        case_id = update_data[
            "case_id"
        ]

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

    if "linked_person_id" in update_data:

        person_id = update_data[
            "linked_person_id"
        ]

        if person_id is not None:

            person = db.query(
                models.Person
            ).filter(
                models.Person.id == person_id
            ).first()

            if not person:

                raise HTTPException(
                    status_code=404,
                    detail="Linked person not found"
                )

    for key, value in update_data.items():

        setattr(
            entity,
            key,
            value
        )

    db.commit()
    db.refresh(entity)

    return entity