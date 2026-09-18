# =========================================================
# INSIGHTS GENERATOR
# =========================================================
#
# Converts the results of the intelligence modules into
# structured investigative insights.
#
# This module summarizes analytical findings.
# It does NOT make a legal determination of guilt.
# =========================================================


def generate_insights(case_data):
    """
    Generate structured intelligence insights.

    Expected input:

        {
            "entities": {...},
            "relationships": [...],
            "nodes": [...],
            "edges": [...],
            "kingpin": {...},
            "investigation_priorities": [...],
            "syndicates": [...],
            "alerts": [...]
        }

    Returns:

        {
            "primary_subject": {...},
            "network_summary": {...},
            "evidence": [...],
            "key_findings": [...],
            "priority_summary": {...},
            "chargesheet_evidence": [...]
        }
    """

    if case_data is None:
        case_data = {}

    entities = case_data.get(
        "entities",
        {}
    )

    relationships = case_data.get(
        "relationships",
        []
    )

    syndicates = case_data.get(
        "syndicates",
        []
    )

    alerts = case_data.get(
        "alerts",
        []
    )

    investigation_priorities = case_data.get(
        "investigation_priorities",
        []
    )

    network_influence = case_data.get(
        "kingpin",
        {}
    )

    # -----------------------------------------------------
    # PRIMARY SUBJECT
    # -----------------------------------------------------

    primary_subject = build_primary_subject(
        network_influence,
        investigation_priorities
    )

    # -----------------------------------------------------
    # NETWORK SUMMARY
    # -----------------------------------------------------

    network_summary = build_network_summary(
        entities,
        relationships,
        syndicates,
        alerts
    )

    # -----------------------------------------------------
    # EVIDENCE
    # -----------------------------------------------------

    evidence = extract_evidence(
        relationships,
        alerts
    )

    # -----------------------------------------------------
    # KEY FINDINGS
    # -----------------------------------------------------

    key_findings = generate_key_findings(
        primary_subject,
        network_summary,
        alerts,
        syndicates
    )

    # -----------------------------------------------------
    # PRIORITY SUMMARY
    # -----------------------------------------------------

    priority_summary = build_priority_summary(
        investigation_priorities
    )

    # -----------------------------------------------------
    # CHARGESHEET EVIDENCE
    # -----------------------------------------------------

    chargesheet_evidence = build_chargesheet_evidence(
        primary_subject,
        relationships,
        alerts,
        syndicates
    )

    return {
        "primary_subject": primary_subject,
        "network_summary": network_summary,
        "evidence": evidence,
        "key_findings": key_findings,
        "priority_summary": priority_summary,
        "chargesheet_evidence": chargesheet_evidence
    }


# =========================================================
# PRIMARY SUBJECT
# =========================================================

def build_primary_subject(
    network_influence,
    investigation_priorities
):
    """
    Determine the primary analytical subject.

    First preference:
        Highest network influence result.

    Fallback:
        Highest investigation priority.

    This designation is analytical only and does not
    establish guilt or criminal responsibility.
    """

    if network_influence:

        subject = network_influence.get(
            "suspect"
        )

        if subject:

            return {
                "name": subject,

                "role": network_influence.get(
                    "role",
                    "High Network Influence"
                ),

                "influence_score":
                    network_influence.get(
                        "influence_score",
                        0
                    ),

                "priority_level":
                    network_influence.get(
                        "priority_level",
                        "Unknown"
                    )
            }

    # -----------------------------------------------------
    # FALLBACK TO HIGHEST INVESTIGATION PRIORITY
    # -----------------------------------------------------

    if investigation_priorities:

        sorted_priorities = sorted(
            investigation_priorities,

            key=lambda item: item.get(
                "investigation_priority",
                0
            ),

            reverse=True
        )

        top = sorted_priorities[
            0
        ]

        return {
            "name": top.get(
                "suspect",
                "Unknown"
            ),

            "role":
                "Priority Investigation Subject",

            "investigation_priority":
                top.get(
                    "investigation_priority",
                    0
                ),

            "priority_level":
                top.get(
                    "priority_level",
                    "Unknown"
                )
        }

    return {
        "name": "Unknown",
        "role": "Unknown",
        "investigation_priority": 0,
        "priority_level": "Unknown"
    }


# =========================================================
# NETWORK SUMMARY
# =========================================================

def build_network_summary(
    entities,
    relationships,
    syndicates,
    alerts
):
    """
    Create a summary of the investigated network.
    """

    persons = entities.get(
        "persons",
        []
    )

    phones = entities.get(
        "phones",
        []
    )

    vehicles = entities.get(
        "vehicles",
        []
    )

    locations = entities.get(
        "locations",
        []
    )

    organisations = entities.get(
        "organisations",
        []
    )

    bank_accounts = entities.get(
        "bank_accounts",
        []
    )

    dates_times = entities.get(
        "dates_times",
        []
    )

    return {
        "persons": len(
            persons
        ),

        "phones": len(
            phones
        ),

        "vehicles": len(
            vehicles
        ),

        "locations": len(
            locations
        ),

        "organisations": len(
            organisations
        ),

        "bank_accounts": len(
            bank_accounts
        ),

        "dates_times": len(
            dates_times
        ),

        "relationships": len(
            relationships
        ),

        "syndicates": get_syndicate_count(
            syndicates
        ),

        "alerts": len(
            alerts
        )
    }


# =========================================================
# EVIDENCE EXTRACTION
# =========================================================

def extract_evidence(
    relationships,
    alerts
):
    """
    Collect analytical evidence from relationships
    and alerts.

    Duplicate evidence is removed.
    """

    evidence = []

    seen = set()

    # -----------------------------------------------------
    # RELATIONSHIP EVIDENCE
    # -----------------------------------------------------

    for relationship in relationships:

        text = relationship.get(
            "evidence",
            ""
        )

        if not text:
            continue

        key = (
            "relationship",
            text
        )

        if key in seen:
            continue

        seen.add(
            key
        )

        evidence.append({
            "type":
                "RELATIONSHIP",

            "relationship":
                relationship.get(
                    "relationship",
                    "UNKNOWN"
                ),

            "source":
                relationship.get(
                    "source",
                    ""
                ),

            "target":
                relationship.get(
                    "target",
                    ""
                ),

            "confidence":
                relationship.get(
                    "confidence",
                    1.0
                ),

            "text":
                text
        })

    # -----------------------------------------------------
    # ALERT EVIDENCE
    # -----------------------------------------------------

    for alert in alerts:

        message = alert.get(
            "message",
            ""
        )

        if not message:
            continue

        key = (
            "alert",

            alert.get(
                "type",
                "UNKNOWN"
            ),

            message
        )

        if key in seen:
            continue

        seen.add(
            key
        )

        evidence.append({
            "type":
                "ALERT",

            "alert_type":
                alert.get(
                    "type",
                    "UNKNOWN"
                ),

            "severity":
                alert.get(
                    "severity",
                    "UNKNOWN"
                ),

            "confidence":
                alert.get(
                    "confidence",
                    0
                ),

            "text":
                message
        })

    return evidence


# =========================================================
# KEY FINDINGS
# =========================================================

def generate_key_findings(
    primary_subject,
    network_summary,
    alerts,
    syndicates
):
    """
    Generate concise analytical findings suitable
    for a dashboard.
    """

    findings = []

    subject = primary_subject.get(
        "name"
    )

    # -----------------------------------------------------
    # PRIMARY SUBJECT
    # -----------------------------------------------------

    if (
        subject
        and subject != "Unknown"
    ):

        finding = (
            subject
            + " has the highest network influence "
            + "among the analysed persons."
        )

        findings.append(
            finding
        )

    # -----------------------------------------------------
    # SYNDICATES
    # -----------------------------------------------------

    syndicate_count = network_summary.get(
        "syndicates",
        0
    )

    if syndicate_count > 0:

        finding = (
            str(
                syndicate_count
            )
            + " potential network group(s) "
            + "were identified for investigative review."
        )

        findings.append(
            finding
        )

    # -----------------------------------------------------
    # CRITICAL ALERTS
    # -----------------------------------------------------

    critical_count = count_alerts_by_severity(
        alerts,
        "CRITICAL"
    )

    if critical_count > 0:

        finding = (
            str(
                critical_count
            )
            + " critical analytical alert(s) "
            + "were detected."
        )

        findings.append(
            finding
        )

    # -----------------------------------------------------
    # HIGH ALERTS
    # -----------------------------------------------------

    high_count = count_alerts_by_severity(
        alerts,
        "HIGH"
    )

    if high_count > 0:

        finding = (
            str(
                high_count
            )
            + " high-severity analytical alert(s) "
            + "were detected."
        )

        findings.append(
            finding
        )

    # -----------------------------------------------------
    # NETWORK SIZE
    # -----------------------------------------------------

    persons = network_summary.get(
        "persons",
        0
    )

    relationships = network_summary.get(
        "relationships",
        0
    )

    if (
        persons > 0
        and relationships > 0
    ):

        finding = (
            "The analysed network contains "
            + str(
                persons
            )
            + " identified person(s) and "
            + str(
                relationships
            )
            + " recorded relationship(s)."
        )

        findings.append(
            finding
        )

    return findings


# =========================================================
# PRIORITY SUMMARY
# =========================================================

def build_priority_summary(
    investigation_priorities
):
    """
    Summarize subjects according to investigation
    priority level.
    """

    summary = {
        "Critical": 0,
        "High": 0,
        "Medium": 0,
        "Low": 0,
        "Unknown": 0
    }

    highest_priority = None

    highest_score = -1

    for subject in investigation_priorities:

        priority = subject.get(
            "priority_level",
            "Unknown"
        )

        if priority not in summary:
            priority = "Unknown"

        summary[
            priority
        ] += 1

        score = subject.get(
            "investigation_priority",
            0
        )

        if score > highest_score:

            highest_score = score

            highest_priority = {
                "suspect":
                    subject.get(
                        "suspect",
                        "Unknown"
                    ),

                "investigation_priority":
                    score,

                "priority_level":
                    priority
            }

    return {
        "counts":
            summary,

        "highest_priority":
            highest_priority
    }


# =========================================================
# CHARGESHEET EVIDENCE
# =========================================================

def build_chargesheet_evidence(
    primary_subject,
    relationships,
    alerts,
    syndicates
):
    """
    Generate structured analytical evidence points.

    These are analytical findings and NOT legal
    conclusions.
    """

    subject = primary_subject.get(
        "name"
    )

    if (
        not subject
        or subject == "Unknown"
    ):
        return []

    evidence = []

    # -----------------------------------------------------
    # RELATIONSHIP EVIDENCE
    # -----------------------------------------------------

    for relationship in relationships:

        source = relationship.get(
            "source",
            ""
        )

        target = relationship.get(
            "target",
            ""
        )

        if (
            subject != source
            and subject != target
        ):
            continue

        relationship_type = relationship.get(
            "relationship",
            "UNKNOWN"
        )

        text = relationship.get(
            "evidence",
            ""
        )

        readable_relationship = format_relationship(
            relationship_type
        )

        description = (
            source
            + " "
            + readable_relationship
            + " "
            + target
            + "."
        )

        evidence.append({
            "category":
                "NETWORK_RELATIONSHIP",

            "description":
                description,

            "source":
                text,

            "confidence":
                relationship.get(
                    "confidence",
                    1.0
                )
        })

    # -----------------------------------------------------
    # ALERT EVIDENCE
    # -----------------------------------------------------

    for alert in alerts:

        alert_entities = alert.get(
            "entities",
            []
        )

        if subject not in alert_entities:
            continue

        evidence.append({
            "category":
                "ANALYTICAL_ALERT",

            "description":
                alert.get(
                    "message",
                    ""
                ),

            "severity":
                alert.get(
                    "severity",
                    "UNKNOWN"
                ),

            "confidence":
                alert.get(
                    "confidence",
                    0
                )
        })

    # -----------------------------------------------------
    # NETWORK GROUP ASSOCIATION
    # -----------------------------------------------------

    for syndicate in get_syndicate_list(
        syndicates
    ):

        members = syndicate.get(
            "members",
            []
        )

        member_names = []

        for member in members:

            if member.startswith(
                "PERSON_"
            ):

                name = member.replace(
                    "PERSON_",
                    ""
                )

                name = name.replace(
                    "_",
                    " "
                )

                member_names.append(
                    name.title()
                )

            else:

                member_names.append(
                    member
                )

        if subject not in member_names:
            continue

        evidence.append({
            "category":
                "NETWORK_GROUP_ASSOCIATION",

            "description": (
                subject
                + " is associated with network group "
                + str(
                    syndicate.get(
                        "id",
                        "Unknown"
                    )
                )
                + "."
            ),

            "members":
                member_names
        })

    return evidence


# =========================================================
# SYNDICATE HELPERS
# =========================================================

def get_syndicate_list(
    syndicates
):
    """
    Support both a direct list and a dictionary
    containing a syndicates list.
    """

    if isinstance(
        syndicates,
        dict
    ):

        return syndicates.get(
            "syndicates",
            []
        )

    if isinstance(
        syndicates,
        list
    ):

        return syndicates

    return []


def get_syndicate_count(
    syndicates
):

    return len(
        get_syndicate_list(
            syndicates
        )
    )


# =========================================================
# ALERT HELPERS
# =========================================================

def count_alerts_by_severity(
    alerts,
    severity
):
    """
    Count alerts with a specific severity.
    """

    count = 0

    for alert in alerts:

        if alert.get(
            "severity"
        ) == severity:

            count += 1

    return count


# =========================================================
# RELATIONSHIP FORMATTER
# =========================================================

def format_relationship(
    relationship
):
    """
    Convert relationship constants into
    human-readable text.
    """

    replacements = {

        "CALLED":
            "called",

        "CONTACTED":
            "contacted",

        "MET":
            "met",

        "VISITED":
            "visited",

        "OWNS":
            "owns",

        "USED":
            "used",

        "USED_VEHICLE":
            "used vehicle",

        "USED_PHONE":
            "used phone",

        "TRANSFERRED_MONEY_TO":
            "transferred money to",

        "ASSOCIATED_WITH_LOCATION":
            "was associated with location"
    }

    if relationship in replacements:

        return replacements[
            relationship
        ]

    return relationship.lower().replace(
        "_",
        " "
    )