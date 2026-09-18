from datetime import datetime, timedelta
import hashlib
import secrets

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
)

from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas

from app.utils.security import (
    verify_password,
    hash_password,
    create_access_token,
    get_current_officer,
    decode_access_token,
    oauth2_scheme,
)

from app.services.totp_service import (
    generate_mfa_secret,
    get_provisioning_uri,
    verify_totp,
    generate_challenge_token,
)

from app.services.audit_service import (
    create_audit_log,
)

from app.services.device_service import (
    normalise_device_id,
)


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


MAX_FAILED_ATTEMPTS = 5
LOCK_MINUTES = 15
MFA_CHALLENGE_MINUTES = 5
SESSION_DAYS = 7


# ============================================================
# HELPERS
# ============================================================


def utcnow():
    return datetime.utcnow()


def client_ip(request: Request):
    if request.client:
        return request.client.host

    return None


def create_refresh_token():
    return secrets.token_urlsafe(48)


def hash_token(token: str):
    return hashlib.sha256(
        token.encode("utf-8")
    ).hexdigest()


def officer_payload(officer):
    return {
        "officer_id": officer.officer_id,
        "name": officer.name,
        "designation": officer.designation,
        "police_station": officer.police_station,
        "system_role": officer.system_role,
        "mfa_enabled": officer.mfa_enabled,
    }


def create_authenticated_session(
    *,
    db: Session,
    officer,
    request: Request,
    device_id=None,
):
    session_id = secrets.token_urlsafe(32)
    refresh_token = create_refresh_token()

    session = models.OfficerSession(
        session_id=session_id,
        officer_id=officer.officer_id,
        device_id=device_id,
        refresh_token_hash=hash_token(
            refresh_token
        ),
        ip_address=client_ip(request),
        user_agent=request.headers.get(
            "user-agent"
        ),
        is_active=True,
        expires_at=(
            utcnow()
            + timedelta(days=SESSION_DAYS)
        ),
        last_activity_at=utcnow(),
    )

    db.add(session)

    officer.last_login_at = utcnow()
    officer.failed_login_attempts = 0
    officer.locked_until = None

    db.commit()

    access_token = create_access_token({
        "sub": officer.officer_id,
        "role": officer.system_role,
        "session_id": session_id,
    })

    create_audit_log(
        db,
        officer_id=officer.officer_id,
        action="LOGIN_SUCCESS",
        resource_type="AUTH",
        description=(
            "Officer authentication completed"
        ),
        ip_address=client_ip(request),
        device_id=device_id,
        success=True,
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "officer": officer_payload(officer),
    }


def get_current_session(
    *,
    token: str,
    db: Session,
):
    payload = decode_access_token(token)

    session_id = payload.get("session_id")

    if not session_id:
        raise HTTPException(
            status_code=401,
            detail="Authentication session not found",
        )

    session = (
        db.query(models.OfficerSession)
        .filter(
            models.OfficerSession.session_id
            == session_id
        )
        .first()
    )

    if not session:
        raise HTTPException(
            status_code=401,
            detail="Authentication session not found",
        )

    return session


# ============================================================
# LOGIN — PASSWORD STAGE
# ============================================================


@router.post("/login")
def login_officer(
    login: schemas.OfficerLogin,
    request: Request,
    db: Session = Depends(get_db),
):
    officer_id = login.officer_id.strip()

    officer = (
        db.query(models.Officer)
        .filter(
            models.Officer.officer_id
            == officer_id
        )
        .first()
    )

    if not officer:
        create_audit_log(
            db,
            officer_id=officer_id,
            action="LOGIN_FAILED",
            resource_type="AUTH",
            description="Unknown Officer ID",
            ip_address=client_ip(request),
            success=False,
        )

        raise HTTPException(
            status_code=401,
            detail="Invalid Officer ID or password",
        )

    if (
        officer.locked_until
        and officer.locked_until > utcnow()
    ):
        create_audit_log(
            db,
            officer_id=officer.officer_id,
            action="LOGIN_BLOCKED",
            resource_type="AUTH",
            description=(
                "Login attempt while account "
                "was temporarily locked"
            ),
            ip_address=client_ip(request),
            success=False,
        )

        raise HTTPException(
            status_code=423,
            detail=(
                "Account temporarily locked. "
                "Try again later."
            ),
        )

    if officer.status != "Active":
        create_audit_log(
            db,
            officer_id=officer.officer_id,
            action="LOGIN_BLOCKED",
            resource_type="AUTH",
            description="Inactive officer account",
            ip_address=client_ip(request),
            success=False,
        )

        raise HTTPException(
            status_code=403,
            detail="Officer account is inactive",
        )

    if not verify_password(
        login.password,
        officer.hashed_password,
    ):
        officer.failed_login_attempts += 1

        if (
            officer.failed_login_attempts
            >= MAX_FAILED_ATTEMPTS
        ):
            officer.locked_until = (
                utcnow()
                + timedelta(
                    minutes=LOCK_MINUTES
                )
            )

            officer.failed_login_attempts = 0

        db.commit()

        create_audit_log(
            db,
            officer_id=officer.officer_id,
            action="LOGIN_FAILED",
            resource_type="AUTH",
            description="Invalid password",
            ip_address=client_ip(request),
            success=False,
        )

        raise HTTPException(
            status_code=401,
            detail="Invalid Officer ID or password",
        )

    officer.failed_login_attempts = 0
    officer.locked_until = None

    challenge_token = (
        generate_challenge_token()
    )

    challenge = models.MFAChallenge(
        challenge_token=challenge_token,
        officer_id=officer.officer_id,
        expires_at=(
            utcnow()
            + timedelta(
                minutes=MFA_CHALLENGE_MINUTES
            )
        ),
        used=False,
    )

    db.add(challenge)

    # --------------------------------------------------------
    # FIRST LOGIN — AUTHENTICATOR SETUP
    # --------------------------------------------------------

    if not officer.mfa_enabled:
        if not officer.mfa_secret:
            officer.mfa_secret = (
                generate_mfa_secret()
            )

        db.commit()

        return {
            "requires_mfa": True,
            "mfa_setup_required": True,
            "challenge_token": challenge_token,
            "mfa_secret": officer.mfa_secret,
            "provisioning_uri": (
                get_provisioning_uri(
                    officer.mfa_secret,
                    officer.officer_id,
                )
            ),
            "officer": officer_payload(
                officer
            ),
        }

    db.commit()

    # --------------------------------------------------------
    # NORMAL MFA LOGIN
    # --------------------------------------------------------

    return {
        "requires_mfa": True,
        "mfa_setup_required": False,
        "challenge_token": challenge_token,
        "officer": officer_payload(officer),
    }


# ============================================================
# MFA VERIFY
# ============================================================


@router.post("/verify-mfa")
def verify_mfa(
    payload: schemas.MFAVerifyRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    challenge = (
        db.query(models.MFAChallenge)
        .filter(
            models.MFAChallenge.challenge_token
            == payload.challenge_token
        )
        .first()
    )

    if not challenge:
        raise HTTPException(
            status_code=401,
            detail="Invalid MFA challenge",
        )

    if challenge.used:
        raise HTTPException(
            status_code=401,
            detail="MFA challenge already used",
        )

    if challenge.expires_at < utcnow():
        raise HTTPException(
            status_code=401,
            detail="MFA challenge expired",
        )

    officer = (
        db.query(models.Officer)
        .filter(
            models.Officer.officer_id
            == challenge.officer_id
        )
        .first()
    )

    if not officer:
        raise HTTPException(
            status_code=401,
            detail="Officer not found",
        )

    if officer.status != "Active":
        raise HTTPException(
            status_code=403,
            detail="Officer account is inactive",
        )

    if not officer.mfa_secret:
        raise HTTPException(
            status_code=401,
            detail="MFA configuration unavailable",
        )

    if not verify_totp(
        officer.mfa_secret,
        payload.code,
    ):
        create_audit_log(
            db,
            officer_id=officer.officer_id,
            action="MFA_FAILED",
            resource_type="AUTH",
            description=(
                "Incorrect authenticator code"
            ),
            ip_address=client_ip(request),
            device_id=payload.device_id,
            success=False,
        )

        raise HTTPException(
            status_code=401,
            detail="Invalid authenticator code",
        )

    challenge.used = True

    if not officer.mfa_enabled:
        officer.mfa_enabled = True

    db.commit()

    return create_authenticated_session(
        db=db,
        officer=officer,
        request=request,
        device_id=normalise_device_id(
            payload.device_id
        ),
    )


# ============================================================
# REFRESH TOKEN
# ============================================================


@router.post("/refresh")
def refresh_access_token(
    payload: schemas.RefreshTokenRequest,
    db: Session = Depends(get_db),
):
    token_hash = hash_token(
        payload.refresh_token
    )

    session = (
        db.query(models.OfficerSession)
        .filter(
            models.OfficerSession.refresh_token_hash
            == token_hash,
            models.OfficerSession.is_active
            == True,
        )
        .first()
    )

    if not session:
        raise HTTPException(
            status_code=401,
            detail="Invalid refresh token",
        )

    if (
        session.expires_at
        and session.expires_at < utcnow()
    ):
        session.is_active = False
        session.revoked_at = utcnow()

        db.commit()

        raise HTTPException(
            status_code=401,
            detail="Session expired",
        )

    officer = (
        db.query(models.Officer)
        .filter(
            models.Officer.officer_id
            == session.officer_id
        )
        .first()
    )

    if (
        not officer
        or officer.status != "Active"
    ):
        session.is_active = False
        session.revoked_at = utcnow()

        db.commit()

        raise HTTPException(
            status_code=401,
            detail="Officer account unavailable",
        )

    session.last_activity_at = utcnow()

    db.commit()

    access_token = create_access_token({
        "sub": officer.officer_id,
        "role": officer.system_role,
        "session_id": session.session_id,
    })

    return {
        "access_token": access_token,
        "token_type": "bearer",
    }


# ============================================================
# CURRENT OFFICER
# ============================================================


@router.get(
    "/me",
    response_model=schemas.OfficerResponse,
)
def get_me(
    current_officer=Depends(
        get_current_officer
    ),
):
    return current_officer


# ============================================================
# CHANGE PASSWORD
# ============================================================


@router.post("/change-password")
def change_password(
    payload: schemas.PasswordChangeRequest,
    request: Request,
    current_officer=Depends(
        get_current_officer
    ),
    db: Session = Depends(get_db),
):
    if not verify_password(
        payload.current_password,
        current_officer.hashed_password,
    ):
        create_audit_log(
            db,
            officer_id=current_officer.officer_id,
            action="PASSWORD_CHANGE_FAILED",
            resource_type="AUTH",
            description=(
                "Incorrect current password"
            ),
            ip_address=client_ip(request),
            success=False,
        )

        raise HTTPException(
            status_code=400,
            detail="Current password is incorrect",
        )

    if len(payload.new_password) < 10:
        raise HTTPException(
            status_code=400,
            detail=(
                "New password must contain "
                "at least 10 characters"
            ),
        )

    if verify_password(
        payload.new_password,
        current_officer.hashed_password,
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "New password must be different "
                "from the current password"
            ),
        )

    current_officer.hashed_password = (
        hash_password(
            payload.new_password
        )
    )

    current_officer.password_changed_at = (
        utcnow()
    )

    sessions = (
        db.query(models.OfficerSession)
        .filter(
            models.OfficerSession.officer_id
            == current_officer.officer_id,
            models.OfficerSession.is_active
            == True,
        )
        .all()
    )

    revoked_at = utcnow()

    for session in sessions:
        session.is_active = False
        session.revoked_at = revoked_at

    db.commit()

    create_audit_log(
        db,
        officer_id=current_officer.officer_id,
        action="PASSWORD_CHANGED",
        resource_type="AUTH",
        description=(
            "Password changed; "
            "existing sessions revoked"
        ),
        ip_address=client_ip(request),
    )

    return {
        "message": (
            "Password changed successfully. "
            "Please sign in again."
        )
    }


# ============================================================
# LOGOUT CURRENT SESSION
# ============================================================


@router.post("/logout")
def logout_current_session(
    request: Request,
    token: str = Depends(oauth2_scheme),
    current_officer=Depends(
        get_current_officer
    ),
    db: Session = Depends(get_db),
):
    session = get_current_session(
        token=token,
        db=db,
    )

    if (
        session.officer_id
        != current_officer.officer_id
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication session",
        )

    if not session.is_active:
        raise HTTPException(
            status_code=401,
            detail="Session already revoked",
        )

    session.is_active = False
    session.revoked_at = utcnow()

    db.commit()

    create_audit_log(
        db,
        officer_id=current_officer.officer_id,
        action="LOGOUT",
        resource_type="AUTH",
        resource_id=session.session_id,
        description=(
            "Current officer session revoked"
        ),
        ip_address=client_ip(request),
        device_id=session.device_id,
    )

    return {
        "message": "Signed out successfully"
    }


# ============================================================
# LOGOUT ALL SESSIONS
# ============================================================


@router.post("/logout-all")
def logout_all_sessions(
    request: Request,
    current_officer=Depends(
        get_current_officer
    ),
    db: Session = Depends(get_db),
):
    sessions = (
        db.query(models.OfficerSession)
        .filter(
            models.OfficerSession.officer_id
            == current_officer.officer_id,
            models.OfficerSession.is_active
            == True,
        )
        .all()
    )

    revoked_at = utcnow()

    for session in sessions:
        session.is_active = False
        session.revoked_at = revoked_at

    db.commit()

    create_audit_log(
        db,
        officer_id=current_officer.officer_id,
        action="LOGOUT_ALL",
        resource_type="AUTH",
        description=(
            f"{len(sessions)} active "
            "session(s) revoked"
        ),
        ip_address=client_ip(request),
    )

    return {
        "message": (
            "All sessions have been revoked"
        ),
        "revoked_sessions": len(sessions),
    }