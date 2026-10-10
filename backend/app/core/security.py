import hashlib
import hmac
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple, Union
import bcrypt
from jose import JWTError, jwt

from app.core.config import settings

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15  # 15 min access token
REFRESH_TOKEN_EXPIRE_DAYS = 7    # 7 days refresh token


def validate_password_strength(password: str) -> Tuple[bool, Optional[str]]:
    """Enforces: min 10 chars, at least one digit."""
    if len(password) < 10:
        return False, "Password must be at least 10 characters long"
    if not re.search(r"\d", password):
        return False, "Password must contain at least one numerical digit (0-9)"
    return True, None


def get_password_hash(password: str) -> str:
    """Hashes a password using bcrypt with automatic truncation to 72 bytes."""
    pwd_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies plain password against bcrypt hash using constant-time comparison."""
    try:
        pwd_bytes = plain_password.encode("utf-8")[:72]
        hashed_bytes = hashed_password.encode("utf-8")
        return bcrypt.checkpw(pwd_bytes, hashed_bytes)
    except Exception:
        return False


def hash_token(token: str) -> str:
    """Creates a SHA-256 digest of a token for secure database storage."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Creates a JWT access token expiring in 15 minutes by default."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({
        "exp": expire,
        "iat": now,
        "type": "access",
    })
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(user_id: str) -> Tuple[str, str, datetime]:
    """
    Generates a cryptographically strong refresh token.
    Returns: (raw_token, token_hash, expires_at)
    """
    raw_token = secrets.token_urlsafe(48)
    token_hash = hash_token(raw_token)
    expires_at = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    return raw_token, token_hash, expires_at


def decode_access_token(token: str) -> Dict[str, Any]:
    """Decodes and validates JWT access token signature and expiration."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "access":
            raise JWTError("Invalid token type")
        return payload
    except JWTError as err:
        raise err
