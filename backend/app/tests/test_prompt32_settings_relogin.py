import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_prompt32_settings_persistence_relogin_flow():
    """Prompt 32: Settings, language, theme, and currency persistence across re-login."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        unique_email = f"prompt32_user_{uuid.uuid4().hex[:8]}@example.com"
        password = "Password123!"

        # 1. Register new user
        reg_res = await client.post(
            "/api/v1/auth/register",
            json={
                "email": unique_email,
                "password": password,
                "full_name": "Prompt 32 Tester",
                "role": "buyer",
                "company_name": "Test Global",
                "country": "Germany",
            },
        )
        assert reg_res.status_code == 201
        reg_data = reg_res.json()
        assert "settings" in reg_data["user"]
        assert reg_data["user"]["settings"]["currency"] == "USD"
        assert reg_data["user"]["settings"]["theme"] == "light"

        token = reg_data["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Update settings to Dark mode, Hindi (HI), and INR
        patch_payload = {
            "currency": "INR",
            "language": "HI",
            "theme": "dark",
            "notifications": {"messages": True, "rfq_updates": False},
        }
        patch_res = await client.patch("/api/v1/users/me/settings", json=patch_payload, headers=headers)
        assert patch_res.status_code == 200
        patched = patch_res.json()
        assert patched["currency"] == "INR"
        assert patched["language"] == "HI"
        assert patched["theme"] == "dark"

        # 3. Simulate re-login and verify TokenResponse.user.settings carries INR, HI, dark
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": unique_email, "password": password},
        )
        assert login_res.status_code == 200
        login_data = login_res.json()
        assert "settings" in login_data["user"]
        settings = login_data["user"]["settings"]
        assert settings["currency"] == "INR"
        assert settings["language"] == "HI"
        assert settings["theme"] == "dark"
        assert settings["notifications"]["rfq_updates"] is False

        # 4. Update settings to Light mode, German (DE), and EUR
        new_token = login_data["access_token"]
        new_headers = {"Authorization": f"Bearer {new_token}"}
        patch_payload_de = {
            "currency": "EUR",
            "language": "DE",
            "theme": "light",
        }
        patch_res_de = await client.patch("/api/v1/users/me/settings", json=patch_payload_de, headers=new_headers)
        assert patch_res_de.status_code == 200

        # 5. Simulate second re-login and verify EUR, DE, light
        login_res_de = await client.post(
            "/api/v1/auth/login",
            json={"email": unique_email, "password": password},
        )
        assert login_res_de.status_code == 200
        settings_de = login_res_de.json()["user"]["settings"]
        assert settings_de["currency"] == "EUR"
        assert settings_de["language"] == "DE"
        assert settings_de["theme"] == "light"

        # 6. Verify exchange rates endpoint returns real rates from DB
        rates_res = await client.get("/api/v1/users/exchange-rates")
        assert rates_res.status_code == 200
        rates_data = rates_res.json()
        assert rates_data["base"] == "USD"
        rates = rates_data["rates"]
        assert rates["USD"] == 1.0
        assert "INR" in rates and rates["INR"] >= 80.0
        assert "EUR" in rates and rates["EUR"] > 0

        # 7. Test Reset to Defaults
        reset_payload = {
            "currency": "USD",
            "language": "EN",
            "theme": "light",
            "notifications": {
                "messages": True,
                "rfq_updates": True,
                "new_quotes": True,
                "orders": True,
                "shipments": True,
                "document_verification": True,
                "email_notifications": False,
            },
        }
        third_token = login_res_de.json()["access_token"]
        third_headers = {"Authorization": f"Bearer {third_token}"}
        reset_res = await client.patch("/api/v1/users/me/settings", json=reset_payload, headers=third_headers)
        assert reset_res.status_code == 200
        reset_settings = reset_res.json()
        assert reset_settings["currency"] == "USD"
        assert reset_settings["language"] == "EN"
        assert reset_settings["theme"] == "light"
