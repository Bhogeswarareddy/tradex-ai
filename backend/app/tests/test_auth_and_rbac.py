import uuid
import pytest
from httpx import ASGITransport, AsyncClient

from app.core.rate_limit import auth_limiter
from app.core.security import create_access_token
from app.main import app


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    auth_limiter.reset()
    yield
    auth_limiter.reset()


@pytest.mark.asyncio
async def test_register_and_login_flow():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        unique_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        # 1. Register
        reg_payload = {
            "email": unique_email,
            "password": "SecurePassword123",
            "full_name": "Test Importer",
            "role": "buyer",
            "company_name": "Test Global Ltd",
            "country": "Germany",
        }
        reg_res = await client.post("/api/v1/auth/register", json=reg_payload)
        assert reg_res.status_code == 201, reg_res.text
        reg_data = reg_res.json()
        assert "access_token" in reg_data
        assert reg_data["user"]["email"] == unique_email
        assert reg_data["user"]["role"] == "buyer"
        assert "tradex_refresh_token" in reg_res.cookies

        # 2. Login with correct credentials
        login_payload = {
            "email": unique_email,
            "password": "SecurePassword123",
        }
        login_res = await client.post("/api/v1/auth/login", json=login_payload)
        assert login_res.status_code == 200
        login_data = login_res.json()
        assert "access_token" in login_data
        access_token = login_data["access_token"]

        # 3. Access /users/me
        me_res = await client.get(
            "/api/v1/users/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        assert me_res.status_code == 200
        assert me_res.json()["email"] == unique_email


@pytest.mark.asyncio
async def test_wrong_password_returns_generic_error():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "bhogeswara@tradex.ai", "password": "WrongPassword999"},
        )
        assert login_res.status_code == 401
        data = login_res.json()
        assert "error" in data
        assert data["error"]["code"] == "UNAUTHORIZED"
        assert "Invalid email address or password" in data["error"]["message"]


@pytest.mark.asyncio
async def test_refresh_token_rotation_and_logout():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Login seeded user
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "bhogeswara@tradex.ai", "password": "buyer123"},
        )
        assert login_res.status_code == 200
        refresh_cookie = login_res.cookies.get("tradex_refresh_token")
        assert refresh_cookie is not None

        # 2. Refresh tokens
        client.cookies.set("tradex_refresh_token", refresh_cookie)
        refresh_res = await client.post("/api/v1/auth/refresh")
        assert refresh_res.status_code == 200
        new_refresh_cookie = refresh_res.cookies.get("tradex_refresh_token")
        assert new_refresh_cookie is not None
        assert new_refresh_cookie != refresh_cookie  # Token was rotated!

        # 3. Old refresh token cannot be reused
        client.cookies.set("tradex_refresh_token", refresh_cookie)
        reuse_res = await client.post("/api/v1/auth/refresh")
        assert reuse_res.status_code == 401

        # 4. Logout with new token revokes it
        client.cookies.set("tradex_refresh_token", new_refresh_cookie)
        logout_res = await client.post("/api/v1/auth/logout")
        assert logout_res.status_code == 200

        # 5. Revoked token fails on subsequent refresh
        after_logout = await client.post("/api/v1/auth/refresh")
        assert after_logout.status_code == 401


@pytest.mark.asyncio
async def test_buyer_role_denial_on_admin_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Login as buyer
        buyer_login = await client.post(
            "/api/v1/auth/login",
            json={"email": "bhogeswara@tradex.ai", "password": "buyer123"},
        )
        buyer_token = buyer_login.json()["access_token"]

        # Buyer attempts admin endpoint -> 403 Forbidden
        admin_res = await client.get(
            "/api/v1/users/admin-only",
            headers={"Authorization": f"Bearer {buyer_token}"},
        )
        assert admin_res.status_code == 403
        data = admin_res.json()
        assert data["error"]["code"] == "FORBIDDEN"

        # Login as admin
        admin_login = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@tradex.ai", "password": "admin123"},
        )
        admin_token = admin_login.json()["access_token"]

        # Admin accesses admin endpoint -> 200 OK
        admin_success = await client.get(
            "/api/v1/users/admin-only",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert admin_success.status_code == 200
        assert admin_success.json()["status"] == "authorized"


@pytest.mark.asyncio
async def test_rate_limiting_on_login():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Trigger 5 login attempts
        for _ in range(5):
            await client.post(
                "/api/v1/auth/login",
                json={"email": "bhogeswara@tradex.ai", "password": "badpassword1"},
            )

        # 6th attempt within the minute should trigger 429 Too Many Requests
        rate_limited_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "bhogeswara@tradex.ai", "password": "badpassword1"},
        )
        assert rate_limited_res.status_code == 429
        data = rate_limited_res.json()
        assert data["error"]["code"] == "RATE_LIMIT_EXCEEDED"


@pytest.mark.asyncio
async def test_profile_update_and_persistence():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Register a fresh user
        unique_email = f"profile_test_{uuid.uuid4().hex[:8]}@example.com"
        reg_payload = {
            "email": unique_email,
            "password": "SecurePassword123",
            "full_name": "Initial Name",
            "role": "buyer",
            "company_name": "Initial Corp",
            "country": "Germany",
        }
        reg_res = await client.post("/api/v1/auth/register", json=reg_payload)
        token = reg_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Update profile
        update_payload = {
            "full_name": "Updated Importer",
            "company_name": "Updated Enterprise GmbH",
            "country": "Netherlands",
            "city": "Rotterdam",
        }
        patch_res = await client.patch("/api/v1/users/me", json=update_payload, headers=headers)
        assert patch_res.status_code == 200
        patch_data = patch_res.json()
        assert patch_data["full_name"] == "Updated Importer"
        assert patch_data["company_name"] == "Updated Enterprise GmbH"
        assert patch_data["company_country"] == "Netherlands"

        # 3. Verify persistence on GET /users/me
        get_res = await client.get("/api/v1/users/me", headers=headers)
        assert get_res.status_code == 200
        get_data = get_res.json()
        assert get_data["full_name"] == "Updated Importer"
        assert get_data["company_name"] == "Updated Enterprise GmbH"
        assert get_data["company_country"] == "Netherlands"

        # 4. Verify GET /users/company
        comp_res = await client.get("/api/v1/users/company", headers=headers)
        assert comp_res.status_code == 200
        comp_data = comp_res.json()
        assert comp_data["name"] == "Updated Enterprise GmbH"
        assert comp_data["country"] == "Netherlands"


@pytest.mark.asyncio
async def test_password_change_flow_and_old_password_invalidation():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        unique_email = f"pwd_test_{uuid.uuid4().hex[:8]}@example.com"
        reg_payload = {
            "email": unique_email,
            "password": "InitialPassword123",
            "full_name": "Password Tester",
            "role": "buyer",
            "company_name": "Security Inc",
            "country": "Germany",
        }
        reg_res = await client.post("/api/v1/auth/register", json=reg_payload)
        token = reg_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Wrong old password fails
        bad_change = await client.post(
            "/api/v1/users/me/change-password",
            json={"old_password": "WrongPassword999", "new_password": "NewSecurePassword456"},
            headers=headers,
        )
        assert bad_change.status_code == 401
        assert "Current password does not match" in bad_change.text

        # 2. Correct old password succeeds
        good_change = await client.post(
            "/api/v1/users/me/change-password",
            json={"old_password": "InitialPassword123", "new_password": "NewSecurePassword456"},
            headers=headers,
        )
        assert good_change.status_code == 200

        # 3. Old password fails on login
        old_login = await client.post(
            "/api/v1/auth/login",
            json={"email": unique_email, "password": "InitialPassword123"},
        )
        assert old_login.status_code == 401

        # 4. New password succeeds on login
        new_login = await client.post(
            "/api/v1/auth/login",
            json={"email": unique_email, "password": "NewSecurePassword456"},
        )
        assert new_login.status_code == 200
        assert "access_token" in new_login.json()


@pytest.mark.asyncio
async def test_user_settings_persistence():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        unique_email = f"settings_test_{uuid.uuid4().hex[:8]}@example.com"
        reg_res = await client.post(
            "/api/v1/auth/register",
            json={
                "email": unique_email,
                "password": "Password12345",
                "full_name": "Settings Tester",
                "role": "buyer",
                "company_name": "Config Co",
                "country": "France",
            },
        )
        token = reg_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Update settings
        patch_res = await client.patch(
            "/api/v1/users/me/settings",
            json={
                "notifications": {"orders": False, "messages": True},
                "currency": "EUR",
                "theme": "dark",
            },
            headers=headers,
        )
        assert patch_res.status_code == 200
        settings_data = patch_res.json()
        assert settings_data["currency"] == "EUR"
        assert settings_data["theme"] == "dark"
        assert settings_data["notifications"]["orders"] is False

        # Verify on GET
        get_res = await client.get("/api/v1/users/me/settings", headers=headers)
        assert get_res.status_code == 200
        assert get_res.json()["currency"] == "EUR"
        assert get_res.json()["theme"] == "dark"
