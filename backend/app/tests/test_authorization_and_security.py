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


@pytest.mark.asyncio
async def test_admin_moderation_and_weights_endpoints():
    """Admin moderation of products/RFQs and matching weights config."""
    admin_token = await get_test_token("admin@tradex.ai")
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Product moderation list
        r_prods = await client.get("/api/v1/admin/moderation/products", headers={"Authorization": f"Bearer {admin_token}"})
        assert r_prods.status_code == 200
        assert isinstance(r_prods.json(), list)

        # RFQ moderation list
        r_rfqs = await client.get("/api/v1/admin/moderation/rfqs", headers={"Authorization": f"Bearer {admin_token}"})
        assert r_rfqs.status_code == 200
        assert isinstance(r_rfqs.json(), list)

        # Matching weights GET & PUT
        r_weights = await client.get("/api/v1/admin/matching/weights", headers={"Authorization": f"Bearer {admin_token}"})
        assert r_weights.status_code == 200

        # Update weights (valid sum = 1.0)
        valid_weights = {
            "price": 0.40,
            "lead_time": 0.20,
            "rating": 0.20,
            "compliance": 0.10,
            "capacity": 0.10,
        }
        r_put = await client.put(
            "/api/v1/admin/matching/weights",
            json=valid_weights,
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert r_put.status_code == 200, f"r_put failed: {r_put.text}"
        assert r_put.json()["status"] == "updated"

        # Update weights with invalid sum -> 400
        invalid_weights = {"price": 0.90, "lead_time": 0.50, "rating": 0.20, "compliance": 0.10, "capacity": 0.10}
        r_bad = await client.put(
            "/api/v1/admin/matching/weights",
            json=invalid_weights,
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert r_bad.status_code == 400


@pytest.mark.asyncio
async def test_idor_cross_tenant_order_isolation():
    """Buyer A cannot view Order belonging to Buyer B."""
    buyer_token = await get_test_token("bhogeswara@tradex.ai")
    transport = ASGITransport(app=app)

    from app.models.trade import Order
    from app.models.identity import Buyer
    async with AsyncSessionLocal() as session:
        u_res = await session.execute(select(User).where(User.email == "bhogeswara@tradex.ai"))
        bhogeswara = u_res.scalar_one()
        b_res = await session.execute(select(Buyer).where(Buyer.user_id == bhogeswara.id))
        buyer_profile = b_res.scalar_one_or_none()

        buyer_id_val = buyer_profile.id if buyer_profile else bhogeswara.id
        o_res = await session.execute(
            select(Order).where(Order.buyer_id != buyer_id_val).limit(1)
        )
        foreign_order = o_res.scalar_one_or_none()

    if foreign_order:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get(
                f"/api/v1/orders/{foreign_order.id}",
                headers={"Authorization": f"Bearer {buyer_token}"},
            )
            assert resp.status_code in [403, 404]


@pytest.mark.asyncio
async def test_idor_cross_tenant_document_download():
    """Unrelated user cannot download confidential document of another company."""
    supplier_token = await get_test_token("supplier@sribharat.com")
    transport = ASGITransport(app=app)

    from app.models.content import Document
    async with AsyncSessionLocal() as session:
        d_res = await session.execute(
            select(Document).join(User, Document.user_id == User.id).where(User.role == "buyer").limit(1)
        )
        doc = d_res.scalar_one_or_none()

    if doc:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get(
                f"/api/v1/documents/{doc.id}/download",
                headers={"Authorization": f"Bearer {supplier_token}"},
            )
            assert resp.status_code in [403, 404]


@pytest.mark.asyncio
async def test_idor_quote_comparison_rfq_ownership():
    """Competitor supplier or unrelated user cannot view RFQ quote comparison matrix."""
    supplier_token = await get_test_token("supplier@sribharat.com")
    transport = ASGITransport(app=app)

    from app.models.trade import RFQ
    async with AsyncSessionLocal() as session:
        rfq_res = await session.execute(select(RFQ).limit(1))
        rfq = rfq_res.scalar_one_or_none()

    if rfq:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get(
                f"/api/v1/rfqs/{rfq.id}/comparison",
                headers={"Authorization": f"Bearer {supplier_token}"},
            )
            assert resp.status_code in [403, 404]


@pytest.mark.asyncio
async def test_privilege_escalation_role_patch_blocked():
    """Normal user cannot patch or elevate their own role to admin."""
    buyer_token = await get_test_token("bhogeswara@tradex.ai")
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.patch(
            "/api/v1/users/me",
            json={"role": "admin", "full_name": "Hacked Name"},
            headers={"Authorization": f"Bearer {buyer_token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["role"] == "buyer"

        me_resp = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {buyer_token}"})
        my_id = me_resp.json()["id"]

        admin_patch_resp = await client.patch(
            f"/api/v1/admin/users/{my_id}",
            json={"role": "admin"},
            headers={"Authorization": f"Bearer {buyer_token}"},
        )
        assert admin_patch_resp.status_code == 403


@pytest.mark.asyncio
async def test_sql_injection_defense():
    """SQL injection payloads in search and route parameters are safely handled."""
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        sqli_payloads = [
            "' OR '1'='1",
            "'; DROP TABLE users; --",
            "1 UNION SELECT null, null, null--",
        ]

        for payload in sqli_payloads:
            resp = await client.get("/api/v1/products", params={"search": payload})
            assert resp.status_code == 200

            resp_detail = await client.get(f"/api/v1/products/{payload}")
            assert resp_detail.status_code in [404, 422]


@pytest.mark.asyncio
async def test_xss_sanitization_defense():
    """XSS script payloads in text fields are safely stored as plain text without execution."""
    buyer_token = await get_test_token("bhogeswara@tradex.ai")
    transport = ASGITransport(app=app)

    xss_payload = "<script>alert('XSS')</script><img src=x onerror=alert(1)>"

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.patch(
            "/api/v1/users/me",
            json={"description": xss_payload},
            headers={"Authorization": f"Bearer {buyer_token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "company_description" in data or "description" in data
        desc_val = data.get("company_description") or data.get("description")
        assert "<script>" in desc_val or "&lt;script&gt;" in desc_val


@pytest.mark.asyncio
async def test_oversized_upload_rejection():
    """File uploads larger than 10MB are rejected by storage validator."""
    buyer_token = await get_test_token("bhogeswara@tradex.ai")
    transport = ASGITransport(app=app)

    oversized_bytes = b"%PDF-1.4\n" + b"A" * (11 * 1024 * 1024)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        files = {"file": ("big_invoice.pdf", oversized_bytes, "application/pdf")}
        data = {"doc_type": "invoice", "title": "Oversized Document"}

        resp = await client.post(
            "/api/v1/documents",
            files=files,
            data=data,
            headers={"Authorization": f"Bearer {buyer_token}"},
        )
        assert resp.status_code in [400, 413]


@pytest.mark.asyncio
async def test_expired_or_invalid_jwt_rejected():
    """Expired or malformed tokens must be rejected with HTTP 401 Unauthorized."""
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        r_malformed = await client.get("/api/v1/users/me", headers={"Authorization": "Bearer invalid.fake.token"})
        assert r_malformed.status_code == 401

        from datetime import timedelta
        import uuid
        expired_token = create_access_token({"sub": str(uuid.uuid4()), "role": "buyer"}, expires_delta=timedelta(seconds=-3600))
        r_expired = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {expired_token}"})
        assert r_expired.status_code == 401


@pytest.mark.asyncio
async def test_rate_limiting_on_ai_routes():
    """Rate limiter enforces 10 req/min sliding window on AI routes."""
    from app.core.rate_limit import ai_limiter
    ai_limiter.reset()
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        for _ in range(10):
            await client.post("/api/v1/ai/copilot/chat", json={"message": "ping"})

        r_limit = await client.post("/api/v1/ai/copilot/chat", json={"message": "ping"})
        assert r_limit.status_code == 429
        assert "Retry-After" in r_limit.headers
    ai_limiter.reset()
