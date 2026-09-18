from alert_detector import detect_alerts


# TEST DATA

relationships = []


# Communication spike

for i in range(12):

    relationships.append({
        "source": "Ravi Kumar",
        "target": "Amit Sharma",
        "relationship": "CALLED",
        "confidence": 0.95,
        "evidence": (
            f"Call {i + 1} between Ravi Kumar "
            "and Amit Sharma."
        ),
        "source_type": "CDR"
    })


# ---------------------------------------------------------
# Late-night calls
# ---------------------------------------------------------

for hour in [1, 2, 3, 4]:

    relationships.append({
        "source": "Ravi Kumar",
        "target": "Raj Malhotra",
        "relationship": "CALLED",
        "confidence": 0.92,
        "timestamp": (
            f"2026-09-01T{hour:02d}:30:00"
        ),
        "evidence": (
            f"Call at {hour}:30 AM."
        ),
        "source_type": "CDR"
    })


# ---------------------------------------------------------
# Large transaction
# ---------------------------------------------------------

relationships.append({
    "source": "Ravi Kumar",
    "target": "Amit Sharma",
    "relationship": "TRANSFERRED_MONEY_TO",
    "amount": 500000,
    "confidence": 0.96,
    "evidence": (
        "Ravi Kumar transferred ₹500000 "
        "to Amit Sharma."
    ),
    "source_type": "BANK"
})


# ---------------------------------------------------------
# Circular transactions
# ---------------------------------------------------------

relationships.extend([

    {
        "source": "Ravi Kumar",
        "target": "Amit Sharma",
        "relationship": "TRANSFERRED_MONEY_TO",
        "amount": 50000,
        "confidence": 0.95,
        "evidence": (
            "Ravi Kumar transferred ₹50000 "
            "to Amit Sharma."
        ),
        "source_type": "BANK"
    },

    {
        "source": "Amit Sharma",
        "target": "Raj Malhotra",
        "relationship": "TRANSFERRED_MONEY_TO",
        "amount": 45000,
        "confidence": 0.94,
        "evidence": (
            "Amit Sharma transferred ₹45000 "
            "to Raj Malhotra."
        ),
        "source_type": "BANK"
    },

    {
        "source": "Raj Malhotra",
        "target": "Ravi Kumar",
        "relationship": "TRANSFERRED_MONEY_TO",
        "amount": 40000,
        "confidence": 0.93,
        "evidence": (
            "Raj Malhotra transferred ₹40000 "
            "to Ravi Kumar."
        ),
        "source_type": "BANK"
    }

])


# ---------------------------------------------------------
# Shared vehicle
# ---------------------------------------------------------

relationships.extend([

    {
        "source": "Ravi Kumar",
        "target": "PB10AB1234",
        "relationship": "USED_VEHICLE",
        "confidence": 0.92,
        "evidence": (
            "Ravi Kumar used vehicle PB10AB1234."
        ),
        "source_type": "FIR"
    },

    {
        "source": "Amit Sharma",
        "target": "PB10AB1234",
        "relationship": "USED_VEHICLE",
        "confidence": 0.92,
        "evidence": (
            "Amit Sharma used vehicle PB10AB1234."
        ),
        "source_type": "FIR"
    },

    {
        "source": "Raj Malhotra",
        "target": "PB10AB1234",
        "relationship": "USED_VEHICLE",
        "confidence": 0.91,
        "evidence": (
            "Raj Malhotra used vehicle PB10AB1234."
        ),
        "source_type": "FIR"
    }

])


# =========================================================
# SYNDICATES
# =========================================================

syndicates = {

    "assignments": {

        "Ravi Kumar":
            "Syndicate_A",

        "Amit Sharma":
            "Syndicate_A",

        "Raj Malhotra":
            "Syndicate_B"

    }
}


# =========================================================
# RUN DETECTOR
# =========================================================

data = {
    "relationships": relationships
}


alerts = detect_alerts(
    data,
    syndicates=syndicates
)


# =========================================================
# PRINT RESULTS
# =========================================================

print("\n" + "=" * 70)

print("ALERT DETECTION RESULTS")

print("=" * 70)


for alert in alerts:

    print("\nALERT:")

    print(
        f"ID: {alert['id']}"
    )

    print(
        f"Severity: {alert['severity']}"
    )

    print(
        f"Type: {alert['type']}"
    )

    print(
        f"Message: {alert['message']}"
    )

    print(
        f"Confidence: "
        f"{alert['confidence']:.2f}"
    )

    print(
        f"Entities: "
        f"{alert.get('entities', [])}"
    )

print("\n" + "=" * 70)

print(
    f"TOTAL ALERTS: {len(alerts)}"
)

print("=" * 70)