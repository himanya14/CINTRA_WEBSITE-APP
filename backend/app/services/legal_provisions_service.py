from datetime import datetime
from typing import Dict, List


LEGAL_PROVISION_CATALOGUE = [
    {
        "keywords": [
            "criminal conspiracy",
            "conspiracy",
            "coordinated conspiracy"
        ],
        "current": {
            "law": "Bharatiya Nyaya Sanhita, 2023",
            "short_law": "BNS",
            "section": "61",
            "provision": "Criminal conspiracy"
        },
        "legacy": {
            "law": "Indian Penal Code, 1860",
            "short_law": "IPC",
            "section": "120B",
            "provision": "Punishment of criminal conspiracy"
        }
    },
    {
        "keywords": [
            "cheating",
            "fraud",
            "financial fraud",
            "fraudulent transaction",
            "fraudulent transactions"
        ],
        "current": {
            "law": "Bharatiya Nyaya Sanhita, 2023",
            "short_law": "BNS",
            "section": "318",
            "provision": "Cheating"
        },
        "legacy": {
            "law": "Indian Penal Code, 1860",
            "short_law": "IPC",
            "section": "420",
            "provision": (
                "Cheating and dishonestly inducing "
                "delivery of property"
            )
        }
    },
    {
        "keywords": [
            "theft",
            "vehicle theft",
            "property theft",
            "stolen property"
        ],
        "current": {
            "law": "Bharatiya Nyaya Sanhita, 2023",
            "short_law": "BNS",
            "section": "303",
            "provision": "Theft"
        },
        "legacy": {
            "law": "Indian Penal Code, 1860",
            "short_law": "IPC",
            "section": "379",
            "provision": "Punishment for theft"
        }
    },
    {
        "keywords": [
            "criminal breach of trust",
            "breach of trust",
            "misappropriation"
        ],
        "current": {
            "law": "Bharatiya Nyaya Sanhita, 2023",
            "short_law": "BNS",
            "section": "316",
            "provision": "Criminal breach of trust"
        },
        "legacy": {
            "law": "Indian Penal Code, 1860",
            "short_law": "IPC",
            "section": "406",
            "provision": "Punishment for criminal breach of trust"
        }
    },
    {
        "keywords": [
            "identity theft",
            "stolen credentials",
            "credential theft",
            "impersonation using credentials"
        ],
        "special": {
            "law": "Information Technology Act, 2000",
            "short_law": "IT Act",
            "section": "66C",
            "provision": "Punishment for identity theft"
        }
    },
    {
        "keywords": [
            "online impersonation",
            "digital impersonation",
            "cheating by personation",
            "computer impersonation",
            "phishing"
        ],
        "special": {
            "law": "Information Technology Act, 2000",
            "short_law": "IT Act",
            "section": "66D",
            "provision": (
                "Cheating by personation using "
                "computer resource"
            )
        }
    },
    {
        "keywords": [
            "unauthorised access",
            "unauthorized access",
            "computer intrusion",
            "computer attack",
            "data theft",
            "computer resource"
        ],
        "special": {
            "law": "Information Technology Act, 2000",
            "short_law": "IT Act",
            "section": "66",
            "provision": "Computer related offences"
        }
    }
]


def _normalise(value: str) -> str:
    if not value:
        return ""

    return " ".join(
        str(value).lower().strip().split()
    )


def _is_legacy_case(case) -> bool:
    registered_on = getattr(
        case,
        "registered_on",
        None
    )

    if not registered_on:
        return False

    criminal_law_change_date = datetime(
        2024,
        7,
        1
    )

    return (
        registered_on <
        criminal_law_change_date
    )


def _provision_key(item: Dict) -> str:
    return (
        f"{item.get('law', '')}|"
        f"{item.get('section', '')}"
    )


def suggest_legal_provisions(
    case
) -> List[Dict]:
    searchable_text = _normalise(
        " ".join(
            [
                getattr(
                    case,
                    "title",
                    ""
                ) or "",
                getattr(
                    case,
                    "offence",
                    ""
                ) or "",
                getattr(
                    case,
                    "description",
                    ""
                ) or ""
            ]
        )
    )

    legacy_case = _is_legacy_case(
        case
    )

    results = []
    seen = set()

    for rule in (
        LEGAL_PROVISION_CATALOGUE
    ):
        matched_keywords = [
            keyword
            for keyword
            in rule["keywords"]
            if _normalise(keyword)
            in searchable_text
        ]

        if not matched_keywords:
            continue

        primary = None

        if "special" in rule:
            primary = dict(
                rule["special"]
            )

        elif legacy_case:
            primary = dict(
                rule["legacy"]
            )

        else:
            primary = dict(
                rule["current"]
            )

        key = _provision_key(
            primary
        )

        if key in seen:
            continue

        seen.add(
            key
        )

        primary[
            "status"
        ] = "Suggested"

        primary[
            "matched_keywords"
        ] = matched_keywords

        primary[
            "basis"
        ] = (
            "Suggested from the offence, title "
            "or description recorded in the case."
        )

        primary[
            "requires_officer_review"
        ] = True

        results.append(
            primary
        )

    return results


def format_legal_provisions_for_chargesheet(
    provisions: List[Dict]
) -> str:
    if not provisions:
        return (
            "No legal provision has been "
            "automatically suggested. "
            "Applicable provisions must be "
            "entered or approved by the "
            "Investigating Officer."
        )

    lines = [
        (
            "SYSTEM-SUGGESTED LEGAL PROVISIONS "
            "- SUBJECT TO OFFICER REVIEW"
        ),
        ""
    ]

    for index, provision in enumerate(
        provisions,
        start=1
    ):
        lines.append(
            (
                f"{index}. "
                f"{provision['short_law']} "
                f"Section "
                f"{provision['section']} - "
                f"{provision['provision']}"
            )
        )

        lines.append(
            (
                f"   Law: "
                f"{provision['law']}"
            )
        )

        lines.append(
            "   Status: Suggested"
        )

        lines.append(
            (
                f"   Basis: "
                f"{provision['basis']}"
            )
        )

        lines.append(
            (
                "   Officer approval required "
                "before inclusion in a final "
                "filing."
            )
        )

        lines.append(
            ""
        )

    return "\n".join(
        lines
    ).strip()