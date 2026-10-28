import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, require_role
from app.core.db import get_db
from app.core.errors import AuthenticationError, NotFoundError, ValidationError
from app.core.security import get_password_hash, verify_password
from app.models.identity import Buyer, Company, RefreshToken, Supplier, User
from app.schemas.auth import (
    ChangePasswordRequest,
    UserResponse,
    UserSettingsUpdateRequest,
    UserUpdateRequest,
)

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/status")
async def users_status():
    return {"module": "users", "status": "initialized"}


def _to_user_response(user: User) -> UserResponse:
    company_name = None
    company_id = None
    company_country = None
    company_city = None
    company_website = None
    company_description = None
    company_years = None
    verified_status = "unverified"

    company: Optional[Company] = None
    if user.role == "buyer" and user.buyers and user.buyers[0].company:
        company = user.buyers[0].company
        company_id = user.buyers[0].company_id
    elif user.role == "supplier" and user.suppliers and user.suppliers[0].company:
        company = user.suppliers[0].company
        company_id = user.suppliers[0].company_id

    if company:
        company_name = company.name
        company_country = company.country
        company_city = company.city
        company_website = company.website
        company_description = company.description
        company_years = company.years_in_business
        verified_status = company.verified_status or "unverified"

    default_settings = {
        "notifications": {
            "messages": True,
            "rfq_updates": True,
            "new_quotes": True,
            "orders": True,
            "shipments": True,
            "document_verification": True,
            "email_notifications": False,
        },
        "currency": "USD",
        "language": "EN",
        "theme": "light",
    }
    merged_settings = {**default_settings, **(user.settings or {})}

    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        email_verified=user.email_verified,
        company_name=company_name,
        company_id=company_id,
        company_country=company_country,
        company_city=company_city,
        company_website=company_website,
        company_description=company_description,
        company_years_in_business=company_years,
        verified_status=verified_status,
        settings=merged_settings,
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
    """Updates contact information and company details of current user."""
    if payload.full_name is not None:
        current_user.full_name = payload.full_name

    company: Optional[Company] = None
    if current_user.role == "buyer" and current_user.buyers:
        company = current_user.buyers[0].company
    elif current_user.role == "supplier" and current_user.suppliers:
        company = current_user.suppliers[0].company

    if company:
        if payload.company_name is not None:
            company.name = payload.company_name
        if payload.country is not None:
            company.country = payload.country
        if payload.city is not None:
            company.city = payload.city
        if payload.website is not None:
            company.website = payload.website
        if payload.description is not None:
            company.description = payload.description
        if payload.years_in_business is not None:
            company.years_in_business = payload.years_in_business

    await db.commit()
    await db.refresh(current_user)
    return _to_user_response(current_user)


@router.get("/company", response_model=Dict[str, Any])
async def get_user_company(
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Returns company profile, documents, and real verification status for the current user."""
    company: Optional[Company] = None
    if current_user.role == "buyer" and current_user.buyers:
        company = current_user.buyers[0].company
    elif current_user.role == "supplier" and current_user.suppliers:
        company = current_user.suppliers[0].company

    if not company:
        return {
            "id": None,
            "name": current_user.company_name or "Independent Account",
            "country": "Germany",
            "city": "Berlin",
            "verified_status": "unverified",
            "years_in_business": 1,
            "website": None,
            "description": None,
        }

    return {
        "id": str(company.id),
        "name": company.name,
        "country": company.country,
        "city": company.city,
        "state": company.state,
        "website": company.website,
        "logo_url": company.logo_url,
        "banner_url": company.banner_url,
        "description": company.description,
        "years_in_business": company.years_in_business,
        "verified_status": company.verified_status or "unverified",
        "created_at": company.created_at.isoformat() if company.created_at else None,
    }


@router.post("/me/change-password", status_code=status.HTTP_200_OK)
async def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, str]:
    """Changes password after verifying old password, and revokes all other refresh tokens."""
    if not verify_password(payload.old_password, current_user.password_hash):
        raise AuthenticationError("Current password does not match")

    current_user.password_hash = get_password_hash(payload.new_password)

    # Revoke all existing refresh tokens for this user
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == current_user.id)
        .values(revoked_at=datetime.now(timezone.utc))
    )

    await db.commit()
    return {"message": "Password changed successfully"}


@router.get("/me/settings", response_model=Dict[str, Any])
async def get_user_settings(
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Retrieves user settings including notification preferences, display currency, and theme."""
    default_settings = {
        "notifications": {
            "messages": True,
            "rfq_updates": True,
            "new_quotes": True,
            "orders": True,
            "shipments": True,
            "document_verification": True,
            "email_notifications": False,
        },
        "currency": "USD",
        "language": "EN",
        "theme": "light",
    }
    return {**default_settings, **(current_user.settings or {})}


@router.patch("/me/settings", response_model=Dict[str, Any])
async def update_user_settings(
    payload: UserSettingsUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Updates and persists user settings."""
    existing = current_user.settings or {}
    if payload.notifications is not None:
        existing["notifications"] = {
            **(existing.get("notifications") or {}),
            **payload.notifications,
        }
    if payload.currency is not None:
        existing["currency"] = payload.currency
    if payload.language is not None:
        existing["language"] = payload.language
    if payload.theme is not None:
        existing["theme"] = payload.theme

    current_user.settings = dict(existing)
    await db.commit()
    await db.refresh(current_user)
    return current_user.settings


@router.get("/exchange-rates", response_model=Dict[str, Any])
async def get_exchange_rates(
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Retrieves stored exchange rates for multi-currency display."""
    from app.models.trade import SimulatedExchangeRate

    rates_stmt = select(SimulatedExchangeRate).where(SimulatedExchangeRate.from_currency == "USD")
    rows = (await db.execute(rates_stmt)).scalars().all()
    rates: Dict[str, float] = {
        "USD": 1.0,
        "EUR": 0.92,
        "INR": 83.50,
        "GBP": 0.79,
        "AED": 3.67,
        "CNY": 7.23,
    }
    for r in rows:
        rates[r.to_currency] = float(r.rate)

    return {
        "base": "USD",
        "rates": rates,
        "notice": "Simulated exchange rates",
    }


@router.get("/me/sessions", response_model=List[Dict[str, Any]])
async def list_user_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Returns active refresh token sessions for the authenticated user."""
    stmt = (
        select(RefreshToken)
        .where(
            RefreshToken.user_id == current_user.id,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > datetime.now(timezone.utc),
        )
        .order_by(RefreshToken.created_at.desc())
    )
    tokens = (await db.execute(stmt)).scalars().all()
    sessions = []
    for idx, t in enumerate(tokens):
        sessions.append({
            "id": str(t.id),
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "expires_at": t.expires_at.isoformat() if t.expires_at else None,
            "is_current": idx == 0,
            "client_name": "Web Browser (Desktop)" if idx == 0 else "TradeX Session",
        })
    return sessions


@router.delete("/me/sessions/{session_id}", status_code=status.HTTP_200_OK)
async def revoke_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, str]:
    """Revokes a specific session refresh token."""
    stmt = (
        select(RefreshToken)
        .where(RefreshToken.id == session_id, RefreshToken.user_id == current_user.id)
    )
    token = (await db.execute(stmt)).scalar_one_or_none()
    if not token:
        raise NotFoundError("Session not found")

    token.revoked_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "Session revoked successfully"}


@router.get("/admin-only", dependencies=[Depends(require_role("admin"))])
async def admin_only_check(current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    """Test endpoint for verifying role-based access control (RBAC)."""
    return {
        "status": "authorized",
        "role": current_user.role,
        "message": "Welcome Administrator",
    }
