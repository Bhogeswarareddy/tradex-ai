import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_suppliers_filtering_and_sorting():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Base list
        res = await client.get("/api/v1/suppliers?page=1&page_size=10")
        assert res.status_code == 200
        data = res.json()
        assert "items" in data
        assert data["total"] > 0
        assert len(data["items"]) > 0

        # 2. Filter by country
        res_country = await client.get("/api/v1/suppliers?country=India")
        assert res_country.status_code == 200
        country_data = res_country.json()
        for item in country_data["items"]:
            assert item["country"] == "India"

        # 3. Filter by category
        res_cat = await client.get("/api/v1/suppliers?product_category=spices")
        assert res_cat.status_code == 200
        cat_data = res_cat.json()
        assert cat_data["total"] > 0

        # 4. Filter by verified_only
        res_ver = await client.get("/api/v1/suppliers?verified_only=true")
        assert res_ver.status_code == 200
        ver_data = res_ver.json()
        for item in ver_data["items"]:
            assert item["verified_status"] == "verified"

        # 5. Filter by min_rating
        res_rate = await client.get("/api/v1/suppliers?min_rating=4.7")
        assert res_rate.status_code == 200
        rate_data = res_rate.json()
        for item in rate_data["items"]:
            assert item["trust_score"] >= 4.7

        # 6. Filter by min_years
        res_years = await client.get("/api/v1/suppliers?min_years=10")
        assert res_years.status_code == 200
        years_data = res_years.json()
        for item in years_data["items"]:
            assert item["years_in_business"] >= 10

        # 7. Sorting by rating / trust
        res_sort = await client.get("/api/v1/suppliers?sort=rating")
        assert res_sort.status_code == 200
        sort_items = res_sort.json()["items"]
        if len(sort_items) >= 2:
            assert sort_items[0]["trust_score"] >= sort_items[1]["trust_score"]


@pytest.mark.asyncio
async def test_sri_bharat_supplier_profile_detail():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Find Sri Bharat Spices
        res_list = await client.get("/api/v1/suppliers?q=Sri+Bharat")
        assert res_list.status_code == 200
        items = res_list.json()["items"]
        assert len(items) > 0
        sri_bharat = items[0]
        supp_id = sri_bharat["id"]

        # 1. Profile detail
        res_prof = await client.get(f"/api/v1/suppliers/{supp_id}")
        assert res_prof.status_code == 200
        prof = res_prof.json()
        assert prof["name"] == "Sri Bharat Spices Pvt Ltd"
        assert prof["tag"] == "AN EXPORTER"
        assert "Guntur" in prof["location_display"]
        assert prof["years_in_business"] == 12
        assert prof["verified_status"] == "verified"
        assert prof["on_time_rate"] == 95.0
        assert prof["total_buyers_count"] >= 320
        assert len(prof["certifications"]) >= 2
        assert prof["factory_details"]["production_lines"] == 6

        # 2. Products sub-endpoint
        res_prods = await client.get(f"/api/v1/suppliers/{supp_id}/products")
        assert res_prods.status_code == 200
        prods = res_prods.json()
        assert isinstance(prods, list)
        assert len(prods) > 0

        # 3. Certifications sub-endpoint
        res_certs = await client.get(f"/api/v1/suppliers/{supp_id}/certifications")
        assert res_certs.status_code == 200
        certs = res_certs.json()
        assert len(certs) >= 2
        cert_names = [c["name"] for c in certs]
        assert any("Organic" in n or "ISO" in n for n in cert_names)

        # 4. Performance sub-endpoint
        res_perf = await client.get(f"/api/v1/suppliers/{supp_id}/performance")
        assert res_perf.status_code == 200
        perf = res_perf.json()
        assert perf["on_time_rate"] == 95.0
        assert perf["response_time_hours"] <= 24.0
        assert len(perf["monthly_trend"]) == 12


@pytest.mark.asyncio
async def test_review_gating_completed_order_requirement():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Find Sri Bharat Spices
        res_list = await client.get("/api/v1/suppliers?q=Sri+Bharat")
        supp_id = res_list.json()["items"][0]["id"]

        # 1. Unauthenticated post -> 401
        res_unauth = await client.post(
            f"/api/v1/suppliers/{supp_id}/reviews",
            json={"rating": 5, "title": "Great quality spices", "comment": "Excellent packaging"},
        )
        assert res_unauth.status_code == 401

        # 2. Login as supplier user (who is NOT a buyer with completed order)
        login_supp = await client.post(
            "/api/v1/auth/login",
            json={"email": "supplier@sribharat.com", "password": "supplier123"},
        )
        assert login_supp.status_code == 200
        supp_token = login_supp.json()["access_token"]

        # Supplier attempting to review -> 403 Forbidden
        res_supp_rev = await client.post(
            f"/api/v1/suppliers/{supp_id}/reviews",
            headers={"Authorization": f"Bearer {supp_token}"},
            json={"rating": 5, "title": "Great quality", "comment": "Good"},
        )
        assert res_supp_rev.status_code == 403

        # 3. Login as verified buyer with completed order (Bhogeswara Reddy)
        login_buyer = await client.post(
            "/api/v1/auth/login",
            json={"email": "bhogeswara@tradex.ai", "password": "buyer123"},
        )
        assert login_buyer.status_code == 200
        buyer_token = login_buyer.json()["access_token"]

        # Buyer posting review -> 201 Created
        res_buyer_rev = await client.post(
            f"/api/v1/suppliers/{supp_id}/reviews",
            headers={"Authorization": f"Bearer {buyer_token}"},
            json={
                "rating": 5,
                "title": "Superb High Curcumin Organic Turmeric Batch",
                "comment": "European lab testing matched the manufacturer certificate of analysis 100%.",
            },
        )
        assert res_buyer_rev.status_code == 201
        rev_data = res_buyer_rev.json()
        assert rev_data["review"]["rating"] == 5
        assert rev_data["review"]["buyer_company"] == "Reddy Global Trading GmbH"


@pytest.mark.asyncio
async def test_supplier_portal_storefront_and_isolation():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Login as Sri Bharat Spices (Supplier A)
        login_a = await client.post(
            "/api/v1/auth/login",
            json={"email": "supplier@sribharat.com", "password": "supplier123"},
        )
        assert login_a.status_code == 200
        token_a = login_a.json()["access_token"]
        headers_a = {"Authorization": f"Bearer {token_a}"}

        # Dashboard metrics
        res_metrics = await client.get("/api/v1/supplier/dashboard/metrics", headers=headers_a)
        assert res_metrics.status_code == 200
        metrics = res_metrics.json()
        assert metrics["profile_views"] > 0
        assert len(metrics["opportunities"]) > 0

        # Storefront profile
        res_prof = await client.get("/api/v1/supplier/profile", headers=headers_a)
        assert res_prof.status_code == 200
        prof = res_prof.json()
        assert prof["completeness_score"] >= 80

        # List products
        res_prods = await client.get("/api/v1/supplier/products", headers=headers_a)
        assert res_prods.status_code == 200
        prods = res_prods.json()["items"]
        assert len(prods) > 0
        prod_a_id = prods[0]["id"]

        # Supplier A can read their own product
        res_own = await client.get(f"/api/v1/supplier/products/{prod_a_id}", headers=headers_a)
        assert res_own.status_code == 200

        # 2. Login as Madhav Agro Exports (Supplier B)
        login_b = await client.post(
            "/api/v1/auth/login",
            json={"email": "contact@madhavagro.com", "password": "supplier123"},
        )
        assert login_b.status_code == 200
        token_b = login_b.json()["access_token"]
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # STRICT TENANT ISOLATION RULE: Supplier B requesting Supplier A's product ID must get 404!
        res_b_read = await client.get(f"/api/v1/supplier/products/{prod_a_id}", headers=headers_b)
        assert res_b_read.status_code == 404
        assert res_b_read.json()["error"]["code"] == "NOT_FOUND"

        res_b_update = await client.put(
            f"/api/v1/supplier/products/{prod_a_id}",
            headers=headers_b,
            json={"name": "Hacked Product Name"},
        )
        assert res_b_update.status_code == 404

        res_b_delete = await client.delete(f"/api/v1/supplier/products/{prod_a_id}", headers=headers_b)
        assert res_b_delete.status_code == 404


@pytest.mark.asyncio
async def test_supplier_csv_import_validation():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_a = await client.post(
            "/api/v1/auth/login",
            json={"email": "supplier@sribharat.com", "password": "supplier123"},
        )
        token_a = login_a.json()["access_token"]
        headers_a = {"Authorization": f"Bearer {token_a}"}

        # Test valid template download
        res_tmpl = await client.get("/api/v1/supplier/products/csv-template", headers=headers_a)
        assert res_tmpl.status_code == 200
        assert "name,category_slug" in res_tmpl.text

        # Test CSV with 1 good row and 2 bad rows
        csv_content = (
            "name,category_slug,description,hs_code,moq,unit,price,origin_country,lead_time_days\n"
            "Valid Organic Cardamom Pods,spices,Green whole cardamom pods,0908.31,250,kg,18.50,India,12\n"
            "Bad Row Missing Name,,Invalid row without category,0910.11,500,kg,4.20,India,14\n"
            "Bad Row Invalid MOQ,spices,Test invalid negative moq,0910.12,-50,kg,3.50,India,14\n"
        )
        files = {"file": ("test_import.csv", csv_content.encode("utf-8"), "text/csv")}

        res_import = await client.post(
            "/api/v1/supplier/products/import-csv",
            headers=headers_a,
            files=files,
        )
        assert res_import.status_code == 200
        result = res_import.json()
        assert result["total_rows"] == 3
        assert result["successful_rows"] == 1
        assert len(result["errors"]) == 2

        # Check line numbers reported
        error_lines = [err["row"] for err in result["errors"]]
        assert 3 in error_lines  # Row 3 is Bad Row Missing Category
        assert 4 in error_lines  # Row 4 is Bad Row Invalid MOQ
