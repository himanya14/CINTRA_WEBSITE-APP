import networkx as nx


# =========================================================
# COMMUNITY DETECTOR
# =========================================================

def detect_communities(graph):
    """
    Detect communities/syndicates in the criminal network.

    Only PERSON nodes are considered for syndicate detection.

    The original node attributes such as name and type are
    preserved when creating the person-only graph.

    Returns:
        {
            "syndicates": [
                {
                    "id": "Syndicate_A",
                    "members": [
                        "Ravi Kumar",
                        "Amit Sharma"
                    ],
                    "size": 2
                }
            ],
            "assignments": {
                "Ravi Kumar": "Syndicate_A",
                "Amit Sharma": "Syndicate_A"
            }
        }
    """

    # -----------------------------------------------------
    # 1. Get only person nodes
    # -----------------------------------------------------

    persons = [
        node
        for node, data in graph.nodes(data=True)
        if data.get("type") == "person"
    ]

    # No people = no syndicates
    if not persons:
        return {
            "syndicates": [],
            "assignments": {}
        }

    # -----------------------------------------------------
    # 2. Create person-only graph
    # -----------------------------------------------------

    person_graph = nx.Graph()

    # IMPORTANT:
    # Copy the original node attributes.
    #
    # Previously we used:
    #
    #     person_graph.add_nodes_from(persons)
    #
    # which copied only the IDs.
    #
    # Now we preserve name/type attributes.

    for person_node in persons:

        original_data = graph.nodes[
            person_node
        ]

        person_graph.add_node(
            person_node,
            name=original_data.get(
                "name",
                person_node
            ),
            type="person"
        )

    # -----------------------------------------------------
    # 3. Add person-to-person relationships
    # -----------------------------------------------------

    for source, target, data in graph.edges(
        data=True
    ):

        # We only want relationships where BOTH
        # endpoints are people.

        if (
            source not in persons
            or target not in persons
        ):
            continue

        relationship = data.get(
            "relationship",
            "CONNECTED"
        )

        confidence = data.get(
            "confidence",
            1.0
        )

        # -------------------------------------------------
        # Relationship strength
        # -------------------------------------------------

        relationship_weight = {
            "TRANSFERRED_MONEY_TO": 5,
            "CALLED": 3,
            "CONTACTED": 3,
            "MET": 2
        }.get(
            relationship,
            1
        )

        weight = (
            relationship_weight
            * confidence
        )

        # -------------------------------------------------
        # Combine multiple relationships
        # -------------------------------------------------

        if person_graph.has_edge(
            source,
            target
        ):

            person_graph[source][target][
                "weight"
            ] += weight

        else:

            person_graph.add_edge(
                source,
                target,
                weight=weight
            )

    # -----------------------------------------------------
    # 4. Detect communities
    # -----------------------------------------------------

    if person_graph.number_of_edges() == 0:

        # Every isolated person becomes their own
        # community.

        communities = [
            {person}
            for person in persons
        ]

    else:

        try:

            # Louvain community detection
            communities = nx.community.louvain_communities(
                person_graph,
                weight="weight",
                seed=42
            )

        except AttributeError:

            # Fallback for older NetworkX versions

            communities = list(
                nx.community.greedy_modularity_communities(
                    person_graph,
                    weight="weight"
                )
            )

    # -----------------------------------------------------
    # 5. Sort communities
    # -----------------------------------------------------

    # Largest communities appear first.

    communities = sorted(
        communities,
        key=lambda community: (
            -len(community),
            sorted(community)[0]
        )
    )

    # -----------------------------------------------------
    # 6. Build syndicate output
    # -----------------------------------------------------

    syndicates = []

    assignments = {}

    for index, community in enumerate(
        communities,
        start=1
    ):

        # A, B, C, D...
        syndicate_id = (
            f"Syndicate_{chr(64 + index)}"
        )

        members = []

        for person_node in community:

            # Retrieve the REAL name from the copied
            # node attributes.

            name = person_graph.nodes[
                person_node
            ].get(
                "name",
                person_node
            )

            members.append(name)

            # Use human-readable name for assignments.

            assignments[
                name
            ] = syndicate_id

        # Keep member names deterministic.

        members.sort()

        syndicates.append({
            "id": syndicate_id,
            "members": members,
            "size": len(members)
        })

    # -----------------------------------------------------
    # 7. Return result
    # -----------------------------------------------------

    return {
        "syndicates": syndicates,
        "assignments": assignments
    }