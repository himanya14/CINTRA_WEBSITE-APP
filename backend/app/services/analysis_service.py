import sys

from pathlib import Path

from typing import (
    Any,
    Dict,
    List
)


# =========================================================
# PATH SETUP
# =========================================================

PROJECT_ROOT = (
    Path(__file__)
    .resolve()
    .parents[3]
)

INTELLIGENCE_DIR = (
    PROJECT_ROOT
    / "intelligence"
)


# =========================================================
# LOAD AI PIPELINE LAZILY
# =========================================================

def _load_analyze_case():
    """
    Load the intelligence pipeline only when an analysis
    request is actually made.

    This prevents optional AI dependencies such as spaCy
    from stopping the whole FastAPI application during
    backend startup.
    """

    if not INTELLIGENCE_DIR.exists():

        raise RuntimeError(
            "Intelligence folder "
            f"not found: "
            f"{INTELLIGENCE_DIR}"
        )

    intelligence_path = str(
        INTELLIGENCE_DIR
    )

    if (
        intelligence_path
        not in sys.path
    ):

        sys.path.insert(
            0,
            intelligence_path
        )

    try:

        from main import (
            analyze_case
        )

        return analyze_case

    except Exception as exc:

        raise RuntimeError(
            "CINTRA intelligence pipeline "
            "is currently unavailable. "
            f"Reason: {exc}"
        ) from exc


# =========================================================
# NORMALIZATION HELPERS
# =========================================================

def _dict_or_empty(
    value
) -> Dict[str, Any]:

    if isinstance(
        value,
        dict
    ):

        return value

    return {}


def _list_or_empty(
    value
) -> List[Any]:

    if isinstance(
        value,
        list
    ):

        return value

    return []


# =========================================================
# NORMALIZE ENTITY RESULT
# =========================================================

def _normalize_entities(
    value
) -> Dict[str, List[Any]]:
    """
    Guarantee a predictable entity structure for FastAPI
    and the React frontend.

    No entities are generated here.

    Missing categories simply become empty lists.
    """

    value = _dict_or_empty(
        value
    )

    categories = [
        "persons",
        "phones",
        "vehicles",
        "locations",
        "organisations",
        "bank_accounts",
        "devices",
        "evidence",
        "dates_times"
    ]

    normalized = {}

    for category in categories:

        normalized[
            category
        ] = _list_or_empty(
            value.get(
                category,
                []
            )
        )

    # Preserve any future AI categories rather than
    # silently discarding them.
    for key, item in value.items():

        if key not in normalized:

            normalized[
                key
            ] = item

    return normalized


# =========================================================
# NORMALIZE GRAPH
# =========================================================

def _normalize_graph(
    result
):
    """
    Support the current pipeline response and also tolerate
    a nested `graph` object if the AI module evolves later.
    """

    graph = _dict_or_empty(
        result.get(
            "graph",
            {}
        )
    )

    nodes = result.get(
        "nodes"
    )

    edges = result.get(
        "edges"
    )

    if not isinstance(
        nodes,
        list
    ):

        nodes = graph.get(
            "nodes",
            []
        )

    if not isinstance(
        edges,
        list
    ):

        edges = graph.get(
            "edges",
            []
        )

    return (
        _list_or_empty(
            nodes
        ),
        _list_or_empty(
            edges
        )
    )


# =========================================================
# RUN CASE ANALYSIS
# =========================================================

def run_case_analysis(
    text: str,
    source_type: str = "FIR"
) -> Dict[str, Any]:
    """
    Send case text into the intelligence pipeline and
    normalize its result for the CINTRA backend.

    No case-specific entity or relationship is created
    here.

    Investigation priority, network influence and link
    confidence are analytical indicators only.
    """

    if (
        not text
        or not text.strip()
    ):

        raise ValueError(
            "Case text cannot be empty"
        )

    normalized_source_type = (
        str(
            source_type
            or "FIR"
        )
        .strip()
        or "FIR"
    )

    analyze_case = (
        _load_analyze_case()
    )

    # =====================================================
    # AI PIPELINE
    # =====================================================

    result = analyze_case(
        text=text.strip(),
        source_type=(
            normalized_source_type
        )
    )

    if not isinstance(
        result,
        dict
    ):

        raise RuntimeError(
            "Intelligence pipeline "
            "returned an invalid response"
        )

    # =====================================================
    # ENTITIES
    # =====================================================

    entities = (
        _normalize_entities(
            result.get(
                "entities",
                {}
            )
        )
    )

    # =====================================================
    # RELATIONSHIPS
    # =====================================================

    relationships = (
        _list_or_empty(
            result.get(
                "relationships",
                []
            )
        )
    )

    # =====================================================
    # GRAPH
    # =====================================================

    nodes, edges = (
        _normalize_graph(
            result
        )
    )

    # =====================================================
    # NETWORK INFLUENCE
    # =====================================================

    network_influence = (
        result.get(
            "network_influence"
        )
    )

    # Your current intelligence/main.py may still expose
    # this result using the older "kingpin" key.
    if (
        network_influence
        is None
    ):

        network_influence = (
            result.get(
                "kingpin"
            )
        )

    # =====================================================
    # NORMALIZED BACKEND RESULT
    # =====================================================

    normalized_result = {

        "entities":
            entities,

        "relationships":
            relationships,

        "nodes":
            nodes,

        "edges":
            edges,

        "network_influence":
            network_influence,

        "investigation_priorities":
            _list_or_empty(
                result.get(
                    "investigation_priorities",
                    []
                )
            ),

        "syndicates":
            _list_or_empty(
                result.get(
                    "syndicates",
                    []
                )
            ),

        "assignments":
            _dict_or_empty(
                result.get(
                    "assignments",
                    {}
                )
            ),

        "alerts":
            _list_or_empty(
                result.get(
                    "alerts",
                    []
                )
            ),

        "insights":
            _dict_or_empty(
                result.get(
                    "insights",
                    {}
                )
            )
    }

    # =====================================================
    # PRESERVE OPTIONAL FUTURE PIPELINE OUTPUTS
    # =====================================================

    optional_keys = [
        "communities",
        "community_analysis",
        "centrality",
        "metadata",
        "statistics",
        "risk_indicators"
    ]

    for key in optional_keys:

        if key in result:

            normalized_result[
                key
            ] = result[
                key
            ]

    return normalized_result