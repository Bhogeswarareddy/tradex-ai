from typing import Any, Dict
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_role
from app.core.db import get_db
from app.core.errors import AuthenticationError, ValidationError
from app.core.security import get_password_hash, verify_password
from app.models.identity import User
from app.schemas.auth import ChangePasswordRequest, UserResponse, UserUpdateRequest

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/status")
async def users_status():
    return {"module": "users", "status": "initialized"}


def _to_user_response(user: User) -> UserResponse:
    company_name = None
    company_id = None
    if user.role == "buyer" and user.buyers:
        company_name = user.buyers[0].company.name if user.buyers[0].company else None
        company_id = user.buyers[0].company_id
    elif user.role == "supplier" and user.suppliers:
        company_name = user.suppliers[0].company.name if user.suppliers[0].company else None
        company_id = user.suppliers[0].company_id

    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        email_verified=user.email_verified,
        company_name=company_name,
        company_id=company_id,
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(current_user: User = Depends(get_current_user)) -> UserResponse:
    """Returns profile and company details of currently authenticated user."""
    return _to_user_response(current_user)


@router.patch("/me", response_model=UserResponse)
async def update_current_user_profile(
    payload: UserUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Updates contact information of current user."""
    if payload.full_name is not None:
        current_user.full_name = payload.full_name

    if payload.company_name is not None:
        if current_user.role == "buyer" and current_user.buyers:
            current_user.buyers[0].company.name = payload.company_name
        elif current_user.role == "supplier" and current_user.suppliers:
            current_user.suppliers[0].company.name = payload.company_name

    await db.commit()
    await db.refresh(current_user)
    return _to_user_response(current_user)


@router.post("/me/change-password", status_code=status.HTTP_200_OK)
async def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, str]:
    """Changes password after verifying old password."""
    if not verify_password(payload.old_password, current_user.password_hash):
        raise AuthenticationError("Current password does not match")

    current_user.password_hash = get_password_hash(payload.new_password)
    await db.commit()
    return {"message": "Password changed successfully"}


@router.get("/admin-only", dependencies=[Depends(require_role("admin"))])
async def admin_only_check(current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    """Test endpoint for verifying role-based access control (RBAC)."""
    return {
        "status": "authorized",
        "role": current_user.role,
        "message": "Welcome Administrator",
    }
