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


@pytest.mark.asyncio
async def test_supplier_inquiry_flow_and_privacy():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Get Sri Bharat Spices
        res_list = await client.get("/api/v1/suppliers?q=Sri+Bharat")
        supp_id = res_list.json()["items"][0]["id"]

        # 1. Unauthenticated inquire -> 401
        res_unauth = await client.post(
            f"/api/v1/suppliers/{supp_id}/inquire",
            json={"subject": "Inquiry test", "message": "Can you ship to Hamburg?"},
        )
        assert res_unauth.status_code == 401

        # 2. Buyer login
        login_buyer = await client.post(
            "/api/v1/auth/login",
            json={"email": "bhogeswara@tradex.ai", "password": "buyer123"},
        )
        buyer_token = login_buyer.json()["access_token"]
        buyer_headers = {"Authorization": f"Bearer {buyer_token}"}

        # 3. Post inquiry
        res_inq = await client.post(
            f"/api/v1/suppliers/{supp_id}/inquire",
            headers=buyer_headers,
            json={
                "subject": "FCL Contract Inquiry for Organic Turmeric 20MT",
                "message": "We require CIF Hamburg terms with third-party SGS inspection prior to container loading.",
                "quantity": 20000,
                "destination_port": "Port of Hamburg",
                "incoterm": "CIF",
            },
        )
        assert res_inq.status_code == 201
        data = res_inq.json()
        assert data["status"] == "sent"
        assert "thread_id" in data
        assert "message_id" in data

        # Verify supplier public profile NEVER leaks private email or phone numbers
        res_prof = await client.get(f"/api/v1/suppliers/{supp_id}")
        assert res_prof.status_code == 200
        prof_data = res_prof.json()
        assert "supplier@sribharat.com" not in str(prof_data)
        assert "phone" not in prof_data or prof_data.get("phone") is None


@pytest.mark.asyncio
async def test_csv_import_twenty_rows_with_error_line_14():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_a = await client.post(
            "/api/v1/auth/login",
            json={"email": "supplier@sribharat.com", "password": "supplier123"},
        )
        token_a = login_a.json()["access_token"]
        headers_a = {"Authorization": f"Bearer {token_a}"}

        # Construct 20 rows of CSV data (line 1 is header, line 2 to 21 are rows)
        # Line 14 corresponds to row index 13 (line 14 in file) -> make it invalid
        lines = [
            "name,category_slug,description,hs_code,moq,unit,price,origin_country,lead_time_days"
        ]
        for i in range(1, 21):
            line_num = i + 1  # header is line 1, i=1 -> line 2
            if line_num == 14:
                # Corrupt row at line 14: invalid missing name and negative price
                lines.append(",spices,Corrupted spice entry at line 14,0910.30,-10,kg,-5.00,India,10")
            else:
                lines.append(f"Product Row Item {i},spices,High quality commercial spices {i},0910.30,500,kg,{5.0 + i},India,14")

        csv_content = "\n".join(lines)
        files = {"file": ("twenty_items.csv", csv_content.encode("utf-8"), "text/csv")}

        res = await client.post(
            "/api/v1/supplier/products/import-csv",
            headers=headers_a,
            files=files,
        )
        assert res.status_code == 200
        result = res.json()
        assert result["total_rows"] == 20
        assert result["successful_rows"] == 19
        assert len(result["errors"]) == 1
        assert result["errors"][0]["row"] == 14
        assert "Product name is required" in result["errors"][0]["error"] or "Price" in result["errors"][0]["error"]


@pytest.mark.asyncio
async def test_end_to_end_supplier_registration_and_marketplace_publishing():
    import uuid
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Register a new supplier user
        unique_suffix = uuid.uuid4().hex[:6]
        supp_email = f"seller_{unique_suffix}@malabartrading.com"
        reg_res = await client.post(
            "/api/v1/auth/register",
            json={
                "email": supp_email,
                "password": "sellerpassword123",
                "full_name": "Arjun Menon",
                "role": "supplier",
                "company_name": f"Malabar Spices & Co {unique_suffix}",
                "country": "India",
            },
        )
        assert reg_res.status_code == 201
        token = reg_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Complete storefront profile
        prof_res = await client.put(
            "/api/v1/supplier/profile",
            headers=headers,
            json={
                "description": "Premium Malabar Coast Spices Exporter with certified sustainable processing.",
                "years_in_business": 10,
                "export_countries": ["Germany", "United States", "UAE", "Japan"],
                "website": "https://malabarspices.example.com",
            },
        )
        assert prof_res.status_code == 200
        prof_data = prof_res.json()
        assert "Malabar Coast Spices" in prof_data["description"]

        # 3. Add 3 products with price tiers, MOQ, capacity
        prod_ids = []
        for p_idx in range(1, 4):
            create_p = await client.post(
                "/api/v1/supplier/products",
                headers=headers,
                json={
                    "name": f"Malabar Tellicherry Black Pepper TGSEB Grade {p_idx} - {unique_suffix}",
                    "category_id": "spices",
                    "description": f"Extra bold single-origin Malabar tellicherry black peppercorns grade {p_idx}",
                    "hs_code": "0904.11",
                    "moq": 500 * p_idx,
                    "unit": "kg",
                    "origin_country": "India",
                    "lead_time_days": 10 + p_idx,
                    "is_active": False,  # start as draft
                    "price_tiers": [
                        {"min_qty": 500, "unit_price": 8.50, "currency": "USD"},
                        {"min_qty": 2000, "unit_price": 7.80, "currency": "USD"},
                        {"min_qty": 10000, "unit_price": 7.10, "currency": "USD"},
                    ],
                },
            )
            assert create_p.status_code == 201
            p_data = create_p.json()
            prod_ids.append(p_data["id"])

        assert len(prod_ids) == 3

        # 4. Products are currently draft, verify not yet in public marketplace
        mkt_draft = await client.get(f"/api/v1/products?q=Malabar+Tellicherry+{unique_suffix}")
        assert mkt_draft.status_code == 200
        assert mkt_draft.json()["total"] == 0

        # 5. Publish them via bulk update
        pub_res = await client.post(
            "/api/v1/supplier/products/bulk-status",
            headers=headers,
            json={"product_ids": prod_ids, "is_active": True},
        )
        assert pub_res.status_code == 200
        assert pub_res.json()["updated_count"] == 3

        # 6. Verify they appear in public marketplace
        mkt_pub = await client.get(f"/api/v1/products?q=Malabar+Tellicherry+{unique_suffix}")
        assert mkt_pub.status_code == 200
        assert mkt_pub.json()["total"] == 3

        # 7. Verify new supplier appears in public supplier discovery
        supp_discovery = await client.get(f"/api/v1/suppliers?q=Malabar+Spices+{unique_suffix}")
        assert supp_discovery.status_code == 200
        assert supp_discovery.json()["total"] >= 1


@pytest.mark.asyncio
async def test_tenant_isolation_orders_and_rfq_quotes():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Login Supplier A (Sri Bharat Spices)
        login_a = await client.post(
            "/api/v1/auth/login",
            json={"email": "supplier@sribharat.com", "password": "supplier123"},
        )
        token_a = login_a.json()["access_token"]
        headers_a = {"Authorization": f"Bearer {token_a}"}

        # Login Supplier B (Madhav Agro Exports)
        login_b = await client.post(
            "/api/v1/auth/login",
            json={"email": "contact@madhavagro.com", "password": "supplier123"},
        )
        token_b = login_b.json()["access_token"]
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # 1. Supplier A checks orders
        res_orders_a = await client.get("/api/v1/orders", headers=headers_a)
        assert res_orders_a.status_code == 200
        orders_a = res_orders_a.json()["items"]
        if orders_a:
            order_a_id = orders_a[0]["id"]

            # Supplier B attempting to view Supplier A's order -> 403 Forbidden
            res_b_view_order = await client.get(f"/api/v1/orders/{order_a_id}", headers=headers_b)
            assert res_b_view_order.status_code == 403

            # Supplier B attempting to transition Supplier A's order -> 403 Forbidden
            res_b_trans = await client.post(
                f"/api/v1/orders/{order_a_id}/transition",
                headers=headers_b,
                json={"status": "in_production"},
            )
            assert res_b_trans.status_code == 403

        # 2. Quotation tenant isolation
        # Get an RFQ to check quotes
        res_rfqs = await client.get("/api/v1/rfqs", headers=headers_a)
        assert res_rfqs.status_code == 200
        rfqs_list = res_rfqs.json().get("rfqs", [])
        if rfqs_list:
            rfq_id = rfqs_list[0]["id"]
            rfq_detail = await client.get(f"/api/v1/rfqs/{rfq_id}", headers=headers_a)
            if rfq_detail.status_code == 200 and rfq_detail.json().get("quotations"):
                quotes = rfq_detail.json()["quotations"]
                # Find quote belonging to Supplier A
                quote_a = next((q for q in quotes if q.get("supplier_name") == "Sri Bharat Spices Pvt Ltd"), None)
                if quote_a:
                    quote_a_id = quote_a["id"]
                    # Supplier B attempting to edit Supplier A's quotation -> 403 Forbidden
                    res_b_edit_quote = await client.patch(
                        f"/api/v1/rfqs/{rfq_id}/quotes/{quote_a_id}",
                        headers=headers_b,
                        json={"unit_price": 1.00},
                    )
                    assert res_b_edit_quote.status_code == 403


