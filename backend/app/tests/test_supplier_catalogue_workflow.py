import pytest
import io
from datetime import datetime, timezone, timedelta
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.main import app
from app.core.db import AsyncSessionLocal
from app.models.catalog import Product, IndexJob
from app.core.freshness import compute_freshness, get_product_freshness_metadata


@pytest.mark.asyncio
async def test_freshness_calculation():
    now = datetime.now(timezone.utc)
    # Current price (<30 days)
    status, days = compute_freshness(now - timedelta(days=5), stale_days=30)
    assert status == "current"
    assert days == 5

    # Stale price (>30 days)
    status_stale, days_stale = compute_freshness(now - timedelta(days=35), stale_days=30)
    assert status_stale == "stale"
    assert days_stale == 35

    # Current inventory (<14 days)
    status_inv, days_inv = compute_freshness(now - timedelta(days=3), stale_days=14)
    assert status_inv == "current"
    assert days_inv == 3

    # Stale inventory (>14 days)
    status_stale_inv, days_stale_inv = compute_freshness(now - timedelta(days=20), stale_days=14)
    assert status_stale_inv == "stale"
    assert days_stale_inv == 20


@pytest.mark.asyncio
async def test_supplier_catalogue_full_lifecycle():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Login as Supplier A
        login_a = await client.post(
            "/api/v1/auth/login",
            json={"email": "supplier@sribharat.com", "password": "supplier123"},
        )
        assert login_a.status_code == 200
        token_a = login_a.json()["access_token"]
        headers_a = {"Authorization": f"Bearer {token_a}"}

        # 2. Login as Admin
        login_admin = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@tradex.ai", "password": "admin123"},
        )
        assert login_admin.status_code == 200
        token_admin = login_admin.json()["access_token"]
        headers_admin = {"Authorization": f"Bearer {token_admin}"}

        # 3. Create a product as Draft
        payload = {
            "name": "Export Grade Wayanad Black Pepper TGSEB",
            "category_name": "Organic Spices & Herbs",
            "product_form": "Whole / Raw",
            "hs_code": "0904.11",
            "origin_country": "India",
            "production_region": "Wayanad, Kerala",
            "description": "Tellicherry Garbled Special Extra Bold (TGSEB) whole black peppercorns.",
            "lead_time_days": 10,
            "moq": 500,
            "unit": "kg",
            "currency": "USD",
            "available_quantity": 4000,
            "reserved_quantity": 0,
            "availability_status": "in_stock",
            "monthly_capacity": "50 MT/month",
            "packaging": "25 kg jute bags with poly inner liner",
            "storage": "Cool dry warehouse",
            "export_details": "FOB Cochin Port (INCOK)",
            "supported_destinations": ["Germany", "Netherlands", "USA"],
            "incoterms": ["FOB", "CIF"],
            "payment_terms": ["LC at sight", "30% Advance, 70% against BL"],
            "price_tiers": [
                {"min_qty": 500, "max_qty": 2000, "unit_price": 7.50},
                {"min_qty": 2001, "max_qty": None, "unit_price": 7.10},
            ],
            "specifications": {
                "Piperine Content": "5.5% Min",
                "Bulk Density": "580 g/L",
                "Moisture": "11.0% Max",
            },
        }

        res_create = await client.post("/api/v1/supplier/products", headers=headers_a, json=payload)
        assert res_create.status_code in [200, 201]
        prod_data = res_create.json()
        prod_id = prod_data["id"]
        prod_slug = prod_data.get("slug")

        # 4. Confirm product is in 'draft' status and NOT publicly visible
        res_get_own = await client.get(f"/api/v1/supplier/products/{prod_id}", headers=headers_a)
        assert res_get_own.status_code == 200
        assert res_get_own.json()["status"] == "draft"

        # Public lookup by ID must return 404
        res_pub_id = await client.get(f"/api/v1/products/{prod_id}")
        assert res_pub_id.status_code == 404

        # Public lookup by slug must return 404
        if prod_slug:
            res_pub_slug = await client.get(f"/api/v1/products/{prod_slug}")
            assert res_pub_slug.status_code == 404

        # 5. Check index job was enqueued for creation
        async with AsyncSessionLocal() as session:
            job_res = await session.execute(
                select(IndexJob).where(
                    IndexJob.entity_type == "product",
                    IndexJob.entity_id == prod_id,
                    IndexJob.operation == "create",
                )
            )
            job = job_res.scalar_one_or_none()
            assert job is not None

        # 6. Submit product for review
        res_submit = await client.post(f"/api/v1/supplier/products/{prod_id}/submit", headers=headers_a)
        assert res_submit.status_code == 200
        assert res_submit.json()["status"] == "pending_review"

        # Still invisible publicly
        assert (await client.get(f"/api/v1/products/{prod_id}")).status_code == 404

        # 7. Admin sees product in review queue
        res_admin_queue = await client.get("/api/v1/admin/products?status=pending_review", headers=headers_admin)
        assert res_admin_queue.status_code == 200
        pending_list = res_admin_queue.json()
        assert any(p["id"] == prod_id for p in pending_list)

        # 8. Admin approves product
        res_approve = await client.post(
            f"/api/v1/admin/products/{prod_id}/approve",
            headers=headers_admin,
            json={"admin_notes": "Complies with EU organic and spice export standards."},
        )
        assert res_approve.status_code == 200
        assert res_approve.json()["status"] == "published"

        # 9. Now publicly visible!
        res_pub_now = await client.get(f"/api/v1/products/{prod_id}")
        assert res_pub_now.status_code == 200
        pub_data = res_pub_now.json()
        assert pub_data["name"] == payload["name"]
        assert pub_data["product_form"] == "Whole / Raw"
        assert pub_data["price_status"] == "current"
        assert "admin_notes" not in pub_data  # admin notes never leaked

        # 10. Supplier unpublishes product
        res_unpub = await client.post(f"/api/v1/supplier/products/{prod_id}/unpublish", headers=headers_a)
        assert res_unpub.status_code == 200
        assert res_unpub.json()["status"] == "unpublished"

        # Public returns 404 again
        assert (await client.get(f"/api/v1/products/{prod_id}")).status_code == 404

        # 11. Supplier archives product
        res_arch = await client.post(f"/api/v1/supplier/products/{prod_id}/archive", headers=headers_a)
        assert res_arch.status_code == 200
        assert res_arch.json()["status"] == "archived"
        assert (await client.get(f"/api/v1/products/{prod_id}")).status_code == 404


@pytest.mark.asyncio
async def test_admin_reject_workflow():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_a = await client.post(
            "/api/v1/auth/login",
            json={"email": "supplier@sribharat.com", "password": "supplier123"},
        )
        headers_a = {"Authorization": f"Bearer {login_a.json()['access_token']}"}

        login_admin = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@tradex.ai", "password": "admin123"},
        )
        headers_admin = {"Authorization": f"Bearer {login_admin.json()['access_token']}"}

        # Create & submit product
        res_create = await client.post(
            "/api/v1/supplier/products",
            headers=headers_a,
            json={
                "name": "Substandard Test Spice",
                "category_name": "Organic Spices & Herbs",
                "moq": 100,
                "unit": "kg",
                "price_tiers": [{"min_qty": 100, "unit_price": 5.0}],
            },
        )
        assert res_create.status_code in [200, 201]
        prod_id = res_create.json()["id"]

        await client.post(f"/api/v1/supplier/products/{prod_id}/submit", headers=headers_a)

        # Reject without reason must fail (422)
        res_reject_no_reason = await client.post(
            f"/api/v1/admin/products/{prod_id}/reject",
            headers=headers_admin,
            json={"reason": ""},
        )
        assert res_reject_no_reason.status_code in [400, 422]

        # Reject with valid reason
        res_reject = await client.post(
            f"/api/v1/admin/products/{prod_id}/reject",
            headers=headers_admin,
            json={"reason": "Missing laboratory moisture certificate and invalid origin documentation."},
        )
        assert res_reject.status_code == 200
        assert res_reject.json()["status"] == "rejected"

        # Supplier sees rejection reason in their portal
        res_own = await client.get(f"/api/v1/supplier/products/{prod_id}", headers=headers_a)
        assert res_own.status_code == 200
        assert res_own.json()["status"] == "rejected"
        assert "laboratory moisture certificate" in res_own.json()["rejection_reason"]


@pytest.mark.asyncio
async def test_tenant_isolation_and_cross_supplier_blocking():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Supplier A
        login_a = await client.post(
            "/api/v1/auth/login",
            json={"email": "supplier@sribharat.com", "password": "supplier123"},
        )
        headers_a = {"Authorization": f"Bearer {login_a.json()['access_token']}"}

        # Supplier B
        login_b = await client.post(
            "/api/v1/auth/login",
            json={"email": "contact@madhavagro.com", "password": "supplier123"},
        )
        headers_b = {"Authorization": f"Bearer {login_b.json()['access_token']}"}

        # Create product for Supplier A
        res_create = await client.post(
            "/api/v1/supplier/products",
            headers=headers_a,
            json={
                "name": "Supplier A Confidential Spice",
                "category_name": "Organic Spices & Herbs",
                "moq": 100,
                "unit": "kg",
                "price_tiers": [{"min_qty": 100, "unit_price": 9.0}],
            },
        )
        prod_id = res_create.json()["id"]

        # Supplier B attempting any operation on Supplier A's product must receive 404
        assert (await client.get(f"/api/v1/supplier/products/{prod_id}", headers=headers_b)).status_code == 404
        assert (await client.patch(f"/api/v1/supplier/products/{prod_id}", headers=headers_b, json={"name": "Hacked"})).status_code == 404
        assert (await client.post(f"/api/v1/supplier/products/{prod_id}/submit", headers=headers_b)).status_code == 404
        assert (await client.post(f"/api/v1/supplier/products/{prod_id}/publish", headers=headers_b)).status_code == 404
        assert (await client.post(f"/api/v1/supplier/products/{prod_id}/unpublish", headers=headers_b)).status_code == 404
        assert (await client.post(f"/api/v1/supplier/products/{prod_id}/archive", headers=headers_b)).status_code == 404
        assert (await client.delete(f"/api/v1/supplier/products/{prod_id}", headers=headers_b)).status_code == 404


@pytest.mark.asyncio
async def test_price_tier_and_file_validations():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_a = await client.post(
            "/api/v1/auth/login",
            json={"email": "supplier@sribharat.com", "password": "supplier123"},
        )
        headers_a = {"Authorization": f"Bearer {login_a.json()['access_token']}"}

        # 1. Negative price tier -> 422
        res_neg = await client.post(
            "/api/v1/supplier/products",
            headers=headers_a,
            json={
                "name": "Negative Price Spice",
                "category_name": "Organic Spices & Herbs",
                "moq": 100,
                "unit": "kg",
                "price_tiers": [{"min_qty": 100, "unit_price": -5.0}],
            },
        )
        assert res_neg.status_code == 422

        # 2. Inverted interval (min_qty > max_qty) -> 422
        res_inverted = await client.post(
            "/api/v1/supplier/products",
            headers=headers_a,
            json={
                "name": "Inverted Tier Spice",
                "category_name": "Organic Spices & Herbs",
                "moq": 100,
                "unit": "kg",
                "price_tiers": [{"min_qty": 500, "max_qty": 200, "unit_price": 5.0}],
            },
        )
        assert res_inverted.status_code == 422

        # 3. Overlapping tiers (500-1000 and 800-2000) -> 422
        res_overlap = await client.post(
            "/api/v1/supplier/products",
            headers=headers_a,
            json={
                "name": "Overlapping Tiers Spice",
                "category_name": "Organic Spices & Herbs",
                "moq": 100,
                "unit": "kg",
                "price_tiers": [
                    {"min_qty": 500, "max_qty": 1000, "unit_price": 5.0},
                    {"min_qty": 800, "max_qty": 2000, "unit_price": 4.5},
                ],
            },
        )
        assert res_overlap.status_code == 422

        # 4. Valid product for file upload tests
        res_prod = await client.post(
            "/api/v1/supplier/products",
            headers=headers_a,
            json={
                "name": "Upload Test Spice",
                "category_name": "Organic Spices & Herbs",
                "moq": 100,
                "unit": "kg",
                "price_tiers": [{"min_qty": 100, "unit_price": 5.0}],
            },
        )
        prod_id = res_prod.json()["id"]

        # 5. Oversized image (>10MB) -> 413
        oversized_data = b"x" * (10 * 1024 * 1024 + 1024)  # 10MB + 1KB
        files = {"file": ("huge_image.jpg", io.BytesIO(oversized_data), "image/jpeg")}
        res_huge_img = await client.post(
            f"/api/v1/supplier/products/{prod_id}/images",
            headers=headers_a,
            files=files,
        )
        assert res_huge_img.status_code == 413

        # 6. Oversized document (>10MB) -> 413
        files_doc = {"file": ("huge_doc.pdf", io.BytesIO(oversized_data), "application/pdf")}
        res_huge_doc = await client.post(
            f"/api/v1/supplier/products/{prod_id}/documents",
            headers=headers_a,
            files=files_doc,
        )
        assert res_huge_doc.status_code == 413
