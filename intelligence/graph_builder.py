import re

import networkx as nx


# =========================================================
# ENTITY TYPE CONFIGURATION
# =========================================================

ENTITY_TYPE_MAPPING = {
    "persons": "person",
    "phones": "phone",
    "vehicles": "vehicle",
    "locations": "location",
    "organisations": "organisation",
    "bank_accounts": "bank_account",
    "devices": "device",
    "evidence": "evidence",
    "dates_times": "date_time"
}


# =========================================================
# NORMALIZATION
# =========================================================

def normalize_entity_name(value):
    """
    Normalize an entity for comparisons while preserving
    the original display value elsewhere.
    """

    if value is None:
        return ""

    value = str(value).strip()

    value = re.sub(
        r"\s+",
        " ",
        value
    )

    return value


def normalize_for_matching(value):
    """
    Case-insensitive normalized representation used when
    matching relationships to extracted nodes.
    """

    return normalize_entity_name(
        value
    ).casefold()


# =========================================================
# CREATE NODE ID
# =========================================================

def create_node_id(
    node_type,
    entity
):
    """
    Create a deterministic graph node ID.

    Example:

        person + Ravi Mehra
            ->
        PERSON_RAVI_MEHRA

    No case-specific values are hardcoded here.
    """

    node_type = (
        normalize_entity_name(
            node_type
        )
        or "unknown"
    )

    entity = normalize_entity_name(
        entity
    )

    normalized = entity.upper()

    normalized = re.sub(
        r"[^A-Z0-9]+",
        "_",
        normalized
    )

    normalized = normalized.strip(
        "_"
    )

    if not normalized:
        normalized = "UNKNOWN"

    return (
        f"{node_type.upper()}_"
        f"{normalized}"
    )


# =========================================================
# FIND EXISTING NODE
# =========================================================

def find_node_id(
    graph,
    entity_name
):
    """
    Find a graph node using its stored display name.
    """

    target = normalize_for_matching(
        entity_name
    )

    if not target:
        return None

    for node_id, data in graph.nodes(
        data=True
    ):

        existing_name = (
            data.get(
                "name",
                ""
            )
        )

        if (
            normalize_for_matching(
                existing_name
            )
            == target
        ):

            return node_id

    return None


# =========================================================
# DETERMINE ENTITY TYPE
# =========================================================

def find_entity_type(
    entities,
    entity_name
):
    """
    Determine the type of an entity by looking through
    the extracted entity collections.
    """

    target = normalize_for_matching(
        entity_name
    )

    if not target:
        return "unknown"

    for category, node_type in (
        ENTITY_TYPE_MAPPING.items()
    ):

        for entity in entities.get(
            category,
            []
        ):

            if (
                normalize_for_matching(
                    entity
                )
                == target
            ):

                return node_type

    return "unknown"


# =========================================================
# ADD NODE SAFELY
# =========================================================

def add_entity_node(
    graph,
    node_type,
    entity,
    **attributes
):
    """
    Add an entity node without duplicating an entity
    that already exists in the graph.
    """

    entity = normalize_entity_name(
        entity
    )

    if not entity:
        return None

    existing_node_id = find_node_id(
        graph,
        entity
    )

    if existing_node_id is not None:

        existing_data = graph.nodes[
            existing_node_id
        ]

        # Upgrade an unknown node when its real type
        # becomes available.
        if (
            existing_data.get("type")
            == "unknown"
            and node_type != "unknown"
        ):

            existing_data[
                "type"
            ] = node_type

        for key, value in (
            attributes.items()
        ):

            if value is not None:
                existing_data[
                    key
                ] = value

        return existing_node_id

    node_id = create_node_id(
        node_type,
        entity
    )

    graph.add_node(
        node_id,
        name=entity,
        type=node_type,
        **attributes
    )

    return node_id


# =========================================================
# BUILD GRAPH
# =========================================================

def build_graph(
    entities,
    relationships
):
    """
    Build a NetworkX MultiDiGraph from dynamically
    extracted entities and relationships.

    No case-specific graph structure is defined here.
    """

    graph = nx.MultiDiGraph()

    entities = entities or {}
    relationships = relationships or []

    # =====================================================
    # 1. ADD ALL EXTRACTED ENTITIES
    # =====================================================

    for category, node_type in (
        ENTITY_TYPE_MAPPING.items()
    ):

        category_entities = (
            entities.get(
                category,
                []
            )
            or []
        )

        for entity in category_entities:

            add_entity_node(
                graph,
                node_type,
                entity
            )

    # =====================================================
    # 2. ADD RELATIONSHIPS
    # =====================================================

    for relationship in relationships:

        if not isinstance(
            relationship,
            dict
        ):
            continue

        source = relationship.get(
            "source"
        )

        target = relationship.get(
            "target"
        )

        relationship_type = (
            relationship.get(
                "relationship"
            )
            or relationship.get(
                "relationship_type"
            )
            or "UNKNOWN"
        )

        if not source or not target:
            continue

        source = normalize_entity_name(
            source
        )

        target = normalize_entity_name(
            target
        )

        # ---------------------------------------------
        # FIND SOURCE
        # ---------------------------------------------

        source_id = find_node_id(
            graph,
            source
        )

        if source_id is None:

            source_type = (
                relationship.get(
                    "source_entity_type"
                )
                or find_entity_type(
                    entities,
                    source
                )
            )

            source_id = add_entity_node(
                graph,
                source_type,
                source
            )

        # ---------------------------------------------
        # FIND TARGET
        # ---------------------------------------------

        target_id = find_node_id(
            graph,
            target
        )

        if target_id is None:

            target_type = (
                relationship.get(
                    "target_entity_type"
                )
                or find_entity_type(
                    entities,
                    target
                )
            )

            target_id = add_entity_node(
                graph,
                target_type,
                target
            )

        if (
            source_id is None
            or target_id is None
        ):
            continue

        # ---------------------------------------------
        # CONFIDENCE
        # ---------------------------------------------

        confidence = relationship.get(
            "confidence",
            1.0
        )

        try:

            confidence = float(
                confidence
            )

        except (
            TypeError,
            ValueError
        ):

            confidence = 1.0

        # ---------------------------------------------
        # EDGE
        # ---------------------------------------------

        graph.add_edge(
            source_id,
            target_id,
            relationship=relationship_type,
            confidence=confidence,
            evidence=relationship.get(
                "evidence",
                ""
            ),
            source_type=relationship.get(
                "source_type",
                "UNKNOWN"
            ),
            weight=relationship.get(
                "weight",
                1
            )
        )

    return graph


# =========================================================
# GRAPH TO JSON
# =========================================================

def graph_to_json(graph):
    """
    Convert a NetworkX graph into the JSON structure
    consumed by the CINTRA frontend.
    """

    nodes = []

    edges = []

    # =====================================================
    # NODES
    # =====================================================

    for node_id, data in graph.nodes(
        data=True
    ):

        node = {
            "id": node_id,
            "name": data.get(
                "name",
                ""
            ),
            "type": data.get(
                "type",
                "unknown"
            )
        }

        # Preserve useful optional metadata if it exists.

        optional_fields = [
            "label",
            "value",
            "description",
            "source",
            "confidence",
            "verification_status",
            "linked_person_id",
            "entity_id"
        ]

        for field in optional_fields:

            if (
                field in data
                and data[field] is not None
            ):

                node[field] = (
                    data[field]
                )

        nodes.append(node)

    # =====================================================
    # EDGES
    # =====================================================

    for (
        source,
        target,
        key,
        data
    ) in graph.edges(
        keys=True,
        data=True
    ):

        edge = {
            "id": (
                f"{source}__"
                f"{target}__"
                f"{key}"
            ),
            "source": source,
            "target": target,
            "relationship": (
                data.get(
                    "relationship",
                    "UNKNOWN"
                )
            ),
            "weight": data.get(
                "weight",
                1
            ),
            "confidence": data.get(
                "confidence",
                1.0
            ),
            "evidence": data.get(
                "evidence",
                ""
            ),
            "source_type": data.get(
                "source_type",
                "UNKNOWN"
            )
        }

        edges.append(edge)

    return {
        "nodes": nodes,
        "edges": edges
    }


# =========================================================
# COMPLETE GRAPH PIPELINE
# =========================================================

def build_graph_data(
    entities,
    relationships
):
    """
    Convert extracted entities and relationships directly
    into frontend-ready graph data.
    """

    graph = build_graph(
        entities,
        relationships
    )

    return graph_to_json(
        graph
    )