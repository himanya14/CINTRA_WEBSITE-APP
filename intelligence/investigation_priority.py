import networkx as nx


# =========================================================
# RELATIONSHIP WEIGHTS
# =========================================================

RELATIONSHIP_WEIGHTS = {
    "TRANSFERRED_MONEY_TO": 25,
    "CALLED": 10,
    "CONTACTED": 10,
    "MET": 8,
    "USED_VEHICLE": 8,
    "OWNS": 6,
    "USED_PHONE": 6,
    "VISITED": 5,
    "ASSOCIATED_WITH_LOCATION": 5
}


# =========================================================
# MAIN FUNCTION
# =========================================================

def calculate_investigation_priority(
    suspect,
    graph,
    kingpin_result=None
):
    """
    Calculate an explainable investigation priority score.

    IMPORTANT:
    This score is only an analytical indicator used to help
    investigators prioritize review.

    It does NOT establish guilt, criminal responsibility,
    or legal culpability.
    """

    # -----------------------------------------------------
    # Find suspect node
    # -----------------------------------------------------

    suspect_node = find_person_node(
        suspect,
        graph
    )

    if suspect_node is None:
        return {
            "suspect": suspect,
            "investigation_priority": 0,
            "priority_level": "Low",
            "factors": []
        }

    # -----------------------------------------------------
    # Calculate network metrics
    # -----------------------------------------------------

    degree = nx.degree_centrality(
        graph
    )

    betweenness = nx.betweenness_centrality(
        graph
    )

    try:
        pagerank = nx.pagerank(
            graph
        )

    except nx.PowerIterationFailedConvergence:
        pagerank = {
            node: 0
            for node in graph.nodes()
        }

    # -----------------------------------------------------
    # Calculate network influence
    # -----------------------------------------------------

    network_score = calculate_network_score(
        suspect_node,
        degree,
        betweenness,
        pagerank,
        graph
    )

    factors = []

    factors.append({
        "factor": "Network influence",
        "points": round(
            network_score,
            2
        )
    })

    # -----------------------------------------------------
    # Relationship indicators
    # -----------------------------------------------------

    relationship_score, relationship_factors = (
        calculate_relationship_score(
            suspect_node,
            graph
        )
    )

    factors.extend(
        relationship_factors
    )

    # -----------------------------------------------------
    # High-network-influence contribution
    # -----------------------------------------------------

    network_influence_bonus = 0

    if kingpin_result:

        highest_influence_name = kingpin_result.get(
            "suspect"
        )

        if (
            highest_influence_name
            and highest_influence_name.lower()
            == suspect.lower()
        ):

            network_influence_bonus = 10

            factors.append({
                "factor": "Highest network influence",
                "points": network_influence_bonus
            })

    # -----------------------------------------------------
    # Calculate final priority
    # -----------------------------------------------------

    raw_score = (
        network_score
        + relationship_score
        + network_influence_bonus
    )

    final_score = min(
        round(raw_score, 2),
        100
    )

    # -----------------------------------------------------
    # Priority level
    # -----------------------------------------------------

    priority_level = get_priority_level(
        final_score
    )

    # -----------------------------------------------------
    # Return result
    # -----------------------------------------------------

    return {
        "suspect": suspect,
        "investigation_priority": final_score,
        "priority_level": priority_level,
        "factors": factors
    }


# =========================================================
# FIND PERSON NODE
# =========================================================

def find_person_node(
    suspect,
    graph
):

    suspect_lower = suspect.strip().lower()

    for node, data in graph.nodes(
        data=True
    ):

        if data.get("type") != "person":
            continue

        name = data.get(
            "name",
            ""
        )

        if name.strip().lower() == suspect_lower:
            return node

    return None


# =========================================================
# NETWORK SCORE
# =========================================================

def calculate_network_score(
    suspect_node,
    degree,
    betweenness,
    pagerank,
    graph
):
    """
    Calculate network influence.

    Degree       -> 30%
    Betweenness  -> 40%
    PageRank     -> 30%

    Maximum contribution = 50 points.
    """

    persons = [
        node
        for node, data in graph.nodes(
            data=True
        )
        if data.get("type") == "person"
    ]

    degree_scores = normalize_metric(
        degree,
        persons
    )

    betweenness_scores = normalize_metric(
        betweenness,
        persons
    )

    pagerank_scores = normalize_metric(
        pagerank,
        persons
    )

    degree_score = degree_scores.get(
        suspect_node,
        0
    )

    betweenness_score = betweenness_scores.get(
        suspect_node,
        0
    )

    pagerank_score = pagerank_scores.get(
        suspect_node,
        0
    )

    network_score = (
        0.30 * degree_score
        + 0.40 * betweenness_score
        + 0.30 * pagerank_score
    )

    return min(
        network_score * 0.50,
        50
    )


# =========================================================
# RELATIONSHIP SCORE
# =========================================================

def calculate_relationship_score(
    suspect_node,
    graph
):

    score = 0

    factors = []

    # -----------------------------------------------------
    # Outgoing relationships
    # -----------------------------------------------------

    for _, target, data in graph.out_edges(
        suspect_node,
        data=True
    ):

        relationship = data.get(
            "relationship"
        )

        weight = RELATIONSHIP_WEIGHTS.get(
            relationship,
            2
        )

        confidence = data.get(
            "confidence",
            1.0
        )

        points = weight * confidence

        score += points

        factors.append({
            "factor": relationship.replace(
                "_",
                " "
            ).title(),

            "points": round(
                points,
                2
            )
        })

    # -----------------------------------------------------
    # Incoming financial relationships
    # -----------------------------------------------------

    for source, _, data in graph.in_edges(
        suspect_node,
        data=True
    ):

        relationship = data.get(
            "relationship"
        )

        if relationship == "TRANSFERRED_MONEY_TO":

            weight = RELATIONSHIP_WEIGHTS.get(
                relationship,
                2
            )

            confidence = data.get(
                "confidence",
                1.0
            )

            points = weight * confidence

            score += points

            factors.append({
                "factor": (
                    "Received "
                    + relationship.replace(
                        "_",
                        " "
                    ).title()
                ),

                "points": round(
                    points,
                    2
                )
            })

    # -----------------------------------------------------
    # Maximum relationship contribution
    # -----------------------------------------------------

    score = min(
        score,
        40
    )

    return score, factors


# =========================================================
# NORMALIZE METRIC
# =========================================================

def normalize_metric(
    metric,
    persons
):

    if not persons:
        return {}

    values = [
        metric.get(
            person,
            0
        )
        for person in persons
    ]

    maximum = max(values)

    if maximum == 0:

        return {
            person: 0
            for person in persons
        }

    return {
        person: (
            metric.get(
                person,
                0
            )
            / maximum
        ) * 100

        for person in persons
    }


# =========================================================
# PRIORITY LEVEL
# =========================================================

def get_priority_level(
    score
):

    if score >= 80:
        return "Critical"

    elif score >= 60:
        return "High"

    elif score >= 40:
        return "Medium"

    else:
        return "Low"