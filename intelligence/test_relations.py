from entity_extractor import extract_entities
from relation_extractor import extract_relationships


tests = [

    "Ravi Kumar contacted Amit Sharma.",

    "Ravi Kumar called Amit Sharma using 9876543210.",

    "Amit Sharma was using vehicle PB10AB1234.",

    "Ravi Kumar transferred ₹50000 to Amit Sharma.",

    "Ravi Kumar was seen near Sector 21.",

    "Amit Sharma met Raj Malhotra.",

    "Raj Malhotra visited Sector 21.",

    "Ravi Kumar phoned Amit Sharma.",

    "Amit Sharma owns vehicle PB10AB1234.",

    # Passive voice
    "Amit Sharma was contacted by Ravi Kumar.",

    "Amit Sharma was called by Ravi Kumar.",

    # Different grammatical forms
    "Ravi Kumar is calling Amit Sharma.",

    "Ravi Kumar calls Amit Sharma.",

    "Ravi Kumar contacted Raj Malhotra at Sector 21.",

    # More realistic wording
    "The accused Ravi Kumar contacted Amit Sharma.",

    "Ravi Kumar used mobile number 9876543210.",

]


for text in tests:

    print("\n" + "=" * 70)

    print("TEXT:")
    print(text)

    entities = extract_entities(text)

    print("\nENTITIES:")
    print(entities)

    relationships = extract_relationships(
        text,
        entities
    )

    print("\nRELATIONSHIPS:")

    for relation in relationships:
        print(relation)