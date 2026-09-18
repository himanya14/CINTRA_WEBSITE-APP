from entity_extractor import extract_entities
from relation_extractor import extract_relationships


test_sentences = [

    "Ravi Kumar contacted Amit Sharma.",

    "Ravi Kumar called Amit Sharma using 9876543210.",

    "Amit Sharma was using vehicle PB10AB1234.",

    "Ravi Kumar transferred ₹50000 to Amit Sharma.",

    "Ravi Kumar was seen near Sector 21.",

    "Amit Sharma met Raj Malhotra.",

    "Raj Malhotra visited Sector 21.",

    "Ravi Kumar phoned Amit Sharma.",

    "Amit Sharma owns vehicle PB10AB1234."

]

for text in test_sentences:

    print("\nTEXT:")
    print(text)

    print("\nENTITIES:")
    print(extract_entities(text))

    print("-" * 60)