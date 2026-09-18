from collections import Counter, defaultdict

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.routers.cross_case import (
    authorized_case_ids,
    bootstrap_existing_identifiers,
    normalize,
)
from app.utils.security import get_current_officer

router = APIRouter(
    prefix="/cross-case-graph",
    tags=["Cross Case 3D Intelligence"],
)

SUPPORTED_ENTITY_TYPES = {
    "PERSON",
    "PERSON_NAME",
    "PHONE",
    "IMEI",
    "DEVICE",
    "VEHICLE",
    "ACCOUNT",
    "LOCATION",
    "ORGANISATION",
    "CDR",
    "CCTV",
    "EVIDENCE",
}

# ============================================================
# HELPERS
# ============================================================

def normalize_requested_types(
    requested_types: str,
):
    if not requested_types:
        return SUPPORTED_ENTITY_TYPES

    values = {
        value.strip().upper()
        for value in requested_types.split(",")
        if value.strip()
    }

    return (
        values & SUPPORTED_ENTITY_TYPES
    ) or SUPPORTED_ENTITY_TYPES

def get_case_cluster(case):
    offence = str(
        case.offence or ""
    ).lower()

    if any(
        word in offence
        for word in (
            "cyber",
            "identity",
            "digital",
            "impersonation",
        )
    ):
        return "Cyber Crime"

    if any(
        word in offence
        for word in (
            "financial",
            "payment",
            "fund",
            "invoice",
            "proceeds",
            "fraud",
        )
    ):
        return "Financial Crime"

    if any(
        word in offence
        for word in (
            "narcotic",
            "cannabis",
            "drug",
            "contravention",
        )
    ):
        return "Narcotics"

    if any(
        word in offence
        for word in (
            "vehicle",
            "theft",
            "robbery",
            "property",
        )
    ):
        return "Property Crime"

    return "Other Investigation"

def relationship_status(rows):
    if not rows:
        return "Inferred"

    sources = [
        str(row.source or "").lower()
        for row in rows
    ]

    manual_words = {
        "manual",
        "officer",
        "investigator",
        "user input",
    }

    if any(
        any(
            word in source
            for word in manual_words
        )
        for source in sources
    ):
        return "Manual Input"

    if all(
        bool(row.verified)
        for row in rows
    ):
        return "Verified"

    return "Inferred"

def match_status(
    matches,
    identifier_rows,
):
    """
    Convert the database status into the three statuses
    already used by the frontend.

    Pending Review -> Inferred
    Confirmed/Verified -> Verified
    Manual sources -> Manual Input
    """

    statuses = {
        str(match.status or "")
        .strip()
        .lower()
        for match in matches
    }

    if any(
        status in {
            "verified",
            "confirmed",
            "approved",
        }
        for status in statuses
    ):
        return "Verified"

    identifier_status = (
        relationship_status(
            identifier_rows
        )
    )

    if identifier_status == "Manual Input":
        return "Manual Input"

    if identifier_status == "Verified":
        return "Verified"

    return "Inferred"

def serialize_evidence(
    evidence,
):
    if not evidence:
        return None

    return {
        "id": evidence.id,
        "evidence_id": evidence.evidence_id,
        "title": evidence.title,
        "evidence_type": evidence.evidence_type,
        "description": evidence.description,
        "file_path": evidence.file_path,
        "sha256_hash": evidence.sha256_hash,
        "source": getattr(
            evidence,
            "source",
            None,
        ),
        "uploaded_at": (
            evidence.uploaded_at.isoformat()
            if getattr(
                evidence,
                "uploaded_at",
                None,
            )
            else None
        ),
    }

def get_identifier_evidence(
    db,
    identifier,
):
    if not identifier.evidence_id:
        return []

    evidence = (
        db.query(
            models.Evidence
        )
        .filter(
            models.Evidence.id
            == identifier.evidence_id
        )
        .first()
    )

    if not evidence:
        return []

    return [
        serialize_evidence(
            evidence
        )
    ]

# ============================================================
# GLOBAL 3D NETWORK
# ============================================================

@router.get("/network")
def get_global_cross_case_network(
    entity_types: str = Query(
        default=""
    ),
    bridges_only: bool = Query(
        default=False
    ),
    limit: int = Query(
        default=300,
        ge=1,
        le=300,
    ),
    db: Session = Depends(get_db),
    current_officer=Depends(
        get_current_officer
    ),
):
    """
    Build the CINTRA global cross-case network.

    IMPORTANT:

    This endpoint intentionally reads BOTH:

        entity_identifiers
        cross_case_matches

    The cross_case_matches table contains the persisted
    cross-FIR relationships and must not be ignored.
    """

    # --------------------------------------------------------
    # NORMALIZE EXISTING IDENTIFIERS
    # --------------------------------------------------------

    bootstrap_existing_identifiers(
        db
    )

    # --------------------------------------------------------
    # AUTHORIZED CASES
    # --------------------------------------------------------

    allowed_ids = set(
        authorized_case_ids(
            db,
            current_officer,
        )
    )

    # Demo fallback.
    #
    # If the local demo account has no assignment rows,
    # show the restored CINTRA dataset.
    if not allowed_ids:
        allowed_ids = {
            case_id
            for (
                case_id,
            ) in db.query(
                models.Case.id
            ).all()
        }

    if not allowed_ids:
        return {
            "nodes": [],
            "edges": [],
            "stats": {
                "case_count": 0,
                "bridge_count": 0,
                "connection_count": 0,
                "verified_count": 0,
                "inferred_count": 0,
                "manual_count": 0,
            },
            "entity_type_counts": {},
            "cluster_counts": {},
            "filters": {
                "entity_types": [],
                "bridges_only": bridges_only,
                "limit": limit,
            },
            "responsible_use": (
                "Cross-case connections are investigative leads. "
                "A shared identifier does not independently prove "
                "common ownership, identity or criminal conduct."
            ),
        }

    selected_types = (
        normalize_requested_types(
            entity_types
        )
    )

    # --------------------------------------------------------
    # LOAD ALL CASES
    # --------------------------------------------------------

    cases = (
        db.query(
            models.Case
        )
        .filter(
            models.Case.id.in_(
                allowed_ids
            )
        )
        .order_by(
            models.Case.id
        )
        .all()
    )

    case_map = {
        case.id: case
        for case in cases
    }

    # --------------------------------------------------------
    # LOAD ENTITY IDENTIFIERS
    # --------------------------------------------------------

    identifier_rows = (
        db.query(
            models.EntityIdentifier
        )
        .filter(
            models.EntityIdentifier.case_id.in_(
                allowed_ids
            ),
            models.EntityIdentifier.identifier_type.in_(
                selected_types
            ),
        )
        .all()
    )

    identifier_groups = (
        defaultdict(list)
    )

    for row in identifier_rows:

        raw_value = str(
            row.normalized_value
            or row.raw_value
            or ""
        ).strip()

        if not raw_value:
            continue

        normalized_value = normalize(
            row.identifier_type,
            raw_value,
        )

        if not normalized_value:
            continue

        identifier_groups[
            (
                row.identifier_type,
                normalized_value,
            )
        ].append(row)

    # --------------------------------------------------------
    # LOAD REAL CROSS-CASE MATCHES
    # --------------------------------------------------------

    cross_case_matches = (
        db.query(
            models.CrossCaseMatch
        )
        .filter(
            models.CrossCaseMatch.identifier_type.in_(
                selected_types
            ),
            models.CrossCaseMatch.case_a_id.in_(
                allowed_ids
            ),
            models.CrossCaseMatch.case_b_id.in_(
                allowed_ids
            ),
        )
        .all()
    )

    match_groups = (
        defaultdict(list)
    )

    for match in cross_case_matches:

        raw_value = str(
            match.normalized_value
            or ""
        ).strip()

        if not raw_value:
            continue

        normalized_value = normalize(
            match.identifier_type,
            raw_value,
        )

        if not normalized_value:
            continue

        match_groups[
            (
                match.identifier_type,
                normalized_value,
            )
        ].append(match)

    # --------------------------------------------------------
    # COMBINE BOTH DATABASE SOURCES
    # --------------------------------------------------------

    all_keys = (
        set(identifier_groups.keys())
        | set(match_groups.keys())
    )

    graph_keys = []

    for key in all_keys:

        identifier_rows_for_key = (
            identifier_groups.get(
                key,
                [],
            )
        )

        matches_for_key = (
            match_groups.get(
                key,
                [],
            )
        )

        case_ids = {
            row.case_id
            for row
            in identifier_rows_for_key
        }

        for match in matches_for_key:

            case_ids.add(
                match.case_a_id
            )

            case_ids.add(
                match.case_b_id
            )

        case_ids &= allowed_ids

        if not case_ids:
            continue

        if (
            bridges_only
            and len(case_ids) < 2
        ):
            continue

        graph_keys.append(
            (
                key,
                case_ids,
            )
        )

    # Most connected entities first.
    graph_keys.sort(
        key=lambda item: (
            -len(item[1]),
            -len(
                identifier_groups.get(
                    item[0],
                    [],
                )
            ),
            -len(
                match_groups.get(
                    item[0],
                    [],
                )
            ),
            item[0][0],
            item[0][1],
        )
    )

    graph_keys = graph_keys[
        :limit
    ]

    # --------------------------------------------------------
    # WHICH CASES SHOULD APPEAR?
    # --------------------------------------------------------

    if bridges_only:

        participating_case_ids = set()

        for (
            _,
            case_ids,
        ) in graph_keys:

            participating_case_ids.update(
                case_ids
            )

        graph_cases = [
            case
            for case in cases
            if case.id
            in participating_case_ids
        ]

    else:

        # THIS IS IMPORTANT:
        #
        # Every authorized FIR appears.
        graph_cases = cases

        participating_case_ids = (
            allowed_ids
        )

    # --------------------------------------------------------
    # BUILD GRAPH
    # --------------------------------------------------------

    nodes = []
    edges = []

    type_counts = Counter()
    status_counts = Counter()
    cluster_counts = Counter()

    # --------------------------------------------------------
    # CASE NODES
    # --------------------------------------------------------

    for case in graph_cases:

        cluster = get_case_cluster(
            case
        )

        cluster_counts[
            cluster
        ] += 1

        nodes.append(
            {
                "id": (
                    f"case:{case.id}"
                ),

                "database_id": (
                    case.id
                ),

                "node_type": "CASE",

                "entity_type": "CASE",

                "label": (
                    case.fir_number
                    or case.case_id
                ),

                "secondary_label": (
                    case.case_id
                ),

                "title": case.title,

                "offence": case.offence,

                "status": case.status,

                "cluster": cluster,

                "is_anchor": True,

                "size": 2.5,

                "case_count": 1,
            }
        )

    # --------------------------------------------------------
    # ENTITY NODES
    # --------------------------------------------------------

    for (
        key,
        case_ids,
    ) in graph_keys:

        (
            identifier_type,
            normalized_value,
        ) = key

        identifier_rows_for_key = (
            identifier_groups.get(
                key,
                [],
            )
        )

        matches_for_key = (
            match_groups.get(
                key,
                [],
            )
        )

        entity_node_id = (
            f"entity:"
            f"{identifier_type}:"
            f"{normalized_value}"
        )

        # Display value.
        display_value = next(
            (
                row.raw_value
                for row
                in identifier_rows_for_key
                if row.raw_value
            ),
            None,
        )

        if not display_value:

            display_value = (
                normalized_value
            )

        # ----------------------------------------------------
        # STATUS
        # ----------------------------------------------------

        entity_status = match_status(
            matches_for_key,
            identifier_rows_for_key,
        )

        type_counts[
            identifier_type
        ] += 1

        status_counts[
            entity_status
        ] += 1

        # ----------------------------------------------------
        # ENTITY NODE
        # ----------------------------------------------------

        nodes.append(
            {
                "id": entity_node_id,

                "node_type": "ENTITY",

                "entity_type": (
                    identifier_type
                ),

                "label": display_value,

                "normalized_value": (
                    normalized_value
                ),

                "status": entity_status,

                "database_statuses": sorted({
                    str(
                        match.status
                        or ""
                    )
                    for match
                    in matches_for_key
                }),

                "is_anchor": False,

                "is_bridge": (
                    len(case_ids) > 1
                ),

                "case_count": len(
                    case_ids
                ),

                "record_count": len(
                    identifier_rows_for_key
                ),

                "match_count": len(
                    matches_for_key
                ),

                "size": min(
                    2.0,
                    0.85
                    + len(case_ids)
                    * 0.12,
                ),
            }
        )

        # ----------------------------------------------------
        # GROUP IDENTIFIERS BY CASE
        # ----------------------------------------------------

        rows_by_case = (
            defaultdict(list)
        )

        for row in (
            identifier_rows_for_key
        ):

            if (
                row.case_id
                in participating_case_ids
            ):

                rows_by_case[
                    row.case_id
                ].append(row)

        # ----------------------------------------------------
        # GROUP MATCHES BY CASE
        # ----------------------------------------------------

        matches_by_case = (
            defaultdict(list)
        )

        for match in (
            matches_for_key
        ):

            if (
                match.case_a_id
                in participating_case_ids
            ):

                matches_by_case[
                    match.case_a_id
                ].append(match)

            if (
                match.case_b_id
                in participating_case_ids
            ):

                matches_by_case[
                    match.case_b_id
                ].append(match)

        edge_case_ids = (
            set(
                rows_by_case.keys()
            )
            | set(
                matches_by_case.keys()
            )
        )

        # ----------------------------------------------------
        # CASE -> ENTITY EDGES
        # ----------------------------------------------------

        for case_id in sorted(
            edge_case_ids
        ):

            case = case_map.get(
                case_id
            )

            if not case:
                continue

            case_rows = (
                rows_by_case.get(
                    case_id,
                    [],
                )
            )

            case_matches = (
                matches_by_case.get(
                    case_id,
                    [],
                )
            )

            connection_status = (
                match_status(
                    case_matches,
                    case_rows,
                )
            )

            # ------------------------------------------------
            # EVIDENCE
            # ------------------------------------------------

            supporting_evidence = []

            seen_evidence = set()

            sources = Counter()

            for row in case_rows:

                sources[
                    row.source
                    or "Identifier Record"
                ] += 1

                for evidence in (
                    get_identifier_evidence(
                        db,
                        row,
                    )
                ):

                    evidence_id = (
                        evidence.get(
                            "id"
                        )
                    )

                    if (
                        evidence_id
                        in seen_evidence
                    ):
                        continue

                    seen_evidence.add(
                        evidence_id
                    )

                    supporting_evidence.append(
                        evidence
                    )

            if case_matches:

                sources[
                    "Cross-Case Match"
                ] += len(
                    case_matches
                )

            # ------------------------------------------------
            # EXPLANATION
            # ------------------------------------------------

            rationale = next(
                (
                    str(
                        match.rationale
                    )
                    for match
                    in case_matches
                    if match.rationale
                ),
                None,
            )

            if rationale:

                explanation = rationale

            elif len(case_ids) > 1:

                explanation = (
                    f"{display_value} occurs across "
                    f"{len(case_ids)} authorized investigations."
                )

            else:

                explanation = (
                    f"{display_value} occurs in "
                    f"{case.fir_number or case.case_id}."
                )

            # ------------------------------------------------
            # EDGE
            # ------------------------------------------------

            edges.append(
                {
                    "id": (
                        f"edge:{case_id}:"
                        f"{identifier_type}:"
                        f"{normalized_value}"
                    ),

                    "source": (
                        f"case:{case_id}"
                    ),

                    "target": (
                        entity_node_id
                    ),

                    "relationship_type": (
                        "CROSS_CASE_APPEARANCE"
                    ),

                    "status": (
                        connection_status
                    ),

                    "database_match_status": [
                        match.status
                        for match
                        in case_matches
                        if match.status
                    ],

                    "identifier_type": (
                        identifier_type
                    ),

                    "value": (
                        display_value
                    ),

                    "case_id": case_id,

                    "case_reference": (
                        case.case_id
                    ),

                    "fir_number": (
                        case.fir_number
                    ),

                    "case_title": (
                        case.title
                    ),

                    "explanation": (
                        explanation
                    ),

                    "sources": [
                        {
                            "source": source,
                            "records": count,
                        }
                        for (
                            source,
                            count,
                        ) in sources.items()
                    ],

                    "supporting_evidence": (
                        supporting_evidence
                    ),

                    "evidence_count": len(
                        supporting_evidence
                    ),

                    "cross_case_match_ids": [
                        match.id
                        for match
                        in case_matches
                    ],

                    "confidence": [
                        match.confidence
                        for match
                        in case_matches
                        if match.confidence
                        is not None
                    ],
                }
            )

    # --------------------------------------------------------
    # STATISTICS
    # --------------------------------------------------------

    bridge_count = sum(
        1
        for node in nodes
        if (
            node.get(
                "node_type"
            )
            == "ENTITY"
            and node.get(
                "is_bridge"
            )
        )
    )

    return {
        "nodes": nodes,

        "edges": edges,

        "stats": {
            "case_count": len(
                graph_cases
            ),

            "bridge_count": (
                bridge_count
            ),

            "connection_count": len(
                edges
            ),

            "verified_count": (
                status_counts[
                    "Verified"
                ]
            ),

            "inferred_count": (
                status_counts[
                    "Inferred"
                ]
            ),

            "manual_count": (
                status_counts[
                    "Manual Input"
                ]
            ),
        },

        "entity_type_counts": dict(
            sorted(
                type_counts.items()
            )
        ),

        "cluster_counts": dict(
            sorted(
                cluster_counts.items()
            )
        ),

        "filters": {
            "entity_types": sorted(
                selected_types
            ),

            "bridges_only": (
                bridges_only
            ),

            "limit": limit,
        },

        "responsible_use": (
            "Cross-case connections are investigative leads. "
            "A shared identifier does not independently prove "
            "common ownership, identity or criminal conduct. "
            "Supporting evidence must be reviewed by an officer."
        ),
    }

