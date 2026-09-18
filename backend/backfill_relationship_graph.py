import sys

from dotenv import load_dotenv

load_dotenv()

from app.database import SessionLocal
from app import models


def clean_type(value):
    return (
        str(value or "Entity")
        .strip()
        .replace("_", " ")
        .title()
    )


def add_node(nodes, node_id, node_type, label, **extra):
    if not node_id:
        return

    node_id = str(node_id)

    if node_id in nodes:
        return

    nodes[node_id] = {
        "id": node_id,
        "type": clean_type(node_type),
        "label": str(label or node_id),
        "name": str(label or node_id),
        **extra,
    }


def add_edge(
    edges,
    edge_ids,
    source,
    target,
    relationship,
    confidence=75,
    verification_status="Unverified",
    evidence_source=None,
):
    if not source or not target:
        return

    source = str(source)
    target = str(target)

    edge_key = (
        source,
        target,
        str(relationship),
    )

    if edge_key in edge_ids:
        return

    edge_ids.add(edge_key)

    edges.append({
        "id": (
            f"edge-{len(edges) + 1}"
        ),
        "source": source,
        "target": target,
        "type": relationship,
        "relationship": relationship,
        "label": relationship,
        "confidence": (
            confidence
            if confidence is not None
            else 75
        ),
        "verification_status":
            verification_status
            or "Unverified",
        "evidence_source":
            evidence_source
            or "CINTRA case records",
    })


def person_by_reference(db, reference):
    return (
        db.query(models.Person)
        .filter(
            models.Person.person_id
            == reference
        )
        .first()
    )


def entity_by_reference(db, reference):
    return (
        db.query(
            models.IntelligenceEntity
        )
        .filter(
            models.IntelligenceEntity.entity_id
            == reference
        )
        .first()
    )


def build_graph(db, case):
    nodes = {}
    edges = []
    edge_ids = set()

    case_node_id = (
        f"case:{case.id}"
    )

    add_node(
        nodes,
        case_node_id,
        "Case",
        case.case_id,
        title=case.title,
        fir_number=case.fir_number,
        status=case.status,
        stage=case.stage,
    )

    person_links = (
        db.query(models.CasePerson)
        .filter(
            models.CasePerson.case_id
            == case.id
        )
        .all()
    )

    for link in person_links:
        person = (
            db.query(models.Person)
            .filter(
                models.Person.id
                == link.person_id
            )
            .first()
        )

        if not person:
            continue

        person_node_id = (
            person.person_id
        )

        add_node(
            nodes,
            person_node_id,
            "Person",
            person.name,
            person_id=person.person_id,
            database_id=person.id,
            role=person.role,
            role_in_case=link.role_in_case,
            phone=person.phone,
            address=person.address,
            status=person.status,
            profile_image_path=(
                person.profile_image_path
            ),
        )

        add_edge(
            edges,
            edge_ids,
            case_node_id,
            person_node_id,
            "Person In Case",
            confidence=100,
            verification_status=(
                "Verified"
            ),
            evidence_source=(
                "Case-person association"
            ),
        )

        if person.phone:
            phone_node_id = (
                f"phone:{person.phone}"
            )

            add_node(
                nodes,
                phone_node_id,
                "Phone",
                person.phone,
                value=person.phone,
            )

            add_edge(
                edges,
                edge_ids,
                person_node_id,
                phone_node_id,
                "Uses Phone",
                confidence=90,
                verification_status=(
                    "Verified"
                ),
                evidence_source=(
                    "Person record"
                ),
            )

    intelligence_entities = (
        db.query(
            models.IntelligenceEntity
        )
        .filter(
            models.IntelligenceEntity.case_id
            == case.id
        )
        .all()
    )

    entity_lookup = {}

    for entity in intelligence_entities:
        entity_lookup[
            entity.entity_id
        ] = entity

        add_node(
            nodes,
            entity.entity_id,
            entity.entity_type,
            entity.label,
            value=entity.value,
            description=entity.description,
            confidence=entity.confidence,
            verification_status=(
                entity.verification_status
            ),
            data_origin=entity.data_origin,
            synthetic=entity.synthetic,
        )

        add_edge(
            edges,
            edge_ids,
            entity.entity_id,
            case_node_id,
            "Linked To Case",
            confidence=(
                entity.confidence or 75
            ),
            verification_status=(
                entity.verification_status
            ),
            evidence_source=(
                entity.source
                or "Intelligence entity"
            ),
        )

    relationships = (
        db.query(
            models.IntelligenceRelationship
        )
        .filter(
            models.IntelligenceRelationship.case_id
            == case.id
        )
        .all()
    )

    for relationship in relationships:
        source_id = (
            relationship.source_ref
        )

        target_id = (
            relationship.target_ref
        )

        if source_id not in nodes:
            source_person = (
                person_by_reference(
                    db,
                    source_id,
                )
            )

            if source_person:
                add_node(
                    nodes,
                    source_id,
                    "Person",
                    source_person.name,
                    person_id=(
                        source_person.person_id
                    ),
                    database_id=(
                        source_person.id
                    ),
                    phone=(
                        source_person.phone
                    ),
                    address=(
                        source_person.address
                    ),
                    status=(
                        source_person.status
                    ),
                )
            else:
                source_entity = (
                    entity_lookup.get(
                        source_id
                    )
                    or entity_by_reference(
                        db,
                        source_id,
                    )
                )

                add_node(
                    nodes,
                    source_id,
                    (
                        source_entity.entity_type
                        if source_entity
                        else relationship.source_type
                    ),
                    (
                        source_entity.label
                        if source_entity
                        else source_id
                    ),
                )

        if target_id not in nodes:
            target_person = (
                person_by_reference(
                    db,
                    target_id,
                )
            )

            if target_person:
                add_node(
                    nodes,
                    target_id,
                    "Person",
                    target_person.name,
                    person_id=(
                        target_person.person_id
                    ),
                    database_id=(
                        target_person.id
                    ),
                    phone=(
                        target_person.phone
                    ),
                    address=(
                        target_person.address
                    ),
                    status=(
                        target_person.status
                    ),
                )
            else:
                target_entity = (
                    entity_lookup.get(
                        target_id
                    )
                    or entity_by_reference(
                        db,
                        target_id,
                    )
                )

                add_node(
                    nodes,
                    target_id,
                    (
                        target_entity.entity_type
                        if target_entity
                        else relationship.target_type
                    ),
                    (
                        target_entity.label
                        if target_entity
                        else target_id
                    ),
                )

        add_edge(
            edges,
            edge_ids,
            source_id,
            target_id,
            relationship.relationship_type,
            confidence=(
                relationship.confidence
                or 75
            ),
            verification_status=(
                relationship.verification_status
            ),
            evidence_source=(
                relationship.source
                or relationship.description
                or "Intelligence relationship"
            ),
        )

    return {
        "nodes": list(
            nodes.values()
        ),
        "edges": edges,
    }


def backfill_case(db, case_id):
    case = (
        db.query(models.Case)
        .filter(
            models.Case.id == case_id
        )
        .first()
    )

    if not case:
        raise ValueError(
            f"Case {case_id} not found"
        )

    analysis = (
        db.query(
            models.IntelligenceAnalysis
        )
        .filter(
            models.IntelligenceAnalysis.case_id
            == case_id
        )
        .order_by(
            models.IntelligenceAnalysis.id.desc()
        )
        .first()
    )

    if not analysis:
        analysis = (
            models.IntelligenceAnalysis(
                case_id=case.id,
                source_type="CASE_RECORDS",
                input_text=(
                    case.description
                    or case.title
                ),
                result_json={},
                created_by="SYSTEM",
            )
        )

        db.add(analysis)
        db.flush()

    graph = build_graph(
        db,
        case,
    )

    existing_result = dict(
        analysis.result_json or {}
    )

    existing_result["nodes"] = (
        graph["nodes"]
    )

    existing_result["edges"] = (
        graph["edges"]
    )

    existing_result[
        "graph_statistics"
    ] = {
        "nodes": len(
            graph["nodes"]
        ),
        "edges": len(
            graph["edges"]
        ),
    }

    existing_result[
        "responsible_ai"
    ] = (
        "Analytical lead only; "
        "officer verification required."
    )

    analysis.result_json = (
        existing_result
    )

    db.commit()
    db.refresh(analysis)

    print(
        f"Case {case.id} "
        f"({case.case_id}) updated"
    )

    print(
        f"Nodes: "
        f"{len(graph['nodes'])}"
    )

    print(
        f"Edges: "
        f"{len(graph['edges'])}"
    )


def main():
    if len(sys.argv) != 2:
        print(
            "Usage: python "
            "backfill_relationship_graph.py "
            "CASE_ID"
        )

        raise SystemExit(1)

    try:
        case_id = int(
            sys.argv[1]
        )
    except ValueError:
        print(
            "CASE_ID must be a number"
        )

        raise SystemExit(1)

    db = SessionLocal()

    try:
        backfill_case(
            db,
            case_id,
        )
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()