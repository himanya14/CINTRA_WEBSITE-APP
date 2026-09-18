from __future__ import annotations

import os
import httpx


def _enabled() -> bool:
    return os.getenv("FABRIC_ENABLED", "false").strip().lower() in {"1", "true", "yes", "on"}


def record_custody_event(*, evidence_id: str, event_id: str, action: str, actor_officer_id: str | None,
                         from_custodian: str | None, to_custodian: str | None,
                         reason: str | None, file_sha256: str, timestamp: str) -> dict:
    """Record a custody event via the optional Node/Fabric Gateway.

    This never fakes a ledger success: disabled => DISABLED, gateway error => FAILED,
    confirmed gateway transaction => RECORDED.
    """
    if not _enabled():
        return {"blockchain_status": "DISABLED", "transaction_id": None, "error": None}

    base_url = os.getenv("FABRIC_GATEWAY_URL", "http://127.0.0.1:4100").rstrip("/")
    timeout = float(os.getenv("FABRIC_GATEWAY_TIMEOUT_SECONDS", "8"))
    payload = {
        "evidence_id": evidence_id,
        "event_id": event_id,
        "action": action,
        "actor_officer_id": actor_officer_id,
        "from_custodian": from_custodian,
        "to_custodian": to_custodian,
        "reason": reason,
        "file_sha256": file_sha256,
        "timestamp": timestamp,
    }

    try:
        response = httpx.post(f"{base_url}/api/fabric/custody", json=payload, timeout=timeout)
        data = response.json()
    except Exception as exc:
        return {"blockchain_status": "FAILED", "transaction_id": None, "error": str(exc)}

    if response.status_code >= 400 or not data.get("success"):
        return {
            "blockchain_status": "FAILED",
            "transaction_id": data.get("transaction_id"),
            "error": data.get("error") or data.get("message") or f"HTTP {response.status_code}",
        }

    tx_id = data.get("transaction_id")
    if not tx_id:
        return {"blockchain_status": "FAILED", "transaction_id": None, "error": "Gateway returned no transaction_id"}

    return {"blockchain_status": "RECORDED", "transaction_id": tx_id, "error": None}
