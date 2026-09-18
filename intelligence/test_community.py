from entity_extractor import extract_entities
from relation_extractor import extract_relationships
from graph_builder import build_graph
from community_detector import detect_communities


text = """
Ravi Kumar contacted Amit Sharma.
Ravi Kumar called Amit Sharma using 9876543210.
Ravi Kumar transferred ₹50000 to Amit Sharma.
Amit Sharma met Raj Malhotra.
Raj Malhotra visited Sector 21.
"""


# =========================================================
# 1. ENTITIES
# =========================================================

entities = extract_entities(text)

print("\nENTITIES:")
print(entities)


# =========================================================
# 2. RELATIONSHIPS
# =========================================================

relationships = extract_relationships(
    text,
    entities
)

print("\nRELATIONSHIPS:")

for relationship in relationships:
    print(relationship)


# =========================================================
# 3. GRAPH
# =========================================================

graph = build_graph(
    entities,
    relationships
)

print("\nGRAPH:")
print(
    "Nodes:",
    graph.number_of_nodes()
)

print(
    "Edges:",
    graph.number_of_edges()
)


# =========================================================
# 4. COMMUNITY DETECTION
# =========================================================

result = detect_communities(
    graph
)

print("\nSYNDICATES:")

for syndicate in result["syndicates"]:

    print(
        syndicate
    )


print("\nASSIGNMENTS:")

for person, syndicate in result["assignments"].items():

    print(
        person,
        "->",
        syndicate
    )