from entity_extractor import extract_entities
from relation_extractor import extract_relationships
from graph_builder import build_graph_data


text = """
Ravi Kumar contacted Amit Sharma.
Ravi Kumar called Amit Sharma using 9876543210.
Amit Sharma was using vehicle PB10AB1234.
Ravi Kumar transferred ₹50000 to Amit Sharma.
Ravi Kumar was seen near Sector 21.
Amit Sharma met Raj Malhotra.
"""


# Step 1: Extract entities
entities = extract_entities(text)

print("\nENTITIES:")
print(entities)


# Step 2: Extract relationships
relationships = extract_relationships(
    text,
    entities
)

print("\nRELATIONSHIPS:")

for relation in relationships:
    print(relation)


# Step 3: Build graph
graph_data = build_graph_data(
    entities,
    relationships
)


print("\nGRAPH DATA:")

print("\nNODES:")

for node in graph_data["nodes"]:
    print(node)


print("\nEDGES:")

for edge in graph_data["edges"]:
    print(edge)