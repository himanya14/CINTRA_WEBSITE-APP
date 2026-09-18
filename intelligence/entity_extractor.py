import re

import spacy


# =========================================================
# NLP MODEL
# =========================================================

nlp = spacy.load("en_core_web_sm")


# =========================================================
# CONSTANTS
# =========================================================

EXCLUDED_ORGANISATIONS = {
    "INR",
    "RS",
    "USD",
    "EUR",
    "GBP",
    "CINTRA",
    "CCTV"
}


NON_PERSON_PHRASES = {
    "bank account",
    "phone number",
    "mobile number",
    "case diary",
    "police station",
    "investigating officer",
    "criminal conspiracy",
    "financial record",
    "call detail",
    "call detail record",
    "cctv camera",
    "cctv footage",
    "imei number"
}


# =========================================================
# BASIC HELPERS
# =========================================================

def add_unique(collection, value):
    if value is None:
        return

    value = str(value).strip()

    if not value:
        return

    existing = {
        str(item).strip().lower()
        for item in collection
    }

    if value.lower() not in existing:
        collection.append(value)


def remove_case_insensitive(collection, value):
    target = str(value).strip().lower()

    return [
        item
        for item in collection
        if str(item).strip().lower() != target
    ]


def only_digits(value):
    return re.sub(
        r"\D",
        "",
        str(value)
    )


def normalize_location(value):
    return re.sub(
        r"\s+",
        " ",
        str(value).strip()
    )


# =========================================================
# PERSON NAME RECOVERY
# =========================================================

def recover_person_names(text, entities):
    """
    Recover normal two-or-more-word capitalised names that
    spaCy may fail to classify as PERSON.

    Important:
    This does NOT automatically classify every capitalised
    phrase as a person. Known locations, organisations and
    generic investigation phrases are excluded.
    """

    pattern = (
        r"\b"
        r"[A-Z][a-z]+"
        r"(?:\s+[A-Z][a-z]+)+"
        r"\b"
    )

    candidates = re.findall(
        pattern,
        text
    )

    known_locations = {
        value.lower()
        for value in entities["locations"]
    }

    known_organisations = {
        value.lower()
        for value in entities["organisations"]
    }

    for candidate in candidates:
        candidate = candidate.strip()
        candidate_lower = candidate.lower()

        if candidate_lower in NON_PERSON_PHRASES:
            continue

        if candidate_lower in known_locations:
            continue

        if candidate_lower in known_organisations:
            continue

        add_unique(
            entities["persons"],
            candidate
        )


# =========================================================
# LOCATION CORRECTION
# =========================================================

def correct_location_classification(text, entities):
    """
    Correct location names that spaCy occasionally labels
    as ORG.

    We deliberately do NOT use generic rules such as:

        "to X"   -> location
        "from X" -> location
        "in X"   -> location

    because those can turn person names into locations.

    Instead, only an already detected organisation is
    reconsidered, and strong spatial language must occur
    directly before it.
    """

    organisations = list(
        entities["organisations"]
    )

    spatial_phrases = [
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
        "found at",
        "captured near",
        "captured at",
        "visited",
        "arrived at"
    ]

    for organisation in organisations:
        escaped = re.escape(
            organisation
        )

        is_spatial = False

        for phrase in spatial_phrases:
            pattern = (
                r"\b"
                + re.escape(phrase)
                + r"\s+"
                + escaped
                + r"\b"
            )

            if re.search(
                pattern,
                text,
                flags=re.IGNORECASE
            ):
                is_spatial = True
                break

        if not is_spatial:
            continue

        # Protect anything already confidently identified
        # as a person.
        is_person = any(
            organisation.lower()
            == person.lower()
            for person in entities["persons"]
        )

        if is_person:
            continue

        entities["organisations"] = (
            remove_case_insensitive(
                entities["organisations"],
                organisation
            )
        )

        add_unique(
            entities["locations"],
            organisation
        )


# =========================================================
# REMOVE PARTIAL PERSON NAMES
# =========================================================

def remove_partial_person_names(persons):
    cleaned = []

    for person in persons:
        person_lower = person.lower()

        partial = False

        for other in persons:
            if person_lower == other.lower():
                continue

            if len(person) >= len(other):
                continue

            if re.search(
                r"\b"
                + re.escape(person_lower)
                + r"\b",
                other.lower()
            ):
                partial = True
                break

        if not partial:
            add_unique(
                cleaned,
                person
            )

    return cleaned


# =========================================================
# MAIN
# =========================================================

def extract_entities(text):
    empty = {
        "persons": [],
        "phones": [],
        "vehicles": [],
        "locations": [],
        "organisations": [],
        "bank_accounts": [],
        "devices": [],
        "evidence": [],
        "dates_times": []
    }

    if not text or not text.strip():
        return empty

    entities = {
        key: []
        for key in empty
    }

    raw_dates_times = []

    doc = nlp(text)

    # =====================================================
    # 1. SPACY NER
    # =====================================================

    for ent in doc.ents:
        value = ent.text.strip()

        if not value:
            continue

        if ent.label_ == "PERSON":
            add_unique(
                entities["persons"],
                value
            )

        elif ent.label_ in {
            "GPE",
            "LOC",
            "FAC"
        }:
            add_unique(
                entities["locations"],
                value
            )

        elif ent.label_ == "ORG":
            if (
                value.upper()
                not in EXCLUDED_ORGANISATIONS
            ):
                add_unique(
                    entities["organisations"],
                    value
                )

        elif ent.label_ in {
            "DATE",
            "TIME"
        }:
            add_unique(
                raw_dates_times,
                value
            )

    # =====================================================
    # 2. PHONE NUMBERS
    # =====================================================

    phone_pattern = (
        r"(?<!\d)"
        r"(?:\+91[\s\-]?)?"
        r"[6-9]\d{9}"
        r"(?!\d)"
    )

    for phone in re.findall(
        phone_pattern,
        text
    ):
        add_unique(
            entities["phones"],
            phone.strip()
        )

    # =====================================================
    # 3. VEHICLE NUMBERS
    # =====================================================

    vehicle_pattern = (
        r"\b"
        r"[A-Z]{2}"
        r"[\s\-]?"
        r"\d{1,2}"
        r"[\s\-]?"
        r"[A-Z]{1,3}"
        r"[\s\-]?"
        r"\d{4}"
        r"\b"
    )

    for vehicle in re.findall(
        vehicle_pattern,
        text.upper()
    ):
        vehicle = re.sub(
            r"[\s\-]",
            "",
            vehicle
        )

        add_unique(
            entities["vehicles"],
            vehicle
        )

    # =====================================================
    # 4. STRUCTURED LOCATIONS
    # =====================================================

    location_patterns = [
        r"\bSector\s+\d+[A-Za-z]?\b",
        r"\bBlock\s+[A-Za-z0-9]+\b",
        r"\bArea\s+\d+[A-Za-z]?\b",
        r"\bPhase\s+\d+[A-Za-z]?\b"
    ]

    for pattern in location_patterns:
        matches = re.findall(
            pattern,
            text,
            flags=re.IGNORECASE
        )

        for location in matches:
            add_unique(
                entities["locations"],
                normalize_location(
                    location
                )
            )

    # =====================================================
    # 5. BANK ACCOUNTS
    # =====================================================

    account_pattern = (
        r"(?:bank\s+account|account|a/c)"
        r"\s*"
        r"(?:no\.?|number)?"
        r"\s*[:\-]?\s*"
        r"([0-9]{9,18})"
    )

    phone_numbers = {
        only_digits(phone)
        for phone in entities["phones"]
    }

    for account in re.findall(
        account_pattern,
        text,
        flags=re.IGNORECASE
    ):
        account = account.strip()

        if account in phone_numbers:
            continue

        add_unique(
            entities["bank_accounts"],
            account
        )

    # =====================================================
    # 6. IMEI
    # =====================================================

    imei_patterns = [
        (
            r"\bIMEI"
            r"\s*(?:number|no\.?)?"
            r"\s*[:\-]?\s*"
            r"(\d{15})"
            r"\b"
        ),
        (
            r"\bdevice\s+IMEI"
            r"\s*(?:number|no\.?)?"
            r"\s*[:\-]?\s*"
            r"(\d{15})"
            r"\b"
        )
    ]

    for pattern in imei_patterns:
        for imei in re.findall(
            pattern,
            text,
            flags=re.IGNORECASE
        ):
            add_unique(
                entities["devices"],
                f"IMEI {imei}"
            )

    # =====================================================
    # 7. CCTV IDS
    # =====================================================

    cctv_pattern = (
        r"\bCCTV"
        r"\s*(?:CAM|CAMERA)?"
        r"\s*[-:#]?\s*"
        r"([A-Za-z0-9][A-Za-z0-9_-]{0,20})"
        r"\b"
    )

    invalid_identifiers = {
        "footage",
        "camera",
        "recording",
        "video",
        "images",
        "image",
        "captured",
        "shows",
        "showed"
    }

    for identifier in re.findall(
        cctv_pattern,
        text,
        flags=re.IGNORECASE
    ):
        identifier = identifier.strip()

        if (
            not identifier
            or identifier.lower()
            in invalid_identifiers
        ):
            continue

        add_unique(
            entities["devices"],
            f"CCTV {identifier.upper()}"
        )

    # CCTV itself is a technology/device descriptor,
    # not an organisation.
    entities["organisations"] = [
        organisation
        for organisation
        in entities["organisations"]
        if organisation.strip().upper()
        != "CCTV"
    ]

    # =====================================================
    # 8. OTHER DEVICE IDS
    # =====================================================

    device_pattern = (
        r"\bdevice\s*(?:id)?"
        r"\s*[:\-]\s*"
        r"([A-Za-z0-9_-]{4,40})"
        r"\b"
    )

    for device_id in re.findall(
        device_pattern,
        text,
        flags=re.IGNORECASE
    ):
        add_unique(
            entities["devices"],
            device_id
        )

    # =====================================================
    # 9. EVIDENCE IDS
    # =====================================================

    evidence_patterns = [
        r"\b(EVD[-_A-Za-z0-9]+)\b",
        (
            r"\bevidence"
            r"\s*(?:id|no\.?|number)"
            r"\s*[:\-]?\s*"
            r"([A-Za-z0-9_-]+)"
            r"\b"
        )
    ]

    for pattern in evidence_patterns:
        for evidence_id in re.findall(
            pattern,
            text,
            flags=re.IGNORECASE
        ):
            add_unique(
                entities["evidence"],
                evidence_id.upper()
            )

    # =====================================================
    # 10. PERSON RECOVERY
    # =====================================================

    recover_person_names(
        text,
        entities
    )

    entities["persons"] = (
        remove_partial_person_names(
            entities["persons"]
        )
    )

    # =====================================================
    # 11. LOCATION CORRECTION
    # =====================================================

    correct_location_classification(
        text,
        entities
    )

    # =====================================================
    # 12. CROSS-CATEGORY PERSON PROTECTION
    # =====================================================

    person_names = {
        person.lower()
        for person in entities["persons"]
    }

    # If something is already identified as a person,
    # never keep the same value as a location or org.
    entities["locations"] = [
        location
        for location in entities["locations"]
        if location.lower()
        not in person_names
    ]

    entities["organisations"] = [
        organisation
        for organisation
        in entities["organisations"]
        if (
            organisation.lower()
            not in person_names
            and organisation
            .strip()
            .upper()
            not in EXCLUDED_ORGANISATIONS
        )
    ]

    # =====================================================
    # 13. DATE/TIME CLEANUP
    # =====================================================

    protected_numbers = set()

    for phone in entities["phones"]:
        digits = only_digits(phone)

        if digits:
            protected_numbers.add(
                digits
            )

    for account in entities[
        "bank_accounts"
    ]:
        digits = only_digits(
            account
        )

        if digits:
            protected_numbers.add(
                digits
            )

    for device in entities["devices"]:
        digits = only_digits(
            device
        )

        if digits:
            protected_numbers.add(
                digits
            )

    for candidate in raw_dates_times:
        digits = only_digits(
            candidate
        )

        if (
            digits
            and digits
            in protected_numbers
        ):
            continue

        add_unique(
            entities["dates_times"],
            candidate
        )

    # =====================================================
    # 14. FINAL DEDUPLICATION
    # =====================================================

    for category in entities:
        cleaned = []

        for value in entities[
            category
        ]:
            add_unique(
                cleaned,
                value
            )

        entities[category] = (
            cleaned
        )

    return entities