from insights_generator import generate_insights


case_data = {

    "entities": {
        "persons": [
            "Ravi Kumar",
            "Amit Sharma",
            "Raj Malhotra"
        ],
        "phones": [
            "9876543210"
        ],
        "vehicles": [
            "PB10AB1234"
        ],
        "locations": [
            "Sector 21"
        ],
        "organisations": [],
        "bank_accounts": []
    },

    "relationships": [

        {
            "source": "Ravi Kumar",
            "target": "Amit Sharma",
            "relationship": "CALLED",
            "confidence": 0.95,
            "evidence":
                "Ravi Kumar called Amit Sharma."
        },

        {
            "source": "Ravi Kumar",
            "target": "Amit Sharma",
            "relationship":
                "TRANSFERRED_MONEY_TO",
            "confidence": 0.95,
            "evidence":
                "Ravi Kumar transferred ₹50000 to Amit Sharma."
        },

        {
            "source": "Amit Sharma",
            "target": "PB10AB1234",
            "relationship": "USED_VEHICLE",
            "confidence": 0.92,
            "evidence":
                "Amit Sharma used vehicle PB10AB1234."
        }
    ],

    "kingpin": {
        "suspect": "Amit Sharma",
        "role": "Highest Network Influence",
        "influence_score": 97.51,
        "priority_level": "Critical"
    },

    "investigation_priorities": [

        {
            "suspect": "Amit Sharma",
            "investigation_priority": 97.51,
            "priority_level": "Critical"
        },

        {
            "suspect": "Ravi Kumar",
            "investigation_priority": 64.14,
            "priority_level": "High"
        },

        {
            "suspect": "Raj Malhotra",
            "investigation_priority": 35.75,
            "priority_level": "Low"
        }
    ],

    "syndicates": [
        {
            "id": "Syndicate_A",
            "members": [
                "Amit Sharma",
                "Ravi Kumar"
            ]
        }
    ],

    "alerts": [

        {
            "id": "ALERT_001",
            "type": "COMMUNICATION_SPIKE",
            "severity": "HIGH",
            "message":
                "12 calls detected between Amit Sharma and Ravi Kumar.",
            "entities": [
                "Amit Sharma",
                "Ravi Kumar"
            ],
            "confidence": 0.82
        },

        {
            "id": "ALERT_002",
            "type": "LARGE_TRANSACTION",
            "severity": "HIGH",
            "message":
                "Large transaction of ₹500,000 detected from Ravi Kumar to Amit Sharma.",
            "entities": [
                "Ravi Kumar",
                "Amit Sharma"
            ],
            "confidence": 0.95
        }
    ]
}


result = generate_insights(
    case_data
)


print("\n" + "=" * 70)
print("GENERATED INTELLIGENCE")
print("=" * 70)


print("\nPRIMARY SUBJECT:")
print(result["primary_subject"])


print("\nNETWORK SUMMARY:")
print(result["network_summary"])


print("\nKEY FINDINGS:")

for finding in result["key_findings"]:
    print("-", finding)


print("\nPRIORITY SUMMARY:")
print(result["priority_summary"])


print("\nCHARGESHEET EVIDENCE:")

for evidence in result[
    "chargesheet_evidence"
]:

    print(
        evidence
    )


print("\nTOTAL EVIDENCE:")
print(
    len(
        result["evidence"]
    )
)