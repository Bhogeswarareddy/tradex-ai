from typing import Callable, List, Optional
from uuid import UUID
from fastapi import Depends, Header, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.db import get_db
from app.core.errors import AuthenticationError, PermissionDeniedError
from app.core.security import decode_access_token
from app.models.identity import Buyer, Company, Supplier, User

security_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Dependency that decodes the Bearer JWT and loads the current active user."""
    if not credentials or not credentials.credentials:
        raise AuthenticationError("Authentication token is required")

    token = credentials.credentials
    try:
        payload = decode_access_token(token)
        user_id_str: Optional[str] = payload.get("sub")
        if not user_id_str:
            raise AuthenticationError("Invalid token payload")
        user_id = UUID(user_id_str)
    except (JWTError, ValueError):
        raise AuthenticationError("Invalid or expired authentication token")

    stmt = (
        select(User)
        .where(User.id == user_id, User.deleted_at.is_(None))
        .options(
            selectinload(User.buyers).selectinload(Buyer.company),
            selectinload(User.suppliers).selectinload(Supplier.company),
        )
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise AuthenticationError("User account not found")

    if not user.is_active:
        raise PermissionDeniedError("User account is inactive or disabled")

    return user


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Optional user dependency returning None if not authenticated."""
    if not credentials or not credentials.credentials:
        return None
    try:
        payload = decode_access_token(credentials.credentials)
        user_id_str = payload.get("sub")
        if not user_id_str:
            return None
        user_id = UUID(user_id_str)
        stmt = select(User).where(User.id == user_id, User.deleted_at.is_(None))
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    except Exception:
        return None


from app.core.permissions import require_roles

def require_role(*allowed_roles: str) -> Callable:
    """Dependency factory restricting route access to specified roles (alias to require_roles)."""
    return require_roles(*allowed_roles)
