import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_dashboard_summary_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/v1/dashboard/summary")
        assert res.status_code == 200
        data = res.json()

        assert "hero_stats" in data
        assert "kpis" in data
        assert data["hero_stats"]["verified_suppliers"] >= 2847
        assert data["hero_stats"]["global_buyers"] >= 12430
        assert data["hero_stats"]["active_shipments"] >= 1250
        assert data["hero_stats"]["countries_covered"] == 98

        kpi_titles = [k["title"] for k in data["kpis"]]
        assert "Active RFQs" in kpi_titles
        assert "Total Orders" in kpi_titles
        assert "Shipments in Transit" in kpi_titles
        assert "Total Trade Value" in kpi_titles
        assert "New Supplier Leads" in kpi_titles
        assert len(data["kpis"]) == 5


@pytest.mark.asyncio
async def test_dashboard_recommended_suppliers_and_insights():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Recommended suppliers
        res = await ac.get("/api/v1/dashboard/recommended-suppliers?tab=top_match")
        assert res.status_code == 200
        suppliers = res.json()
        assert len(suppliers) == 4
        assert "name" in suppliers[0]
        assert "trust_score" in suppliers[0]
        assert "on_time_rate" in suppliers[0]
        assert "capacity_per_month" in suppliers[0]
        assert "moq" in suppliers[0]

        # Market insights
        res_insights = await ac.get("/api/v1/dashboard/market-insights?tab=top_export")
        assert res_insights.status_code == 200
        insights = res_insights.json()
        assert len(insights) == 5
        assert insights[0]["name"] == "Organic Alleppey Turmeric"
        assert insights[0]["trend_percentage"] == "+42%"
        assert len(insights[0]["sparkline"]) == 7


@pytest.mark.asyncio
async def test_copilot_suggested_prompts():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/api/v1/ai/copilot/suggested-prompts")
        assert res.status_code == 200
        prompts = res.json()
        assert len(prompts) == 6
        prompt_texts = [p["prompt"] for p in prompts]
        assert "Analyze this RFQ and suggest best suppliers" in prompt_texts
        assert "Check HS code for turmeric powder" in prompt_texts


@pytest.mark.asyncio
async def test_products_list_and_filters():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Default list
        res = await ac.get("/api/v1/products?page=1&page_size=10")
        assert res.status_code == 200
        data = res.json()
        assert "items" in data
        assert "total" in data
        assert len(data["items"]) > 0

        # Filter by Organic + India + MOQ under 2 MT (2000 kg)
        res_filtered = await ac.get(
            "/api/v1/products?country=India&certifications=Organic&max_moq=2000"
        )
        assert res_filtered.status_code == 200
        filtered_data = res_filtered.json()
        assert len(filtered_data["items"]) > 0
        for item in filtered_data["items"]:
            assert item["origin_country"] == "India"
            assert item["moq"] <= 2000


@pytest.mark.asyncio
async def test_categories_and_product_detail():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Categories tree
        res_cats = await ac.get("/api/v1/categories")
        assert res_cats.status_code == 200
        cats = res_cats.json()
        assert len(cats) >= 4

        # Product detail by slug
        res_prods = await ac.get("/api/v1/products?page=1&page_size=1")
        prod_slug = res_prods.json()["items"][0]["slug"]

        res_detail = await ac.get(f"/api/v1/products/{prod_slug}")
        assert res_detail.status_code == 200
        detail = res_detail.json()
        assert detail["slug"] == prod_slug
        assert "price_tiers" in detail
        assert "supplier" in detail
        assert "ai_summary" in detail
        assert len(detail["ai_summary"]["key_points"]) == 3
        assert detail["ai_summary"]["caution"] is not None


@pytest.mark.asyncio
async def test_product_comparison_matrix():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res_prods = await ac.get("/api/v1/products?page=1&page_size=2")
        items = res_prods.json()["items"]
        if len(items) >= 2:
            p_ids = [items[0]["id"], items[1]["id"]]
            res_comp = await ac.post("/api/v1/products/compare", json={"product_ids": p_ids})
            assert res_comp.status_code == 200
            comp = res_comp.json()
            assert len(comp["products"]) == 2
            assert len(comp["matrix"]) >= 8
