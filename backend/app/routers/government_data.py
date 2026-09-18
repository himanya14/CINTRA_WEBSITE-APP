from pathlib import Path
from typing import Optional
import json

from fastapi import APIRouter, Depends, HTTPException

from app.services.government_data_service import (
    get_state_crime_data,
    get_cyber_crime_data,
)
from app.utils.security import get_current_officer


router = APIRouter(
    prefix="/government-data",
    tags=["Government Data"]
)


# =========================================================
# LOCAL GOVERNMENT DATA DIRECTORY
# =========================================================

BACKEND_ROOT = Path(__file__).resolve().parents[2]

GOVERNMENT_DATA_DIR = (
    BACKEND_ROOT
    / "data"
    / "government"
)

INDIA_BOUNDARY_FILE = (
    GOVERNMENT_DATA_DIR
    / "india_states.geojson"
)


# =========================================================
# STATE CRIME
# =========================================================

@router.get("/state-crime")
def state_crime_statistics(
    state: Optional[str] = None,
    current_officer=Depends(get_current_officer)
):
    try:
        records = get_state_crime_data(
            state=state
        )

        return {
            "source": "Open Government Data Platform India / NCRB",
            "dataset": "State/UT-wise IPC Crimes from 2020 to 2022",
            "data_type": "Official Aggregate Government Data",
            "count": len(records),
            "records": records
        }

    except FileNotFoundError as error:
        raise HTTPException(
            status_code=500,
            detail=str(error)
        )


# =========================================================
# CYBER CRIME
# =========================================================

@router.get("/cyber-crime")
def cyber_crime_statistics(
    crime_head: Optional[str] = None,
    current_officer=Depends(get_current_officer)
):
    try:
        records = get_cyber_crime_data(
            crime_head=crime_head
        )

        return {
            "source": "Open Government Data Platform India / NCRB",
            "dataset": "Crime Head-wise Police Disposal of Cyber Crime Cases during 2023",
            "data_type": "Official Aggregate Government Data",
            "count": len(records),
            "records": records
        }

    except FileNotFoundError as error:
        raise HTTPException(
            status_code=500,
            detail=str(error)
        )


# =========================================================
# INDIA STATE / UT BOUNDARIES
# =========================================================

@router.get("/india-boundaries")
def india_state_boundaries(
    current_officer=Depends(get_current_officer)
):
    try:
        if not INDIA_BOUNDARY_FILE.exists():
            raise HTTPException(
                status_code=500,
                detail=(
                    "India boundary GeoJSON file was not found at "
                    f"{INDIA_BOUNDARY_FILE}"
                )
            )

        with INDIA_BOUNDARY_FILE.open(
            "r",
            encoding="utf-8"
        ) as file:
            geojson = json.load(file)

        if not isinstance(geojson, dict):
            raise HTTPException(
                status_code=500,
                detail="Invalid India boundary GeoJSON."
            )

        if geojson.get("type") != "FeatureCollection":
            raise HTTPException(
                status_code=500,
                detail=(
                    "India boundary file is not a "
                    "GeoJSON FeatureCollection."
                )
            )

        features = geojson.get("features")

        if not isinstance(features, list):
            raise HTTPException(
                status_code=500,
                detail=(
                    "India boundary GeoJSON does not "
                    "contain a valid features array."
                )
            )

        return {
            "source": "CINTRA Local Geographic Reference",
            "geometry_source": (
                "India States and UTs Geospatial Resource"
            ),
            "data_type": "Administrative Boundary Geometry",
            "count": len(features),
            "geojson": geojson
        }

    except HTTPException:
        raise

    except json.JSONDecodeError as error:
        raise HTTPException(
            status_code=500,
            detail=(
                "India boundary GeoJSON could not be parsed. "
                f"{str(error)}"
            )
        )

    except OSError as error:
        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to read India boundary GeoJSON. "
                f"{str(error)}"
            )
        )