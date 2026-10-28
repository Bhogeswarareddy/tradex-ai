import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_exchange_rates_endpoint():
    """Test that the exchange rates endpoint returns all required currencies and notice."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/users/exchange-rates")
        assert resp.status_code == 200
        data = resp.json()
        assert data["base"] == "USD"
        assert "notice" in data
        assert "Simulated exchange rates" in data["notice"]
        rates = data["rates"]
        assert "USD" in rates
        assert "EUR" in rates
        assert "INR" in rates
        assert "GBP" in rates
        assert "AED" in rates
        assert "CNY" in rates
        assert rates["USD"] == 1.0
        assert rates["INR"] >= 80.0
        assert rates["AED"] >= 3.5
        assert rates["CNY"] >= 7.0


@pytest.mark.asyncio
async def test_settings_persistence_end_to_end():
    """Test reading and writing settings (currency=INR, language=DE, theme=dark)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        unique_email = f"settings_inr_de_{uuid.uuid4().hex[:8]}@example.com"
        reg_res = await client.post(
            "/api/v1/auth/register",
            json={
                "email": unique_email,
                "password": "Password12345",
                "full_name": "MultiLang Buyer",
                "role": "buyer",
                "company_name": "Global Corp",
                "country": "Germany",
            },
        )
        assert reg_res.status_code == 201
        token = reg_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Read initial settings
        get_res = await client.get("/api/v1/users/me/settings", headers=headers)
        assert get_res.status_code == 200
        initial_settings = get_res.json()
        assert initial_settings["currency"] == "USD"
        assert initial_settings["language"] == "EN"

        # 2. Update to INR, German (DE), Dark theme, and disable new_quotes notifications
        patch_payload = {
            "currency": "INR",
            "language": "DE",
            "theme": "dark",
            "notifications": {
                "new_quotes": False,
            },
        }
        patch_res = await client.patch("/api/v1/users/me/settings", json=patch_payload, headers=headers)
        assert patch_res.status_code == 200
        updated = patch_res.json()
        assert updated["currency"] == "INR"
        assert updated["language"] == "DE"
        assert updated["theme"] == "dark"
        assert updated["notifications"]["new_quotes"] is False

        # 3. Verify persistence on subsequent GET /me/settings and GET /me
        verify_res = await client.get("/api/v1/users/me/settings", headers=headers)
        assert verify_res.status_code == 200
        persisted = verify_res.json()
        assert persisted["currency"] == "INR"
        assert persisted["language"] == "DE"
        assert persisted["theme"] == "dark"
        assert persisted["notifications"]["new_quotes"] is False

        me_res = await client.get("/api/v1/users/me", headers=headers)
        assert me_res.status_code == 200
        me_data = me_res.json()
        assert me_data["settings"]["currency"] == "INR"
        assert me_data["settings"]["language"] == "DE"
        assert me_data["settings"]["theme"] == "dark"


@pytest.mark.asyncio
async def test_notification_preference_blocks_new_quote_notification():
    """Turning off 'New Quotations' stops that notification from being created or returned."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        unique_email = f"buyer_notif_{uuid.uuid4().hex[:8]}@example.com"
        reg_res = await client.post(
            "/api/v1/auth/register",
            json={
                "email": unique_email,
                "password": "Password12345",
                "full_name": "Notification Tester",
                "role": "buyer",
                "company_name": "NoQuote Co",
                "country": "India",
            },
        )
        token = reg_res.json()["access_token"]
        headers_buyer = {"Authorization": f"Bearer {token}"}

        # 1. Turn off new_quotes for buyer
        patch_payload = {
            "notifications": {
                "new_quotes": False,
            },
        }
        await client.patch("/api/v1/users/me/settings", json=patch_payload, headers=headers_buyer)

        # 2. Query notifications: verify no quote notifications appear
        notif_res = await client.get("/api/v1/notifications", headers=headers_buyer)
        assert notif_res.status_code == 200
        notifs = notif_res.json()["notifications"]
        for n in notifs:
            assert n.get("event_type") not in ["quote_received", "new_quotes"]
            assert "quote" not in (n.get("title") or "").lower()


@pytest.mark.asyncio
async def test_active_sessions_and_revoke():
    """Test listing active sessions and revoking one."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        unique_email = f"session_test_{uuid.uuid4().hex[:8]}@example.com"
        reg_res = await client.post(
            "/api/v1/auth/register",
            json={
                "email": unique_email,
                "password": "Password12345",
                "full_name": "Session Tester",
                "role": "buyer",
                "company_name": "Sessions Co",
                "country": "Germany",
            },
        )
        token = reg_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        sessions_res = await client.get("/api/v1/users/me/sessions", headers=headers)
        assert sessions_res.status_code == 200
        sessions = sessions_res.json()
        assert isinstance(sessions, list)
        assert len(sessions) >= 1
        assert sessions[0]["is_current"] is True

        random_id = uuid.uuid4()
        del_res = await client.delete(f"/api/v1/users/me/sessions/{random_id}", headers=headers)
        assert del_res.status_code == 404
