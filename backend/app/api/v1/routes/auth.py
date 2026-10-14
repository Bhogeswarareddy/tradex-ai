import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Cookie, Depends, Header, Request, Response, status
from app.core.config import settings
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.db import get_db
from app.core.errors import AppException, AuthenticationError, ConflictError, NotFoundError, ValidationError
from app.core.logging import logger
from app.core.rate_limit import rate_limit_auth
from app.core.security import (
    create_access_token,
    create_refresh_token,
    get_password_hash,
    hash_token,
    verify_password,
)
from app.models.identity import Buyer, Company, RefreshToken, Role, Supplier, User
from app.schemas.auth import (
    ForgotPasswordRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
    VerifyEmailRequest,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.get("/status")
async def auth_status():
    return {"module": "auth", "status": "initialized"}


REFRESH_COOKIE_NAME = "tradex_refresh_token"
REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60  # 7 days


def _extract_company_info(user: User) -> tuple[Optional[str], Optional[User]]:
    company_name = None
    company_id = None
    if user.role == "buyer" and user.buyers:
        company_name = user.buyers[0].company.name if user.buyers[0].company else None
        company_id = user.buyers[0].company_id
    elif user.role == "supplier" and user.suppliers:
        company_name = user.suppliers[0].company.name if user.suppliers[0].company else None
        company_id = user.suppliers[0].company_id
    return company_name, company_id


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(rate_limit_auth)])
async def register(
    payload: UserRegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    # 1. Check if email already registered
    existing_user = await db.execute(select(User).where(User.email == payload.email))
    if existing_user.scalar_one_or_none():
        raise ConflictError("An account with this email address already exists")

    # 2. Get sanitized role (ADMIN cannot be created via public registration)
    target_role = "supplier" if payload.role.lower().strip() == "supplier" else "buyer"
    role_obj = (await db.execute(select(Role).where(Role.name == target_role))).scalar_one_or_none()

    # 3. Create User
    new_user = User(
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        full_name=payload.full_name,
        role=target_role,
        role_id=role_obj.id if role_obj else None,
        is_active=True,
        email_verified=False,
    )
    db.add(new_user)
    await db.flush()

    # 4. Create Company
    company = Company(
        name=payload.company_name,
        country=payload.country,
        city="Headquarters",
        verified_status="pending",
        years_in_business=1,
    )
    db.add(company)
    await db.flush()

    # 5. Create Buyer or Supplier Profile
    if payload.role == "buyer":
        buyer = Buyer(company_id=company.id, user_id=new_user.id, import_destinations=[payload.country])
        db.add(buyer)
    elif payload.role == "supplier":
        supplier = Supplier(
            company_id=company.id,
            user_id=new_user.id,
            capacity_per_month="100 MT",
            export_countries=[payload.country],
        )
        db.add(supplier)

    # 6. Generate Tokens
    access_token = create_access_token({"sub": str(new_user.id), "role": new_user.role})
    raw_refresh, refresh_hash, refresh_expires = create_refresh_token(str(new_user.id))

    db_refresh = RefreshToken(
        user_id=new_user.id,
        token_hash=refresh_hash,
        expires_at=refresh_expires,
    )
    db.add(db_refresh)
    await db.commit()

    # Set httpOnly Secure refresh cookie
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=raw_refresh,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=REFRESH_COOKIE_MAX_AGE,
        path="/api/v1/auth",
    )

    return TokenResponse(
        access_token=access_token,
        token_type="Bearer",
        expires_in=900,
        user=UserResponse(
            id=new_user.id,
            email=new_user.email,
            full_name=new_user.full_name,
            role=new_user.role,
            is_active=new_user.is_active,
            email_verified=new_user.email_verified,
            company_name=company.name,
            company_id=company.id,
        ),
    )


@router.post("/login", response_model=TokenResponse, dependencies=[Depends(rate_limit_auth)])
async def login(
    payload: UserLoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    # 1. Look up user
    stmt = (
        select(User)
        .where(User.email == payload.email, User.deleted_at.is_(None))
        .options(
            selectinload(User.buyers).selectinload(Buyer.company),
            selectinload(User.suppliers).selectinload(Supplier.company),
        )
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    now_utc = datetime.now(timezone.utc)

    # 1.5 Account lockout check
    if user and user.locked_until and user.locked_until > now_utc:
        remaining_sec = int((user.locked_until - now_utc).total_seconds())
        logger.warning(f"Attempt to login to locked account: {payload.email} (locked for {remaining_sec}s)")
        raise AuthenticationError(f"Account temporarily locked due to multiple failed logins. Try again in {remaining_sec}s.")

    # 2. Verify credentials
    if not user or not verify_password(payload.password, user.password_hash):
        if user:
            user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
            if user.failed_login_attempts >= 5:
                user.locked_until = now_utc + timedelta(minutes=15)
                logger.warning(f"User account locked after 5 failed attempts: {user.email}")
            db.add(user)
            await db.commit()

            if user.role.lower() == "admin":
                from app.core.permissions import record_audit_log
                await record_audit_log(
                    db=db,
                    action="admin_login_failed",
                    entity_type="user",
                    entity_id=str(user.id),
                    user_id=user.id,
                    details={"email": user.email, "reason": "invalid_password", "failed_attempts": user.failed_login_attempts},
                )

        logger.warning(f"Failed login attempt for email: {payload.email}")
        raise AuthenticationError("Invalid email address or password")

    if not user.is_active:
        raise AuthenticationError("Account has been disabled")

    # Reset failed login count on successful auth
    if user.failed_login_attempts > 0 or user.locked_until is not None:
        user.failed_login_attempts = 0
        user.locked_until = None
        db.add(user)

    # 3. Handle Admin MFA if required
    # Check if user is admin and MFA is enabled or required
    is_admin = user.role.lower() == "admin"
    mfa_required = is_admin and (settings.ADMIN_REQUIRE_MFA or user.mfa_enabled)
    # Check if totp_code is provided in request if schema supports it or headers
    totp_code = request.headers.get("X-MFA-Code") or getattr(payload, "totp_code", None)
    if mfa_required:
        import pyotp
        if not user.mfa_secret:
            # Generate pending secret if not set
            user.mfa_secret = pyotp.random_base32()
            db.add(user)
            await db.commit()

        totp = pyotp.TOTP(user.mfa_secret)
        if not totp_code or not totp.verify(totp_code, valid_window=1):
            if is_admin:
                from app.core.permissions import record_audit_log
                await record_audit_log(
                    db=db,
                    action="admin_mfa_challenge_issued",
                    entity_type="user",
                    entity_id=str(user.id),
                    user_id=user.id,
                    details={"email": user.email, "mfa_required": True},
                )
            raise AuthenticationError("MFA code required for Admin access. Provide valid 6-digit TOTP code.")

    # Audit successful admin login
    if is_admin:
        from app.core.permissions import record_audit_log
        await record_audit_log(
            db=db,
            action="admin_login_success",
            entity_type="user",
            entity_id=str(user.id),
            user_id=user.id,
            details={"email": user.email, "mfa_verified": mfa_required},
        )

    # 4. Create tokens
    access_token = create_access_token({"sub": str(user.id), "role": user.role})
    raw_refresh, refresh_hash, refresh_expires = create_refresh_token(str(user.id))

    db_refresh = RefreshToken(
        user_id=user.id,
        token_hash=refresh_hash,
        expires_at=refresh_expires,
    )
    db.add(db_refresh)
    await db.commit()

    # 4. Set httpOnly Secure SameSite cookie
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=raw_refresh,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=REFRESH_COOKIE_MAX_AGE,
        path="/api/v1/auth",
    )

    company_name, company_id = _extract_company_info(user)

    return TokenResponse(
        access_token=access_token,
        token_type="Bearer",
        expires_in=900,
        user=UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            is_active=user.is_active,
            email_verified=user.email_verified,
            company_name=company_name,
            company_id=company_id,
        ),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_tokens(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    tradex_refresh_token: Optional[str] = Cookie(None),
) -> TokenResponse:
    # Read refresh token from cookie or fallback to header
    token = tradex_refresh_token or request.headers.get("X-Refresh-Token")
    if not token:
        raise AuthenticationError("Refresh token missing")

    token_hash = hash_token(token)
    stmt = (
        select(RefreshToken)
        .where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > datetime.now(timezone.utc),
        )
        .options(
            selectinload(RefreshToken.user).selectinload(User.buyers).selectinload(Buyer.company),
            selectinload(RefreshToken.user).selectinload(User.suppliers).selectinload(Supplier.company),
        )
    )
    db_token = (await db.execute(stmt)).scalar_one_or_none()

    if not db_token or not db_token.user or not db_token.user.is_active:
        raise AuthenticationError("Invalid or expired refresh token")

    # Token Rotation: Revoke existing refresh token
    db_token.revoked_at = datetime.now(timezone.utc)

    # Issue fresh refresh token & access token
    user = db_token.user
    access_token = create_access_token({"sub": str(user.id), "role": user.role})
    new_raw_refresh, new_refresh_hash, new_refresh_expires = create_refresh_token(str(user.id))

    new_db_token = RefreshToken(
        user_id=user.id,
        token_hash=new_refresh_hash,
        expires_at=new_refresh_expires,
    )
    db.add(new_db_token)
    await db.commit()

    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=new_raw_refresh,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=REFRESH_COOKIE_MAX_AGE,
        path="/api/v1/auth",
    )

    company_name, company_id = _extract_company_info(user)

    return TokenResponse(
        access_token=access_token,
        token_type="Bearer",
        expires_in=900,
        user=UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            is_active=user.is_active,
            email_verified=user.email_verified,
            company_name=company_name,
            company_id=company_id,
        ),
    )


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    tradex_refresh_token: Optional[str] = Cookie(None),
) -> dict:
    token = tradex_refresh_token or request.headers.get("X-Refresh-Token")
    if token:
        token_hash = hash_token(token)
        await db.execute(
            update(RefreshToken)
            .where(RefreshToken.token_hash == token_hash)
            .values(revoked_at=datetime.now(timezone.utc))
        )
        await db.commit()

    # Clear cookie
    response.delete_cookie(key=REFRESH_COOKIE_NAME, path="/api/v1/auth")
    return {"message": "Successfully logged out"}


@router.post("/verify-email", status_code=status.HTTP_200_OK)
async def verify_email(payload: VerifyEmailRequest, db: AsyncSession = Depends(get_db)) -> dict:
    # Token structure stub for verification
    if len(payload.token) < 8:
        raise ValidationError("Invalid verification token format")
    logger.info(f"[Email Stub] Email verified with token: {payload.token}")
    return {"message": "Email address verified successfully", "status": "verified"}


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
async def forgot_password(payload: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)) -> dict:
    stmt = select(User).where(User.email == payload.email, User.deleted_at.is_(None))
    user = (await db.execute(stmt)).scalar_one_or_none()

    # Always return success to prevent email enumeration
    reset_token = secrets.token_urlsafe(32)
    logger.info(
        f"[Email Stub] PASSWORD RESET DISPATCHED to {payload.email}\n"
        f"Reset Token: {reset_token}\n"
        f"Reset URL: http://localhost:5173/reset-password?token={reset_token}"
    )
    return {"message": "If an account exists with this email, a password reset link has been dispatched."}
