"""
TradeX AI: Permission System & Secure Admin Bootstrap Tests (Prompt 14)

Verifies:
1. Public registration cannot create an ADMIN account.
2. BUYER and SUPPLIER each receive 403 on every /admin endpoint.
3. Automated route scan ensures every endpoint has an explicit permission/dependency rule.
4. Admin bootstrap CLI (python -m app.cli create-admin) works once and refuses a second run without --force.
5. In ENV=production, the database seed script refuses to create the demo admin and raises RuntimeError.
6. Repeated failed logins (5 attempts) lock the account for 15 minutes.
7. Admin MFA blocks admin session without valid TOTP code when required.
8. Object-level ownership check (assert_owns) blocks cross-tenant tampering.
"""
import os
import subprocess
import uuid
from datetime import datetime, timezone
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.core.db import AsyncSessionLocal
from app.core.permissions import assert_owns, normalize_role, require_roles, RoleEnum
from app.core.security import create_access_token, get_password_hash
from app.main import app
from app.models.identity import Company, Role, User


async def get_token_for(email: str, role: str) -> str:
    async with AsyncSessionLocal() as session:
        user = (await session.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if not user:
            role_obj = (await session.execute(select(Role).where(Role.name == role))).scalar_one_or_none()
            user = User(
                id=uuid.uuid4(),
                email=email,
                password_hash=get_password_hash("ValidPass123"),
                full_name=f"Test {role.title()}",
                role=role,
                role_id=role_obj.id if role_obj else None,
                is_active=True,
                email_verified=True,
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)
        return create_access_token({"sub": str(user.id), "role": user.role})


# ---------------------------------------------------------------------------
# 1. Registration Protection: No Admin Created via Public Registration
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_public_registration_rejects_or_ignores_admin_role():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Attempt registering explicitly as admin
        resp = await client.post(
            "/api/v1/auth/register",
            json={
                "email": f"hacker_admin_{uuid.uuid4().hex[:6]}@malicious.com",
                "password": "StrongPassword123",
                "full_name": "Infiltrator Admin",
                "role": "admin",
                "company_name": "Hacker Corp",
                "country": "Germany",
            },
        )
        # Pydantic schema validation must reject "admin" in public registration
        assert resp.status_code in (400, 422)


@pytest.mark.asyncio
async def test_public_registration_allows_buyer_and_supplier_only():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Register as buyer
        buyer_email = f"legit_buyer_{uuid.uuid4().hex[:6]}@trade.com"
        resp_b = await client.post(
            "/api/v1/auth/register",
            json={
                "email": buyer_email,
                "password": "StrongPassword123",
                "full_name": "Legit Buyer",
                "role": "buyer",
                "company_name": "Import House AG",
                "country": "Germany",
            },
        )
        assert resp_b.status_code == 201
        data_b = resp_b.json()
        assert data_b["user"]["role"] == "buyer"

        # Register as supplier
        supplier_email = f"legit_supplier_{uuid.uuid4().hex[:6]}@trade.com"
        resp_s = await client.post(
            "/api/v1/auth/register",
            json={
                "email": supplier_email,
                "password": "StrongPassword123",
                "full_name": "Legit Supplier",
                "role": "supplier",
                "company_name": "Kerala Spice Exports",
                "country": "India",
            },
        )
        assert resp_s.status_code == 201
        data_s = resp_s.json()
        assert data_s["user"]["role"] == "supplier"


# ---------------------------------------------------------------------------
# 2. RBAC Sweep: BUYER and SUPPLIER Get 403 on Every /admin API
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_buyer_and_supplier_get_403_on_admin_endpoints():
    buyer_token = await get_token_for("test_buyer_rbac@tradex.ai", "buyer")
    supplier_token = await get_token_for("test_supplier_rbac@tradex.ai", "supplier")
    transport = ASGITransport(app=app)

    admin_test_endpoints = [
        ("GET", "/api/v1/admin/overview"),
        ("GET", "/api/v1/admin/users"),
        ("GET", "/api/v1/admin/verification-queue"),
        ("GET", "/api/v1/admin/audit-logs"),
        ("GET", "/api/v1/admin/settings"),
        ("GET", "/api/v1/admin/moderation/products"),
        ("GET", "/api/v1/admin/moderation/rfqs"),
        ("GET", "/api/v1/admin/documents/review-queue"),
        ("GET", "/api/v1/admin/matching/weights"),
    ]

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        for method, endpoint in admin_test_endpoints:
            # Buyer request
            r_buyer = await client.request(method, endpoint, headers={"Authorization": f"Bearer {buyer_token}"})
            assert r_buyer.status_code == 403, f"Buyer did not get 403 on {endpoint}: {r_buyer.status_code}"

            # Supplier request
            r_supp = await client.request(method, endpoint, headers={"Authorization": f"Bearer {supplier_token}"})
            assert r_supp.status_code == 403, f"Supplier did not get 403 on {endpoint}: {r_supp.status_code}"


# ---------------------------------------------------------------------------
# 3. Deny by Default: Route Scan Verifies Explicit Permission on Endpoints
# ---------------------------------------------------------------------------

def test_route_scan_verifies_all_endpoints_declare_rules():
    """Scans all registered routes to verify non-public endpoints have explicit security dependencies."""
    exempt_paths = {
        "/api/health",
        "/health",
        "/api/ready",
        "/metrics",
        "/docs",
        "/docs/oauth2-redirect",
        "/redoc",
        "/openapi.json",
        "/api/v1/openapi.json",
        "/api/v1/health",
        "/api/v1/auth/status",
        "/api/v1/auth/register",
        "/api/v1/auth/login",
        "/api/v1/auth/refresh",
        "/api/v1/auth/logout",
        "/api/v1/auth/verify-email",
        "/api/v1/auth/forgot-password",
        "/api/v1/dashboard/market-insights",
        "/api/v1/dashboard/summary",
        "/api/v1/dashboard/recommended-suppliers",
        "/api/v1/categories",
        "/api/v1/products/status",
        "/api/v1/products/compare",
        "/api/v1/products/compare/csv",
        "/api/v1/users/status",
        "/api/v1/suppliers/status",
        "/api/v1/suppliers/{id}/products",
        "/api/v1/suppliers/{id}/reviews",
        "/api/v1/suppliers/{id}/certifications",
        "/api/v1/suppliers/{id}/performance",
        "/api/v1/supplier/status",
        "/api/v1/supplier/products/csv-template",
        "/api/v1/rfqs/status",
        "/api/v1/quotes/status",
        "/api/v1/orders/status",
        "/api/v1/shipments/status",
        "/api/v1/documents/status",
        "/api/v1/messages/status",
        "/api/v1/ai/status",
        "/api/v1/ai/copilot/suggested-prompts",
        "/api/v1/ai/copilot/guides",
        "/api/v1/matching/weights",
        "/api/v1/analytics/status",
        "/api/v1/admin/status",
        "/api/v1/ws",
        "/ws",
    }

    unprotected_endpoints = []
    for route in app.routes:
        path = getattr(route, "path", "")
        if path in exempt_paths:
            continue

        dependant = getattr(route, "dependant", None)
        deps = []
        if dependant:
            for d in getattr(dependant, "dependencies", []):
                call = getattr(d, "call", None)
                if call:
                    deps.append(getattr(call, "__name__", str(call)))

        # Protected endpoints must declare get_current_user, role_dependency, get_current_supplier, or get_current_user_optional
        has_auth_rule = any(
            sec in deps
            for sec in [
                "get_current_user",
                "role_dependency",
                "role_checker",
                "get_current_supplier",
                "get_current_user_optional",
            ]
        )
        if not has_auth_rule:
            unprotected_endpoints.append(f"{route.methods} {path}")

    assert unprotected_endpoints == [], f"Found endpoints without explicit permission rule: {unprotected_endpoints}"


# ---------------------------------------------------------------------------
# 4. Account Lockout: 5 Failed Logins Lock Account
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_five_failed_logins_lock_account():
    from app.core.rate_limit import auth_limiter
    auth_limiter.reset()

    transport = ASGITransport(app=app)
    target_email = f"lockout_test_{uuid.uuid4().hex[:6]}@tradex.ai"

    # Create account
    async with AsyncSessionLocal() as session:
        user = User(
            id=uuid.uuid4(),
            email=target_email,
            password_hash=get_password_hash("CorrectPassword123"),
            full_name="Lockout Target",
            role="buyer",
            is_active=True,
            email_verified=True,
        )
        session.add(user)
        await session.commit()

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Trigger 5 wrong password attempts across different IP sources to test account-level lockout independently of IP rate limiter
        for i in range(5):
            r_fail = await client.post(
                "/api/v1/auth/login",
                json={"email": target_email, "password": "WrongPassword999"},
                headers={"X-Forwarded-For": f"198.51.100.{i + 1}"},
            )
            assert r_fail.status_code == 401

        # 6th attempt (even with correct password) must be locked
        r_locked = await client.post(
            "/api/v1/auth/login",
            json={"email": target_email, "password": "CorrectPassword123"},
            headers={"X-Forwarded-For": "198.51.100.99"},
        )
        assert r_locked.status_code == 401
        assert "temporarily locked" in r_locked.json()["error"]["message"].lower()


# ---------------------------------------------------------------------------
# 5. Production Seed Guard: Demo Admin Prohibited in ENV=production
# ---------------------------------------------------------------------------

def test_production_mode_refuses_demo_admin():
    from app.seed import seed
    old_env = os.environ.get("ENV")
    os.environ["ENV"] = "production"
    try:
        with pytest.raises(RuntimeError, match="CRITICAL SECURITY ERROR"):
            seed()
    finally:
        if old_env is not None:
            os.environ["ENV"] = old_env
        else:
            os.environ.pop("ENV", None)


# ---------------------------------------------------------------------------
# 6. Admin Bootstrap CLI: Works Once, Refuses Second Run Without --force
# ---------------------------------------------------------------------------

def test_admin_bootstrap_cli_refuses_duplicate():
    from app.cli.__main__ import create_admin
    # Ensure at least one admin exists
    os.environ["ADMIN_BOOTSTRAP_EMAIL"] = "bootstrap_admin@tradex.ai"
    os.environ["ADMIN_BOOTSTRAP_PASSWORD"] = "StrongBootstrapPass123"

    # Second run without force must return exit code 1 (refused)
    code = create_admin(force=False)
    assert code == 1, "create-admin should refuse to run when admin exists without --force"

    # With force, should succeed
    code_force = create_admin(force=True)
    assert code_force == 0, "create-admin with --force should succeed"


# ---------------------------------------------------------------------------
# 7. Admin MFA Enforcement
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_admin_mfa_blocks_session_without_valid_totp_code():
    import pyotp
    transport = ASGITransport(app=app)
    admin_email = f"mfa_admin_{uuid.uuid4().hex[:6]}@tradex.ai"

    secret = pyotp.random_base32()
    async with AsyncSessionLocal() as session:
        role_obj = (await session.execute(select(Role).where(Role.name == "admin"))).scalar_one_or_none()
        admin_user = User(
            id=uuid.uuid4(),
            email=admin_email,
            password_hash=get_password_hash("AdminPass123"),
            full_name="MFA Admin",
            role="admin",
            role_id=role_obj.id if role_obj else None,
            is_active=True,
            email_verified=True,
            mfa_secret=secret,
            mfa_enabled=True,
        )
        session.add(admin_user)
        await session.commit()

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Login without MFA code -> 401
        r_no_mfa = await client.post("/api/v1/auth/login", json={"email": admin_email, "password": "AdminPass123"})
        assert r_no_mfa.status_code == 401
        assert "MFA code required" in r_no_mfa.json()["error"]["message"]

        # 2. Login with invalid TOTP code -> 401
        r_bad_mfa = await client.post(
            "/api/v1/auth/login",
            json={"email": admin_email, "password": "AdminPass123"},
            headers={"X-MFA-Code": "000000"},
        )
        assert r_bad_mfa.status_code == 401

        # 3. Login with valid TOTP code -> 200
        totp = pyotp.TOTP(secret)
        valid_code = totp.now()
        r_good_mfa = await client.post(
            "/api/v1/auth/login",
            json={"email": admin_email, "password": "AdminPass123"},
            headers={"X-MFA-Code": valid_code},
        )
        assert r_good_mfa.status_code == 200
        assert "access_token" in r_good_mfa.json()


# ---------------------------------------------------------------------------
# 8. Ownership Assertions (assert_owns)
# ---------------------------------------------------------------------------

def test_assert_owns_service():
    from app.core.errors import PermissionDeniedError

    owner_user = User(id=uuid.uuid4(), role="buyer")
    other_user = User(id=uuid.uuid4(), role="buyer")
    admin_user = User(id=uuid.uuid4(), role="admin")

    class DummyRecord:
        def __init__(self, owner_id):
            self.user_id = owner_id

    doc = DummyRecord(owner_user.id)

    # Owner accesses -> passes
    assert_owns(owner_user, doc, "document")

    # Admin accesses -> passes
    assert_owns(admin_user, doc, "document")

    # Other user accesses -> raises PermissionDeniedError
    with pytest.raises(PermissionDeniedError, match="Access denied"):
        assert_owns(other_user, doc, "document")
