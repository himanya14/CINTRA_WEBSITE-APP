import re

import spacy


# =========================================================
# NLP MODEL
# =========================================================

nlp = spacy.load("en_core_web_sm")


# =========================================================
# ENTITY TYPES
# =========================================================

ENTITY_TYPE_MAPPING = {
    "persons": "PERSON",
    "phones": "PHONE",
    "vehicles": "VEHICLE",
    "locations": "LOCATION",
    "organisations": "ORGANISATION",
    "bank_accounts": "BANK_ACCOUNT",
    "devices": "DEVICE",
    "evidence": "EVIDENCE",
    "dates_times": "DATE_TIME"
}


# =========================================================
# PERSON RELATIONSHIP VERBS
# =========================================================

PERSON_RELATION_VERBS = {
    "call": "CALLED",
    "phone": "CALLED",
    "contact": "CONTACTED",
    "meet": "MET_WITH"
}


# =========================================================
# MAIN
# =========================================================

def extract_relationships(
    text,
    entities,
    source_type="FIR"
):
    """
    Extract relationships dynamically from case text.

    No person, vehicle, phone, account, CCTV or location
    values are hardcoded.
    """

    if not text or not text.strip():
        return []

    if not isinstance(
        entities,
        dict
    ):
        return []

    known_entities = (
        build_known_entities(
            entities
        )
    )

    doc = nlp(text)

    relationships = []

    for sentence in doc.sents:

        sentence_entities = (
            find_sentence_entities(
                sentence,
                known_entities
            )
        )

        if not sentence_entities:
            continue

        relationships.extend(
            extract_from_sentence(
                sentence,
                sentence_entities,
                source_type
            )
        )

    return remove_duplicates(
        relationships
    )


# =========================================================
# BUILD ENTITY LIST
# =========================================================

def build_known_entities(
    entities
):
    known = []

    for category, entity_type in (
        ENTITY_TYPE_MAPPING.items()
    ):

        for value in entities.get(
            category,
            []
        ) or []:

            value = str(
                value
            ).strip()

            if not value:
                continue

            known.append({
                "text": value,
                "type": entity_type
            })

    known.sort(
        key=lambda item:
            len(item["text"]),
        reverse=True
    )

    return known


# =========================================================
# ENTITY MATCH ALIASES
# =========================================================

def get_entity_patterns(
    entity
):
    """
    Return regex patterns that can locate a normalized
    entity inside original text.

    Example:

      stored node:
          IMEI 356938035643809

      sentence:
          IMEI number 356938035643809

    Both refer to the same entity.
    """

    value = entity[
        "text"
    ].strip()

    entity_type = entity[
        "type"
    ]

    patterns = [
        re.escape(
            value
        )
    ]

    # -----------------------------------------------------
    # PHONE
    # -----------------------------------------------------

    if entity_type == "PHONE":

        digits = re.sub(
            r"\D",
            "",
            value
        )

        if digits:

            patterns.append(
                re.escape(
                    digits
                )
            )

    # -----------------------------------------------------
    # BANK ACCOUNT
    # -----------------------------------------------------

    elif entity_type == "BANK_ACCOUNT":

        digits = re.sub(
            r"\D",
            "",
            value
        )

        if digits:

            patterns.extend([
                (
                    r"(?:bank\s+account|account|a/c)"
                    r"\s*"
                    r"(?:number|no\.?)?"
                    r"\s*[:\-]?\s*"
                    + re.escape(
                        digits
                    )
                ),
                re.escape(
                    digits
                )
            ])

    # -----------------------------------------------------
    # IMEI
    # -----------------------------------------------------

    elif (
        entity_type == "DEVICE"
        and value.upper().startswith(
            "IMEI "
        )
    ):

        imei = re.sub(
            r"\D",
            "",
            value
        )

        if imei:

            patterns.extend([
                (
                    r"\bIMEI"
                    r"\s*(?:number|no\.?)?"
                    r"\s*[:\-]?\s*"
                    + re.escape(
                        imei
                    )
                    + r"\b"
                ),
                re.escape(
                    imei
                )
            ])

    # -----------------------------------------------------
    # CCTV
    # -----------------------------------------------------

    elif (
        entity_type == "DEVICE"
        and value.upper().startswith(
            "CCTV "
        )
    ):

        identifier = (
            value[5:].strip()
        )

        if identifier:

            patterns.append(
                (
                    r"\bCCTV"
                    r"\s*(?:CAM|CAMERA)?"
                    r"\s*[-:#]?\s*"
                    + re.escape(
                        identifier
                    )
                    + r"\b"
                )
            )

    # -----------------------------------------------------
    # VEHICLE
    # -----------------------------------------------------

    elif entity_type == "VEHICLE":

        compact = re.sub(
            r"[\s\-]",
            "",
            value.upper()
        )

        if compact:
            patterns.append(
                re.escape(
                    compact
                )
            )

    return patterns


# =========================================================
# FIND ENTITIES INSIDE SENTENCE
# =========================================================

def find_sentence_entities(
    sentence,
    known_entities
):
    results = []

    sentence_text = (
        sentence.text
    )

    occupied = []

    for entity in known_entities:

        patterns = (
            get_entity_patterns(
                entity
            )
        )

        found_match = None

        for pattern in patterns:

            match = re.search(
                pattern,
                sentence_text,
                flags=re.IGNORECASE
            )

            if match:

                found_match = match
                break

        if not found_match:
            continue

        start = (
            found_match.start()
        )

        end = (
            found_match.end()
        )

        duplicate = any(
            item["text"].lower()
            == entity["text"].lower()
            and item["type"]
            == entity["type"]
            for item in results
        )

        if duplicate:
            continue

        fully_inside_existing = any(
            start >= existing_start
            and end <= existing_end
            for (
                existing_start,
                existing_end
            ) in occupied
        )

        if fully_inside_existing:
            continue

        results.append({
            "text": entity["text"],
            "type": entity["type"],
            "start": start,
            "end": end
        })

        occupied.append(
            (
                start,
                end
            )
        )

    results.sort(
        key=lambda item:
            item["start"]
    )

    return results


# =========================================================
# SENTENCE PIPELINE
# =========================================================

def extract_from_sentence(
    sentence,
    sentence_entities,
    source_type
):
    relationships = []

    text = (
        sentence.text.strip()
    )

    relationships.extend(
        extract_phone_relationships(
            text,
            sentence_entities,
            source_type
        )
    )

    relationships.extend(
        extract_vehicle_relationships(
            text,
            sentence_entities,
            source_type
        )
    )

    relationships.extend(
        extract_device_relationships(
            text,
            sentence_entities,
            source_type
        )
    )

    relationships.extend(
        extract_cctv_relationships(
            text,
            sentence_entities,
            source_type
        )
    )

    relationships.extend(
        extract_location_relationships(
            text,
            sentence_entities,
            source_type
        )
    )

    relationships.extend(
        extract_bank_account_relationships(
            text,
            sentence_entities,
            source_type
        )
    )

    relationships.extend(
        extract_financial_relationships(
            text,
            sentence_entities,
            source_type
        )
    )

    relationships.extend(
        extract_organisation_relationships(
            text,
            sentence_entities,
            source_type
        )
    )

    relationships.extend(
        extract_same_location_relationships(
            text,
            sentence_entities,
            source_type
        )
    )

    relationships.extend(
        extract_person_to_person_relationships(
            sentence,
            sentence_entities,
            source_type
        )
    )

    relationships.extend(
        extract_evidence_relationships(
            text,
            sentence_entities,
            source_type
        )
    )

    return remove_duplicates(
        relationships
    )


# =========================================================
# BASIC ENTITY HELPERS
# =========================================================

def entities_of_type(
    entities,
    entity_type
):
    return [
        entity
        for entity in entities
        if entity["type"]
        == entity_type
    ]


def unique_entities(
    entities
):
    result = []

    seen = set()

    for entity in entities:

        key = (
            entity["type"],
            entity["text"]
            .strip()
            .lower()
        )

        if key in seen:
            continue

        seen.add(
            key
        )

        result.append(
            entity
        )

    return result


def nearest_entity(
    source,
    candidates
):
    if not candidates:
        return None

    source_center = (
        source["start"]
        + source["end"]
    ) / 2

    valid = [
        candidate
        for candidate in candidates
        if not (
            candidate["text"].lower()
            == source["text"].lower()
            and candidate["type"]
            == source["type"]
        )
    ]

    if not valid:
        return None

    return min(
        valid,
        key=lambda candidate:
            abs(
                (
                    candidate["start"]
                    + candidate["end"]
                ) / 2
                - source_center
            )
    )


def entity_before(
    entities,
    position
):
    candidates = [
        entity
        for entity in entities
        if entity["end"]
        <= position
    ]

    if not candidates:
        return None

    return max(
        candidates,
        key=lambda entity:
            entity["end"]
    )


def entity_after(
    entities,
    position
):
    candidates = [
        entity
        for entity in entities
        if entity["start"]
        >= position
    ]

    if not candidates:
        return None

    return min(
        candidates,
        key=lambda entity:
            entity["start"]
    )


# =========================================================
# PHONE
# =========================================================

def extract_phone_relationships(
    text,
    entities,
    source_type
):
    relationships = []

    persons = entities_of_type(
        entities,
        "PERSON"
    )

    phones = entities_of_type(
        entities,
        "PHONE"
    )

    if (
        not persons
        or not phones
    ):
        return relationships

    lower = text.lower()

    indicators = [
        "used",
        "uses",
        "using",
        "mobile number",
        "phone number",
        "contact number",
        "registered to",
        "registered in the name",
        "belonged to",
        "belongs to"
    ]

    if not any(
        indicator in lower
        for indicator in indicators
    ):
        return relationships

    for person in persons:

        phone = nearest_entity(
            person,
            phones
        )

        if phone:

            relationships.append(
                create_relationship(
                    person,
                    phone,
                    "USED_PHONE",
                    text,
                    source_type,
                    0.92
                )
            )

    return relationships


# =========================================================
# VEHICLE
# =========================================================

def extract_vehicle_relationships(
    text,
    entities,
    source_type
):
    relationships = []

    persons = entities_of_type(
        entities,
        "PERSON"
    )

    vehicles = entities_of_type(
        entities,
        "VEHICLE"
    )

    if (
        not persons
        or not vehicles
    ):
        return relationships

    lower = text.lower()

    indicators = [
        "used vehicle",
        "using vehicle",
        "drove",
        "driving",
        "travelled in",
        "traveled in",
        "arrived in",
        "left in"
    ]

    if not any(
        indicator in lower
        for indicator in indicators
    ):
        return relationships

    for person in persons:

        vehicle = nearest_entity(
            person,
            vehicles
        )

        if vehicle:

            relationships.append(
                create_relationship(
                    person,
                    vehicle,
                    "USED_VEHICLE",
                    text,
                    source_type,
                    0.91
                )
            )

    return relationships


# =========================================================
# IMEI / GENERAL DEVICES
# =========================================================

def extract_device_relationships(
    text,
    entities,
    source_type
):
    relationships = []

    persons = entities_of_type(
        entities,
        "PERSON"
    )

    devices = [
        device
        for device
        in entities_of_type(
            entities,
            "DEVICE"
        )
        if not device[
            "text"
        ].upper().startswith(
            "CCTV "
        )
    ]

    if (
        not persons
        or not devices
    ):
        return relationships

    lower = text.lower()

    indicators = [
        "imei",
        "handset",
        "device",
        "used by",
        "using",
        "used"
    ]

    if not any(
        indicator in lower
        for indicator in indicators
    ):
        return relationships

    for device in devices:

        person = nearest_entity(
            device,
            persons
        )

        if person:

            relationships.append(
                create_relationship(
                    person,
                    device,
                    "USED_DEVICE",
                    text,
                    source_type,
                    0.90
                )
            )

    return relationships


# =========================================================
# CCTV
# =========================================================

def extract_cctv_relationships(
    text,
    entities,
    source_type
):
    relationships = []

    persons = entities_of_type(
        entities,
        "PERSON"
    )

    cameras = [
        device
        for device
        in entities_of_type(
            entities,
            "DEVICE"
        )
        if device[
            "text"
        ].upper().startswith(
            "CCTV "
        )
    ]

    if (
        not persons
        or not cameras
    ):
        return relationships

    lower = text.lower()

    indicators = [
        "captured",
        "recorded",
        "seen",
        "observed",
        "footage"
    ]

    if not any(
        indicator in lower
        for indicator in indicators
    ):
        return relationships

    for camera in cameras:

        person = nearest_entity(
            camera,
            persons
        )

        if person:

            relationships.append(
                create_relationship(
                    person,
                    camera,
                    "CAPTURED_BY",
                    text,
                    source_type,
                    0.90
                )
            )

    return relationships


# =========================================================
# LOCATION
# =========================================================

def extract_location_relationships(
    text,
    entities,
    source_type
):
    relationships = []

    persons = entities_of_type(
        entities,
        "PERSON"
    )

    locations = entities_of_type(
        entities,
        "LOCATION"
    )

    if (
        not persons
        or not locations
    ):
        return relationships

    lower = text.lower()

    seen_indicators = [
        "seen near",
        "seen at",
        "observed near",
        "observed at",
        "located near",
        "located at",
        "detected near",
        "detected at",
        "present near",
        "present at",
        "found near",
        "found at"
    ]

    visited_indicators = [
        "visited",
        "went to",
        "travelled to",
        "traveled to",
        "arrived at"
    ]

    if any(
        item in lower
        for item in seen_indicators
    ):

        relation = "SEEN_AT"
        confidence = 0.90

    elif any(
        item in lower
        for item in visited_indicators
    ):

        relation = "VISITED"
        confidence = 0.89

    else:

        return relationships

    for person in persons:

        location = nearest_entity(
            person,
            locations
        )

        if location:

            relationships.append(
                create_relationship(
                    person,
                    location,
                    relation,
                    text,
                    source_type,
                    confidence
                )
            )

    return relationships


# =========================================================
# BANK ACCOUNT
# =========================================================

def extract_bank_account_relationships(
    text,
    entities,
    source_type
):
    relationships = []

    persons = entities_of_type(
        entities,
        "PERSON"
    )

    accounts = entities_of_type(
        entities,
        "BANK_ACCOUNT"
    )

    if (
        not persons
        or not accounts
    ):
        return relationships

    lower = text.lower()

    ownership_indicators = [
        "belonged to",
        "belongs to",
        "belonging to",
        "account of",
        "held by",
        "registered to",
        "registered in the name of",
        "owned by"
    ]

    usage_indicators = [
        "used account",
        "using account",
        "through account",
        "from account"
    ]

    if any(
        indicator in lower
        for indicator
        in ownership_indicators
    ):

        relation = (
            "OWNS_ACCOUNT"
        )

        confidence = 0.94

    elif any(
        indicator in lower
        for indicator
        in usage_indicators
    ):

        relation = (
            "USED_ACCOUNT"
        )

        confidence = 0.89

    else:
        return relationships

    for account in accounts:

        person = nearest_entity(
            account,
            persons
        )

        if person:

            relationships.append(
                create_relationship(
                    person,
                    account,
                    relation,
                    text,
                    source_type,
                    confidence
                )
            )

    return relationships


# =========================================================
# MONEY TRANSFER
# =========================================================

def extract_financial_relationships(
    text,
    entities,
    source_type
):
    relationships = []

    lower = text.lower()

    indicators = [
        "transfer",
        "transferred",
        "sent money",
        "paid",
        "payment",
        "credited",
        "debited",
        "remitted"
    ]

    if not any(
        indicator in lower
        for indicator in indicators
    ):
        return relationships

    candidates = unique_entities([
        entity
        for entity in entities
        if entity["type"] in {
            "PERSON",
            "BANK_ACCOUNT",
            "ORGANISATION"
        }
    ])

    if len(candidates) < 2:
        return relationships

    to_match = re.search(
        r"\bto\b",
        lower
    )

    from_match = re.search(
        r"\bfrom\b",
        lower
    )

    source = None
    target = None

    if (
        from_match
        and to_match
        and from_match.start()
        < to_match.start()
    ):

        source = entity_after(
            candidates,
            from_match.end()
        )

        target = entity_after(
            candidates,
            to_match.end()
        )

    elif to_match:

        target = entity_after(
            candidates,
            to_match.end()
        )

        if target:

            before_target = [
                entity
                for entity in candidates
                if (
                    entity["end"]
                    <= target["start"]
                    and entity[
                        "text"
                    ].lower()
                    != target[
                        "text"
                    ].lower()
                )
            ]

            if before_target:

                source = max(
                    before_target,
                    key=lambda entity:
                        entity["end"]
                )

    if (
        source is None
        or target is None
    ):

        source = candidates[0]
        target = candidates[1]

    if (
        source
        and target
        and source["text"].lower()
        != target["text"].lower()
    ):

        relationships.append(
            create_relationship(
                source,
                target,
                "TRANSFERRED_MONEY_TO",
                text,
                source_type,
                0.95
            )
        )

    return relationships


# =========================================================
# ORGANISATION
# =========================================================

def extract_organisation_relationships(
    text,
    entities,
    source_type
):
    relationships = []

    persons = entities_of_type(
        entities,
        "PERSON"
    )

    organisations = (
        entities_of_type(
            entities,
            "ORGANISATION"
        )
    )

    if (
        not persons
        or not organisations
    ):
        return relationships

    lower = text.lower()

    work_terms = [
        "works for",
        "worked for",
        "working for",
        "employee of",
        "employed by"
    ]

    association_terms = [
        "associated with",
        "linked to",
        "member of",
        "connected to"
    ]

    if any(
        term in lower
        for term in work_terms
    ):

        relation = "WORKS_FOR"
        confidence = 0.92

    elif any(
        term in lower
        for term in association_terms
    ):

        relation = (
            "ASSOCIATED_WITH"
        )

        confidence = 0.85

    else:
        return relationships

    for person in persons:

        organisation = nearest_entity(
            person,
            organisations
        )

        if organisation:

            relationships.append(
                create_relationship(
                    person,
                    organisation,
                    relation,
                    text,
                    source_type,
                    confidence
                )
            )

    return relationships


# =========================================================
# SAME LOCATION
# =========================================================

def extract_same_location_relationships(
    text,
    entities,
    source_type
):
    relationships = []

    persons = unique_entities(
        entities_of_type(
            entities,
            "PERSON"
        )
    )

    if len(persons) < 2:
        return relationships

    lower = text.lower()

    indicators = [
        "same location",
        "same area",
        "same place",
        "same vicinity",
        "same geographic area",
        "same geographical area",
        "co-located",
        "colocated",
        "location overlap"
    ]

    if not any(
        item in lower
        for item in indicators
    ):
        return relationships

    observation_words = [
        "seen",
        "observed",
        "detected",
        "located",
        "recorded",
        "present",
        "found"
    ]

    if not any(
        word in lower
        for word in observation_words
    ):
        return relationships

    for first in range(
        len(persons)
    ):

        for second in range(
            first + 1,
            len(persons)
        ):

            relationships.append(
                create_relationship(
                    persons[first],
                    persons[second],
                    "SEEN_AT_SAME_LOCATION",
                    text,
                    source_type,
                    0.87
                )
            )

    return relationships


# =========================================================
# PERSON -> PERSON
# =========================================================

def extract_person_to_person_relationships(
    sentence,
    entities,
    source_type
):
    relationships = []

    persons = unique_entities(
        entities_of_type(
            entities,
            "PERSON"
        )
    )

    if len(persons) < 2:
        return relationships

    for token in sentence:

        lemma = (
            token.lemma_.lower()
        )

        if (
            lemma
            not in PERSON_RELATION_VERBS
        ):
            continue

        relationship = (
            PERSON_RELATION_VERBS[
                lemma
            ]
        )

        position = (
            token.idx
            - sentence.start_char
        )

        source = entity_before(
            persons,
            position
        )

        target = entity_after(
            persons,
            position
            + len(token.text)
        )

        if (
            source
            and target
            and source["text"].lower()
            != target["text"].lower()
        ):

            relationships.append(
                create_relationship(
                    source,
                    target,
                    relationship,
                    sentence.text,
                    source_type,
                    0.93
                )
            )

    return relationships


# =========================================================
# EVIDENCE REFERENCES
# =========================================================

def extract_evidence_relationships(
    text,
    entities,
    source_type
):
    relationships = []

    evidence_items = (
        entities_of_type(
            entities,
            "EVIDENCE"
        )
    )

    if not evidence_items:
        return relationships

    related_entities = [
        entity
        for entity in entities
        if entity["type"] in {
            "PERSON",
            "PHONE",
            "VEHICLE",
            "DEVICE",
            "BANK_ACCOUNT",
            "LOCATION",
            "ORGANISATION"
        }
    ]

    if not related_entities:
        return relationships

    for evidence in evidence_items:

        related = nearest_entity(
            evidence,
            related_entities
        )

        if related:

            relationships.append(
                create_relationship(
                    related,
                    evidence,
                    "SUPPORTED_BY_EVIDENCE",
                    text,
                    source_type,
                    0.80
                )
            )

    return relationships


# =========================================================
# CREATE STANDARD RELATIONSHIP
# =========================================================

def create_relationship(
    source,
    target,
    relationship,
    evidence,
    source_type,
    confidence
):
    return {
        "source":
            source["text"],

        "target":
            target["text"],

        "relationship":
            relationship,

        "confidence":
            confidence,

        "evidence":
            str(
                evidence or ""
            ).strip(),

        "source_type":
            source_type,

        "source_entity_type":
            source.get(
                "type",
                "UNKNOWN"
            ).lower(),

        "target_entity_type":
            target.get(
                "type",
                "UNKNOWN"
            ).lower()
    }


# =========================================================
# REMOVE DUPLICATES
# =========================================================

def remove_duplicates(
    relationships
):
    unique = []

    seen = set()

    for relationship in relationships:

        if not isinstance(
            relationship,
            dict
        ):
            continue

        source = str(
            relationship.get(
                "source",
                ""
            )
        ).strip()

        target = str(
            relationship.get(
                "target",
                ""
            )
        ).strip()

        relation = str(
            relationship.get(
                "relationship",
                ""
            )
        ).strip()

        if (
            not source
            or not target
            or not relation
        ):
            continue

        key = (
            source.lower(),
            target.lower(),
            relation.upper()
        )

        if key in seen:
            continue

        seen.add(
            key
        )

        unique.append(
            relationship
        )

    return unique