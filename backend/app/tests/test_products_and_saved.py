import pytest
import uuid
from httpx import ASGITransport, AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_products_advanced_filtering_and_sorting():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Keyword search
        res_q = await ac.get("/api/v1/products?q=turmeric")
        assert res_q.status_code == 200
        data_q = res_q.json()
        assert data_q["total"] >= 1
        for item in data_q["items"]:
            assert "turmeric" in item["name"].lower() or "turmeric" in item["description"].lower()

        # 2. HS Code search
        res_hs = await ac.get("/api/v1/products?hs_code=0910")
        assert res_hs.status_code == 200
        data_hs = res_hs.json()
        assert data_hs["total"] >= 1
        for item in data_hs["items"]:
            assert "0910" in (item["hs_code"] or "")

        # 3. Country filter
        res_country = await ac.get("/api/v1/products?country=India")
        assert res_country.status_code == 200
        for item in res_country.json()["items"]:
            assert item["origin_country"] == "India"

        # 4. Verified Only filter
        res_verified = await ac.get("/api/v1/products?verified_only=true")
        assert res_verified.status_code == 200
        for item in res_verified.json()["items"]:
            assert item["supplier_verified"] is True

        # 5. Price Min and Max
        res_price = await ac.get("/api/v1/products?min_price=1.0&max_price=20.0")
        assert res_price.status_code == 200
        for item in res_price.json()["items"]:
            assert item["price_min"] >= 1.0
            assert item["price_min"] <= 20.0

        # 6. Sorting by price_asc
        res_sort_asc = await ac.get("/api/v1/products?sort=price_asc&page_size=5")
        assert res_sort_asc.status_code == 200
        items_asc = res_sort_asc.json()["items"]
        if len(items_asc) >= 2:
            assert items_asc[0]["price_min"] <= items_asc[1]["price_min"]

        # 7. Sorting by moq
        res_sort_moq = await ac.get("/api/v1/products?sort=moq&page_size=5")
        assert res_sort_moq.status_code == 200
        items_moq = res_sort_moq.json()["items"]
        if len(items_moq) >= 2:
            assert items_moq[0]["moq"] <= items_moq[1]["moq"]


@pytest.mark.asyncio
async def test_product_detail_by_slug_and_uuid():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res_list = await ac.get("/api/v1/products?page=1&page_size=1")
        assert res_list.status_code == 200
        item = res_list.json()["items"][0]
        prod_id = item["id"]
        prod_slug = item["slug"]

        # Detail by slug
        res_slug = await ac.get(f"/api/v1/products/{prod_slug}")
        assert res_slug.status_code == 200
        data_slug = res_slug.json()
        assert data_slug["id"] == prod_id
        assert data_slug["slug"] == prod_slug
        assert "specifications" in data_slug
        assert "packaging" in data_slug
        assert "incoterms" in data_slug

        # Detail by UUID
        res_uuid = await ac.get(f"/api/v1/products/{prod_id}")
        assert res_uuid.status_code == 200
        assert res_uuid.json()["id"] == prod_id

        # Non-existent
        res_404 = await ac.get(f"/api/v1/products/{uuid.uuid4()}")
        assert res_404.status_code == 404


@pytest.mark.asyncio
async def test_compare_products_and_csv_export():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res_list = await ac.get("/api/v1/products?page=1&page_size=2")
        items = res_list.json()["items"]
        assert len(items) >= 2
        p_ids = [items[0]["id"], items[1]["id"]]

        # Compare endpoint
        res_comp = await ac.post("/api/v1/products/compare", json={"product_ids": p_ids})
        assert res_comp.status_code == 200
        comp_data = res_comp.json()
        assert len(comp_data["products"]) == 2
        assert len(comp_data["matrix"]) >= 8

        # Compare CSV export endpoint
        res_csv = await ac.get(f"/api/v1/products/compare/csv?product_ids={p_ids[0]}&product_ids={p_ids[1]}")
        assert res_csv.status_code == 200
        assert "text/csv" in res_csv.headers.get("content-type", "")
        csv_text = res_csv.text
        assert "Attribute" in csv_text
        assert items[0]["name"] in csv_text or items[1]["name"] in csv_text


@pytest.mark.asyncio
async def test_saved_items_endpoints():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res_list = await ac.get("/api/v1/products?page=1&page_size=1")
        item = res_list.json()["items"][0]
        prod_id = item["id"]
        sup_id = item["supplier_id"]

        # 1. Save product
        res_save_p = await ac.post(f"/api/v1/saved/products/{prod_id}")
        assert res_save_p.status_code == 200
        assert res_save_p.json()["status"] == "saved"

        # 2. Verify in saved products list
        res_saved_prods = await ac.get("/api/v1/saved/products")
        assert res_saved_prods.status_code == 200
        saved_p_ids = [p["id"] for p in res_saved_prods.json()]
        assert prod_id in saved_p_ids

        # 3. Save supplier
        res_save_s = await ac.post(f"/api/v1/saved/suppliers/{sup_id}")
        assert res_save_s.status_code == 200
        assert res_save_s.json()["status"] == "saved"

        # 4. Verify in saved suppliers list
        res_saved_sups = await ac.get("/api/v1/saved/suppliers")
        assert res_saved_sups.status_code == 200
        saved_s_ids = [s["id"] for s in res_saved_sups.json()]
        assert sup_id in saved_s_ids

        # 5. Save search
        res_save_search = await ac.post("/api/v1/saved/searches", json={"query": "Turmeric Powder Export"})
        assert res_save_search.status_code == 200
        assert res_save_search.json()["status"] == "saved"
        search_id = res_save_search.json()["search_id"]

        # 6. Combined saved endpoint
        res_all = await ac.get("/api/v1/saved")
        assert res_all.status_code == 200
        all_data = res_all.json()
        assert all_data["counts"]["products"] >= 1
        assert all_data["counts"]["suppliers"] >= 1
        assert all_data["counts"]["searches"] >= 1

        # 7. Unsave product, supplier, search
        res_del_p = await ac.delete(f"/api/v1/saved/products/{prod_id}")
        assert res_del_p.status_code == 200
        assert res_del_p.json()["status"] == "unsaved"

        res_del_s = await ac.delete(f"/api/v1/saved/suppliers/{sup_id}")
        assert res_del_s.status_code == 200
        assert res_del_s.json()["status"] == "unsaved"

        res_del_search = await ac.delete(f"/api/v1/saved/searches/{search_id}")
        assert res_del_search.status_code == 200
        assert res_del_search.json()["status"] == "unsaved"
