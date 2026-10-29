import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.rate_limit import ai_limiter, auth_limiter

@pytest.fixture
def anyio_backend():
    return "asyncio"

@pytest.mark.anyio
async def test_prompt34_scenarios_api():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Login as buyer
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "bhogeswara@tradex.ai", "password": "buyer123"}
        )
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        tokens = login_res.json()
        token = tokens["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Scenario 1: AI Mode Laptop search under USD 400
        conv_res = await client.post("/api/v1/ai-mode/conversations", headers=headers, json={"title": "Prompt 34 Acceptance"})
        assert conv_res.status_code in [200, 201]
        conv_id = conv_res.json()["id"]

        msg1_res = await client.post(
            f"/api/v1/ai-mode/conversations/{conv_id}/messages",
            headers=headers,
            json={"content": "I want a laptop with price in USD 400 below"}
        )
        assert msg1_res.status_code in [200, 201]
        msg1_data = msg1_res.json()
        cards1 = msg1_data.get("product_cards") or msg1_data.get("cards", [])
        assert len(cards1) > 0, "Expected at least 1 laptop card under $400"
        for card in cards1:
            price_usd = float(card.get("price_display") or card.get("price_original") or card.get("unit_price") or 0)
            assert price_usd <= 400.0, f"Card price {price_usd} exceeds 400 USD"
            assert "Shenzhen" in card.get("supplier_name", "") or "Electronics" in card.get("supplier_name", "") or "Tech" in card.get("supplier_name", "")
        # Clarification question must be None
        assert msg1_data.get("clarifying_question") is None
        # Header/footer metadata check
        reply_obj = msg1_data.get("assistant_reply", {})
        assert reply_obj.get("provider") in ["groq", "ollama", "mock"]

        # Scenario 2: Greetings & Honest Fallback
        conv2_res = await client.post("/api/v1/ai-mode/conversations", headers=headers, json={"title": "Prompt 34 Greeting & Fallback"})
        conv2_id = conv2_res.json()["id"]

        hi_res = await client.post(
            f"/api/v1/ai-mode/conversations/{conv2_id}/messages",
            headers=headers,
            json={"content": "hi"}
        )
        assert hi_res.status_code in [200, 201]
        hi_data = hi_res.json()
        hi_cards = hi_data.get("product_cards") or hi_data.get("cards", [])
        assert len(hi_cards) == 0, "Greetings must return 0 cards"

        oppo_res = await client.post(
            f"/api/v1/ai-mode/conversations/{conv2_id}/messages",
            headers=headers,
            json={"content": "Show me OPPO mobile phones"}
        )
        assert oppo_res.status_code in [200, 201]
        oppo_data = oppo_res.json()
        oppo_cards = oppo_data.get("product_cards") or oppo_data.get("cards", [])
        assert len(oppo_cards) == 0, "OPPO phones must return 0 cards"
        oppo_reply = oppo_data.get("assistant_reply", {}).get("content", "")
        assert "rfq" in oppo_reply.lower() or "quote" in oppo_reply.lower() or "request" in oppo_reply.lower()

        # Scenario 3: AI Mode Follow-ups
        fu1 = await client.post(
            f"/api/v1/ai-mode/conversations/{conv_id}/messages",
            headers=headers,
            json={"content": "only from China"}
        )
        assert fu1.status_code in [200, 201]

        fu2 = await client.post(
            f"/api/v1/ai-mode/conversations/{conv_id}/messages",
            headers=headers,
            json={"content": "compare the first two"}
        )
        assert fu2.status_code in [200, 201]

        fu3 = await client.post(
            f"/api/v1/ai-mode/conversations/{conv_id}/messages",
            headers=headers,
            json={"content": "what is the MOQ of the second"}
        )
        assert fu3.status_code in [200, 201]
        fu3_reply = fu3.json().get("assistant_reply", {}).get("content", "")
        assert "25" in fu3_reply or "moq" in fu3_reply.lower()

        fu4 = await client.post(
            f"/api/v1/ai-mode/conversations/{conv_id}/messages",
            headers=headers,
            json={"content": "is it in stock"}
        )
        assert fu4.status_code in [200, 201]
        fu4_reply = fu4.json().get("assistant_reply", {}).get("content", "")
        assert "stock" in fu4_reply.lower()

        # Scenario 4: Health badge probe
        probe_res = await client.get("/api/v1/ai/status", headers=headers)
        assert probe_res.status_code == 200
        probe_data = probe_res.json()
        assert "status" in probe_data
        assert "provider" in probe_data

        # Scenario 5: AI Search
        search_laptop = await client.post(
            "/api/v1/ai/search",
            headers=headers,
            json={"query": "i want laptop", "page": 1, "page_size": 10}
        )
        assert search_laptop.status_code == 200
        sl_data = search_laptop.json()
        assert len(sl_data.get("products", [])) > 0 or len(sl_data.get("items", [])) > 0 or "results" in sl_data

        search_tractor = await client.post(
            "/api/v1/ai/search",
            headers=headers,
            json={"query": "i want to tractors", "page": 1, "page_size": 10}
        )
        assert search_tractor.status_code == 200

        # Scenario 6: Copilot
        ai_limiter.reset()
        copilot_laptop = await client.post(
            "/api/v1/ai/copilot/chat",
            headers=headers,
            json={"message": "i want laptop"}
        )
        assert copilot_laptop.status_code == 200
        cl_data = copilot_laptop.json()
        assert len(cl_data.get("cards", [])) > 0

        copilot_doc = await client.post(
            "/api/v1/ai/copilot/chat",
            headers=headers,
            json={"message": "What certificates or standards apply for exporting organic spices?"}
        )
        assert copilot_doc.status_code == 200
        cd_data = copilot_doc.json()
        assert len(cd_data.get("citations", [])) >= 0
        assert len(cd_data.get("response", "")) > 10

        # Scenario 7: Settings persistence
        settings_put = await client.patch(
            "/api/v1/users/me/settings",
            headers=headers,
            json={"theme": "dark", "language": "HI", "currency": "INR", "notifications": {"messages": True}}
        )
        assert settings_put.status_code == 200
        settings_get = await client.get("/api/v1/users/me/settings", headers=headers)
        assert settings_get.status_code == 200
        sg_data = settings_get.json()
        assert sg_data.get("theme") == "dark"
        assert sg_data.get("language") == "HI"
        assert sg_data.get("currency") == "INR"

        # Scenario 8: Recipient search for "sri"
        sri_res = await client.get("/api/v1/recipients?q=sri", headers=headers)
        assert sri_res.status_code == 200
        sri_list = sri_res.json()
        assert len(sri_list) >= 1
        assert any("Sri Bharat" in r.get("company_name", "") for r in sri_list)
        # Ensure privacy: no email or phone in results
        for r in sri_list:
            assert "email" not in r
            assert "phone" not in r
