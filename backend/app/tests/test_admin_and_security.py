import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.core.db import AsyncSessionLocal
from app.core.rate_limit import auth_limiter
from app.core.security import create_access_token
from app.main import app
from app.models.identity import Company, User


async def get_test_token(email: str) -> str:
    async with AsyncSessionLocal() as session:
        stmt = select(User).where(User.email == email)
        res = await session.execute(stmt)
        user = res.scalar_one_or_none()
        if not user:
            raise RuntimeError(f"User {email} not found")
        return create_access_token({"sub": str(user.id), "role": user.role})


@pytest.mark.asyncio
async def test_security_headers_present_on_all_responses():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/health")
        assert resp.status_code == 200
        # Verify defense-in-depth security headers
        assert resp.headers["X-Content-Type-Options"] == "nosniff"
        assert resp.headers["X-Frame-Options"] == "DENY"
        assert "Strict-Transport-Security" in resp.headers
        assert "Content-Security-Policy" in resp.headers
        assert "Referrer-Policy" in resp.headers
        assert "Permissions-Policy" in resp.headers


@pytest.mark.asyncio
async def test_rate_limiting_returns_429_with_retry_after():
    auth_limiter.reset()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Trigger requests up to limit (5 attempts per minute)
        for _ in range(5):
            await client.post("/api/v1/auth/login", json={"email": "wrong@email.com", "password": "wrong"})

        # 6th attempt must trigger 429 Rate Limit Exceeded
        rate_resp = await client.post("/api/v1/auth/login", json={"email": "wrong@email.com", "password": "wrong"})
        assert rate_resp.status_code == 429
        assert "Retry-After" in rate_resp.headers
        data = rate_resp.json()
        assert data["error"]["code"] == "RATE_LIMIT_EXCEEDED"
    auth_limiter.reset()


@pytest.mark.asyncio
async def test_admin_console_endpoints_rbac():
    buyer_token = await get_test_token("bhogeswara@tradex.ai")
    admin_token = await get_test_token("admin@tradex.ai")
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Buyer accessing admin overview -> 403 Forbidden
        forbidden_resp = await client.get(
            "/api/v1/admin/overview",
            headers={"Authorization": f"Bearer {buyer_token}"},
        )
        assert forbidden_resp.status_code == 403

        # Admin accessing overview -> 200 OK
        admin_resp = await client.get(
            "/api/v1/admin/overview",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert admin_resp.status_code == 200
        data = admin_resp.json()
        assert "total_users" in data
        assert "cumulative_trade_value_eur" in data
        assert data["system_status"] == "operational"


@pytest.mark.asyncio
async def test_admin_user_directory_and_role_management():
    admin_token = await get_test_token("admin@tradex.ai")
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # List users
        users_resp = await client.get(
            "/api/v1/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert users_resp.status_code == 200
        users = users_resp.json()
        assert len(users) >= 3

        # Update user active status
        target_user = users[0]
        update_resp = await client.patch(
            f"/api/v1/admin/users/{target_user['id']}",
            json={"is_active": True},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert update_resp.status_code == 200
        assert update_resp.json()["is_active"] is True


@pytest.mark.asyncio
async def test_admin_verification_queue_and_decision():
    admin_token = await get_test_token("admin@tradex.ai")
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Check verification queue
        queue_resp = await client.get(
            "/api/v1/admin/verification-queue",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert queue_resp.status_code == 200
        queue = queue_resp.json()
        assert isinstance(queue, list)

        # Make a decision on first company if present
        if queue:
            comp_id = queue[0]["company_id"]
            decide_resp = await client.post(
                f"/api/v1/admin/verification/{comp_id}/decision",
                json={"action": "approve", "notes": "All compliance files verified"},
                headers={"Authorization": f"Bearer {admin_token}"},
            )
            assert decide_resp.status_code == 200
            assert decide_resp.json()["status"] == "verified"


@pytest.mark.asyncio
async def test_admin_audit_logs_and_csv_export():
    admin_token = await get_test_token("admin@tradex.ai")
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # List audit logs
        logs_resp = await client.get(
            "/api/v1/admin/audit-logs",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert logs_resp.status_code == 200
        logs = logs_resp.json()
        assert isinstance(logs, list)

        # Export CSV
        export_resp = await client.get(
            "/api/v1/admin/audit-logs/export",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert export_resp.status_code == 200
        assert "text/csv" in export_resp.headers["content-type"]
        assert "Log ID" in export_resp.text
