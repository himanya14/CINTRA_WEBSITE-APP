from __future__ import annotations

import base64
import hashlib
import os
import re
import secrets
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

BACKEND_ROOT = Path(__file__).resolve().parents[2]
SECURE_EVIDENCE_DIR = BACKEND_ROOT / "secure_storage" / "evidence"
SECURE_EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)


def _encryption_key() -> bytes:
    """Return a stable 32-byte AES key.

    Preferred: CINTRA_EVIDENCE_ENCRYPTION_KEY = urlsafe-base64 encoded 32 bytes.
    Demo fallback: derive a 32-byte key from CINTRA_SECRET_KEY/SECRET_KEY.
    """
    configured = os.getenv("CINTRA_EVIDENCE_ENCRYPTION_KEY", "").strip()
    if configured:
        try:
            key = base64.urlsafe_b64decode(configured.encode("ascii"))
        except Exception as exc:
            raise RuntimeError("CINTRA_EVIDENCE_ENCRYPTION_KEY is not valid urlsafe Base64") from exc
        if len(key) != 32:
            raise RuntimeError("CINTRA_EVIDENCE_ENCRYPTION_KEY must decode to exactly 32 bytes")
        return key

    secret = (
        os.getenv("CINTRA_SECRET_KEY")
        or os.getenv("SECRET_KEY")
        or "cintra-development-secret-change-before-production"
    )
    return hashlib.sha256(secret.encode("utf-8")).digest()


def safe_filename(name: str | None) -> str:
    raw = Path(name or "evidence.bin").name
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", raw).strip("._")
    return cleaned or "evidence.bin"


def calculate_sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def encrypt_evidence_bytes(data: bytes, evidence_code: str, original_filename: str | None) -> dict:
    if not data:
        raise ValueError("Evidence file is empty")

    original_name = safe_filename(original_filename)
    file_hash = calculate_sha256(data)
    nonce = secrets.token_bytes(12)
    aes = AESGCM(_encryption_key())
    ciphertext = aes.encrypt(nonce, data, evidence_code.encode("utf-8"))

    encrypted_name = f"{safe_filename(evidence_code)}_{secrets.token_hex(6)}.enc"
    encrypted_path = SECURE_EVIDENCE_DIR / encrypted_name

    # File format: 12-byte nonce + AES-GCM ciphertext/tag.
    encrypted_path.write_bytes(nonce + ciphertext)

    return {
        "sha256": file_hash,
        "size_bytes": len(data),
        "encrypted_path": str(encrypted_path),
        "original_filename": original_name,
        "algorithm": "AES-256-GCM",
    }


def decrypt_evidence_file(encrypted_path: str, evidence_code: str) -> bytes:
    path = Path(encrypted_path)
    payload = path.read_bytes()
    if len(payload) <= 12:
        raise ValueError("Encrypted evidence artifact is invalid")
    nonce, ciphertext = payload[:12], payload[12:]
    aes = AESGCM(_encryption_key())
    return aes.decrypt(nonce, ciphertext, evidence_code.encode("utf-8"))


def verify_encrypted_evidence(encrypted_path: str, evidence_code: str, expected_sha256: str) -> bool:
    try:
        data = decrypt_evidence_file(encrypted_path, evidence_code)
    except Exception:
        return False
    return calculate_sha256(data) == expected_sha256
