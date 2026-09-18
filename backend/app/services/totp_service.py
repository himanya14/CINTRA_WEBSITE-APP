import pyotp
import secrets


ISSUER_NAME = "CINTRA"


def generate_mfa_secret() -> str:
    return pyotp.random_base32()


def get_totp(secret: str):
    return pyotp.TOTP(
        secret,
        interval=30,
        digits=6
    )


def verify_totp(
    secret: str,
    code: str
) -> bool:
    if not secret or not code:
        return False

    return get_totp(secret).verify(
        str(code).strip(),
        valid_window=1
    )


def get_provisioning_uri(
    secret: str,
    officer_id: str
) -> str:
    return get_totp(secret).provisioning_uri(
        name=officer_id,
        issuer_name=ISSUER_NAME
    )


def generate_challenge_token() -> str:
    return secrets.token_urlsafe(32)