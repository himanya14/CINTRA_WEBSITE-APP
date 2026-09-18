from datetime import datetime, timedelta, timezone
import os

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.database import get_db
from app import models


SECRET_KEY = (
    os.getenv("CINTRA_SECRET_KEY")
    or os.getenv("SECRET_KEY")
    or "cintra-development-secret-change-before-production"
)

ALGORITHM = "HS256"

ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv(
        "CINTRA_ACCESS_TOKEN_MINUTES",
        "60"
    )
)

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/auth/login"
)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(
    plain_password: str,
    hashed_password: str
) -> bool:
    return pwd_context.verify(
        plain_password,
        hashed_password
    )


def create_access_token(
    data,
    expires_delta=None
):
    if isinstance(data, str):
        payload = {
            "sub": data
        }
    else:
        payload = data.copy()

    expire = (
        datetime.now(timezone.utc)
        + (
            expires_delta
            or timedelta(
                minutes=
                ACCESS_TOKEN_EXPIRE_MINUTES
            )
        )
    )

    payload.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "access"
    })

    return jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM
    )


def decode_access_token(token: str):
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        if payload.get("type") != "access":
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication token"
            )

        return payload

    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=(
                "Invalid or expired "
                "authentication token"
            ),
            headers={
                "WWW-Authenticate": "Bearer"
            }
        )


def get_current_officer(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    payload = decode_access_token(token)

    officer_id = payload.get("sub")

    if not officer_id:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token"
        )

    officer = (
        db.query(models.Officer)
        .filter(
            models.Officer.officer_id
            == officer_id
        )
        .first()
    )

    if not officer:
        raise HTTPException(
            status_code=401,
            detail="Officer account not found"
        )

    if officer.status != "Active":
        raise HTTPException(
            status_code=403,
            detail="Officer account is not active"
        )

    session_id = payload.get("session_id")

    if session_id:
        session = (
            db.query(models.OfficerSession)
            .filter(
                models.OfficerSession.session_id
                == session_id,
                models.OfficerSession.is_active
                == True
            )
            .first()
        )

        if not session:
            raise HTTPException(
                status_code=401,
                detail="Session has been revoked"
            )

    return officer