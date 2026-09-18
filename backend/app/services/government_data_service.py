import csv
from pathlib import Path
from typing import List, Dict, Any, Optional


BASE_DIR = Path(__file__).resolve().parents[2]

GOVERNMENT_DATA_DIR = (
    BASE_DIR / "data" / "government"
)

IPC_DATASET = (
    GOVERNMENT_DATA_DIR / "NCRB_Table_1A.1.csv"
)

CYBER_DATASET = (
    GOVERNMENT_DATA_DIR / "NCRB_CII_2023_Table_9A.4_0.csv"
)


def read_csv_file(
    file_path: Path
) -> List[Dict[str, Any]]:

    if not file_path.exists():
        raise FileNotFoundError(
            f"Government dataset not found: {file_path}"
        )

    with open(
        file_path,
        mode="r",
        encoding="utf-8-sig",
        newline=""
    ) as file:

        reader = csv.DictReader(file)

        return list(reader)


def get_state_crime_data(
    state: Optional[str] = None
) -> List[Dict[str, Any]]:

    records = read_csv_file(
        IPC_DATASET
    )

    if not state:
        return records

    state_lower = state.strip().lower()

    return [
        record
        for record in records
        if record.get(
            "State/UT", ""
        ).strip().lower() == state_lower
    ]


def get_cyber_crime_data(
    crime_head: Optional[str] = None
) -> List[Dict[str, Any]]:

    records = read_csv_file(
        CYBER_DATASET
    )

    if not crime_head:
        return records

    query = crime_head.strip().lower()

    filtered_records = []

    for record in records:

        searchable_text = " ".join(
            str(value)
            for value in record.values()
        ).lower()

        if query in searchable_text:
            filtered_records.append(
                record
            )

    return filtered_records