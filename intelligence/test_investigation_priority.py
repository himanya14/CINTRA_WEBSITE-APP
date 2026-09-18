from entity_extractor import extract_entities
from relation_extractor import extract_relationships
from graph_builder import build_graph
from kingpin_detector import detect_kingpin
from investigation_priority import calculate_investigation_priority


text = """
Ravi Kumar contacted Amit Sharma.
Ravi Kumar called Amit Sharma using 9876543210.
Amit Sharma was using vehicle PB10AB1234.
Ravi Kumar transferred ₹50000 to Amit Sharma.
Ravi Kumar was seen near Sector 21.
Amit Sharma met Raj Malhotra.
Raj Malhotra visited Sector 21.
"""


# =========================================================
# 1. ENTITY EXTRACTION
# =========================================================

entities = extract_entities(text)

print("\nENTITIES:")
print(entities)


# =========================================================
# 2. RELATIONSHIP EXTRACTION
# =========================================================

relationships = extract_relationships(
    text,
    entities
)

print("\nRELATIONSHIPS:")

for relationship in relationships:
    print(relationship)


# =========================================================
# 3. BUILD GRAPH
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
# 4. NETWORK INFLUENCE
# =========================================================

network_influence = detect_kingpin(
    graph
)

print("\nNETWORK INFLUENCE:")
print(network_influence)


# =========================================================
# 5. INVESTIGATION PRIORITIES
# =========================================================

print("\nINVESTIGATION PRIORITIES:")

for person in entities["persons"]:

    result = calculate_investigation_priority(
        person,
        graph,
        network_influence
    )

    print("\n", result)