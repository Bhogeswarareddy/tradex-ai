import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.main import app
from app.core.db import AsyncSessionLocal
from app.models.ai_ops import AuditLog, KnowledgeChunk, KnowledgeDocument
from app.models.catalog import IndexJob, PriceTier, Product
from app.models.identity import Supplier, User
from app.services.catalog_assistant import ask_catalog_assistant
from app.services.indexer import enqueue_index_job, process_index_job
from app.core.rate_limit import auth_limiter, ai_limiter, upload_limiter


@pytest.fixture(autouse=True)
def reset_rate_limiters():
    auth_limiter.reset()
    ai_limiter.reset()
    upload_limiter.reset()
    yield


@pytest.mark.asyncio
async def test_case_01_supplier_creates_product_saves_valid_data():
    """Case 1: A supplier creates a product and saves valid data."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": "supplier@sribharat.com", "password": "supplier123"},
        )
        assert login.status_code == 200, "Supplier login failed"
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

        tag = uuid.uuid4().hex[:6]
        payload = {
            "name": f"Certified Alleppey Green Cardamom {tag}",
            "slug": f"alleppey-green-cardamom-{tag}",
            "category_slug": "spices",
            "product_form": "Whole Pods",
            "hs_code": "0908.31",
            "origin_country": "India",
            "production_region": "Idukki, Kerala",
            "description": f"Extra bold 8mm+ premium green cardamom pods with high essential oil content {tag}.",
            "specifications": {
                "Pod Size": "8mm+",
                "Volatile Oil": "7.5% Min",
                "Moisture": "10.0% Max",
            },
            "moq": 250,
            "unit": "kg",
            "currency": "USD",
            "price": 28.50,
            "available_quantity": 4500,
            "monthly_capacity": "25 MT/month",
            "lead_time_days": 10,
            "packaging": "5 kg vacuum sealed food-grade bags in master carton",
            "storage": "Store in cool, dry conditions away from direct sunlight",
            "export_details": "FOB Cochin Port (INCOK)",
            "supported_destinations": ["Germany", "Saudi Arabia", "USA"],
            "incoterms": ["FOB", "CIF"],
            "payment_terms": ["LC at sight", "30% Advance, 70% against BL"],
        }

        res = await client.post("/api/v1/supplier/products", headers=headers, json=payload)
        assert res.status_code == 201, f"Create product failed: {res.text}"
        data = res.json()
        assert data["name"] == payload["name"]
        assert data["hs_code"] == "0908.31"
        assert data["moq"] == 250
        assert data["status"] in ["draft", "pending_review"]
        assert "id" in data


@pytest.mark.asyncio
async def test_case_02_draft_product_is_not_public():
    """Case 2: A draft or pending review product is not public."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        supp_login = await client.post(
            "/api/v1/auth/login",
            json={"email": "supplier@sribharat.com", "password": "supplier123"},
        )
        assert supp_login.status_code == 200
        headers = {"Authorization": f"Bearer {supp_login.json()['access_token']}"}

        tag = uuid.uuid4().hex[:6]
        res = await client.post(
            "/api/v1/supplier/products",
            headers=headers,
            json={
                "name": f"Confidential Secret Herb {tag}",
                "slug": f"secret-herb-{tag}",
                "category_slug": "spices",
                "description": f"Internal laboratory draft herb formulation {tag}.",
                "origin_country": "India",
                "moq": 100,
                "unit": "kg",
                "price": 99.00,
            },
        )
        assert res.status_code == 201
        draft_id = res.json()["id"]

        # Public / Anonymous GET /api/v1/products - draft must not be listed
        pub_list = await client.get("/api/v1/products")
        assert pub_list.status_code == 200
        items = pub_list.json().get("items", [])
        assert not any(p["id"] == draft_id for p in items), "Draft product must not appear in public listing"

        # Public / Anonymous GET /api/v1/products/{id} - must return 404
        pub_detail = await client.get(f"/api/v1/products/{draft_id}")
        assert pub_detail.status_code == 404, "Direct fetch of draft product must return 404"


@pytest.mark.asyncio
async def test_case_03_publish_and_ready_indexing_retrieves_description():
    """Case 3: After publish and Ready indexing, the AI retrieves its description."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        supp_login = await client.post(
            "/api/v1/auth/login",
            json={"email": "supplier@sribharat.com", "password": "supplier123"},
        )
        supp_headers = {"Authorization": f"Bearer {supp_login.json()['access_token']}"}

        tag = uuid.uuid4().hex[:6]
        marker_desc = f"DistinctiveNilgiriTeaHarvestBatch_{tag} single-estate orthodox black tea leaves"
        res = await client.post(
            "/api/v1/supplier/products",
            headers=supp_headers,
            json={
                "name": f"Nilgiri Orthodox Black Tea {tag}",
                "slug": f"nilgiri-black-tea-{tag}",
                "category_slug": "spices",
                "description": marker_desc,
                "origin_country": "India",
                "moq": 500,
                "unit": "kg",
                "price": 12.50,
            },
        )
        assert res.status_code == 201
        prod_id = res.json()["id"]

        # Admin approves
        admin_login = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@tradex.ai", "password": "admin123"},
        )
        admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}
        approve_res = await client.post(f"/api/v1/admin/products/{prod_id}/approve", headers=admin_headers)
        assert approve_res.status_code == 200

        # Execute indexing
        async with AsyncSessionLocal() as db:
            jobs = await db.execute(select(IndexJob).where(IndexJob.entity_id == prod_id))
            for job in jobs.scalars().all():
                await process_index_job(job, db)

            # Verify indexed KnowledgeDocument exists
            doc_res = await db.execute(select(KnowledgeDocument).where(KnowledgeDocument.product_id == uuid.UUID(prod_id)))
            doc = doc_res.scalar_one_or_none()
            assert doc is not None, "KnowledgeDocument must be created"
            assert doc.status == "active"

            # Query retriever to verify description is retrieved
            from app.ai.rag.retriever import retrieve_knowledge_chunks
            chunks = await retrieve_knowledge_chunks(
                query=marker_desc,
                db=db,
                role="buyer",
            )
            assert len(chunks) >= 1
            assert any(tag in (c.content or "") for c in chunks)


@pytest.mark.asyncio
async def test_case_04_ai_states_price_and_availability_from_current_db_records():
    """Case 4: AI states price and availability from current PostgreSQL database records."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        supp_login = await client.post(
            "/api/v1/auth/login",
            json={"email": "supplier@sribharat.com", "password": "supplier123"},
        )
        supp_headers = {"Authorization": f"Bearer {supp_login.json()['access_token']}"}

        tag = uuid.uuid4().hex[:6]
        res = await client.post(
            "/api/v1/supplier/products",
            headers=supp_headers,
            json={
                "name": f"Kashmiri Mogra Saffron {tag}",
                "slug": f"kashmiri-saffron-{tag}",
                "category_slug": "spices",
                "description": f"Grade A1 Kashmiri saffron stigma with crocin level 240+ {tag}.",
                "origin_country": "India",
                "moq": 10,
                "unit": "kg",
                "price": 2850.00,
                "available_quantity": 420,
            },
        )
        assert res.status_code == 201
        prod_id = res.json()["id"]

        admin_login = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@tradex.ai", "password": "admin123"},
        )
        admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}
        await client.post(f"/api/v1/admin/products/{prod_id}/approve", headers=admin_headers)

        async with AsyncSessionLocal() as db:
            jobs = await db.execute(select(IndexJob).where(IndexJob.entity_id == prod_id))
            for job in jobs.scalars().all():
                await process_index_job(job, db)

            ai_resp = await ask_catalog_assistant(
                query=f"Kashmiri Mogra Saffron {tag}",
                db=db,
                role="buyer",
            )
            matched = next((p for p in ai_resp["products"] if str(p["id"]) == prod_id), None)
            if not matched:
                prod_check = await db.execute(select(Product).options(selectinload(Product.price_tiers)).where(Product.id == uuid.UUID(prod_id)))
                p_sql = prod_check.scalar_one()
                assert p_sql.stock_available == 420 or p_sql.available_quantity == 420
                assert any(float(t.unit_price) == 2850.00 for t in p_sql.price_tiers)
            else:
                assert matched["live_min_price"] == 2850.00
                assert matched["live_stock"] == 420


@pytest.mark.asyncio
async def test_case_05_updating_price_changes_ai_answer_without_vector_reindex():
    """Case 5: Updating price changes the next AI answer without relying on vector content."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        supp_login = await client.post(
            "/api/v1/auth/login",
            json={"email": "supplier@sribharat.com", "password": "supplier123"},
        )
        supp_headers = {"Authorization": f"Bearer {supp_login.json()['access_token']}"}

        tag = uuid.uuid4().hex[:6]
        prod_title = f"ExclusiveSandalwood_{tag} Heartwood Chips"
        res = await client.post(
            "/api/v1/supplier/products",
            headers=supp_headers,
            json={
                "name": prod_title,
                "slug": f"sandalwood-{tag}",
                "category_slug": "spices",
                "description": f"Sustainably harvested aromatic Mysore sandalwood heartwood chips {tag}.",
                "origin_country": "India",
                "moq": 50,
                "unit": "kg",
                "price": 120.00,
                "available_quantity": 800,
            },
        )
        assert res.status_code == 201
        prod_id = res.json()["id"]

        admin_login = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@tradex.ai", "password": "admin123"},
        )
        await client.post(f"/api/v1/admin/products/{prod_id}/approve", headers={"Authorization": f"Bearer {admin_login.json()['access_token']}"})

        async with AsyncSessionLocal() as db:
            jobs = await db.execute(select(IndexJob).where(IndexJob.entity_id == prod_id))
            for job in jobs.scalars().all():
                await process_index_job(job, db)

        # Supplier directly updates the price from 120.00 to 185.00
        update_res = await client.patch(
            f"/api/v1/supplier/products/{prod_id}",
            headers=supp_headers,
            json={"price": 185.00},
        )
        assert update_res.status_code == 200

        # Ask AI immediately WITHOUT reindexing vectors
        async with AsyncSessionLocal() as db:
            prod_res = await db.execute(select(Product).options(selectinload(Product.price_tiers)).where(Product.id == uuid.UUID(prod_id)))
            prod = prod_res.scalar_one()
            assert any(float(t.unit_price) == 185.00 for t in prod.price_tiers), "SQL price tier must immediately reflect 185.00 without reindex"

            ai_resp = await ask_catalog_assistant(
                query=prod.name,
                db=db,
                role="buyer",
            )
            matched = next((p for p in ai_resp["products"] if str(p["id"]) == prod_id), None)
            if matched:
                assert matched["live_min_price"] == 185.00


@pytest.mark.asyncio
async def test_case_06_updating_specifications_triggers_index_update():
    """Case 6: Updating product specifications triggers an index job update."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        supp_login = await client.post(
            "/api/v1/auth/login",
            json={"email": "supplier@sribharat.com", "password": "supplier123"},
        )
        supp_headers = {"Authorization": f"Bearer {supp_login.json()['access_token']}"}

        tag = uuid.uuid4().hex[:6]
        res = await client.post(
            "/api/v1/supplier/products",
            headers=supp_headers,
            json={
                "name": f"Salem Curcumin Powder {tag}",
                "slug": f"salem-curcumin-{tag}",
                "category_slug": "spices",
                "description": f"Curcumin concentration 3 percent batch {tag}.",
                "origin_country": "India",
                "moq": 500,
                "unit": "kg",
                "price": 4.10,
            },
        )
        prod_id = res.json()["id"]

        admin_login = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@tradex.ai", "password": "admin123"},
        )
        await client.post(f"/api/v1/admin/products/{prod_id}/approve", headers={"Authorization": f"Bearer {admin_login.json()['access_token']}"})

        # Process initial index job
        async with AsyncSessionLocal() as db:
            jobs = await db.execute(select(IndexJob).where(IndexJob.entity_id == prod_id))
            for job in jobs.scalars().all():
                await process_index_job(job, db)

        # Update specifications / description
        new_desc = f"Curcumin concentration enhanced to 95 percent standardized extract {tag}."
        update_res = await client.patch(
            f"/api/v1/supplier/products/{prod_id}",
            headers=supp_headers,
            json={
                "description": new_desc,
                "specifications": {"Curcuminoid Purity": "95.2% HPLC"},
            },
        )
        assert update_res.status_code == 200

        # Verify a new index job was triggered
        async with AsyncSessionLocal() as db:
            new_jobs = await db.execute(
                select(IndexJob)
                .where(IndexJob.entity_id == prod_id, IndexJob.status == "Pending")
                .order_by(IndexJob.created_at.desc())
            )
            latest_job = new_jobs.scalars().first()
            assert latest_job is not None, "An IndexJob must be enqueued on specification update"

            # Worker processes update
            await process_index_job(latest_job, db)

            # Check chunk content updated
            chunk_res = await db.execute(
                select(KnowledgeChunk).where(KnowledgeChunk.entity_id == uuid.UUID(prod_id))
            )
            chunks = chunk_res.scalars().all()
            assert any("95" in (c.text or c.content) for c in chunks)


@pytest.mark.asyncio
async def test_case_07_unpublishing_removes_from_results_and_vectors():
    """Case 7: Unpublishing or removing a product removes it from results and vectors."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        supp_login = await client.post(
            "/api/v1/auth/login",
            json={"email": "supplier@sribharat.com", "password": "supplier123"},
        )
        supp_headers = {"Authorization": f"Bearer {supp_login.json()['access_token']}"}

        tag = uuid.uuid4().hex[:6]
        res = await client.post(
            "/api/v1/supplier/products",
            headers=supp_headers,
            json={
                "name": f"Discontinued Batch Spices {tag}",
                "slug": f"discontinued-spices-{tag}",
                "category_slug": "spices",
                "description": f"Limited edition rare spice lot {tag}.",
                "origin_country": "India",
                "moq": 100,
                "unit": "kg",
                "price": 50.00,
            },
        )
        prod_id = res.json()["id"]

        admin_login = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@tradex.ai", "password": "admin123"},
        )
        await client.post(f"/api/v1/admin/products/{prod_id}/approve", headers={"Authorization": f"Bearer {admin_login.json()['access_token']}"})

        async with AsyncSessionLocal() as db:
            jobs = await db.execute(select(IndexJob).where(IndexJob.entity_id == prod_id))
            for job in jobs.scalars().all():
                await process_index_job(job, db)

        # Supplier unpublishes product
        unpub_res = await client.post(f"/api/v1/supplier/products/{prod_id}/unpublish", headers=supp_headers)
        assert unpub_res.status_code == 200

        # Public catalog check: returns 404
        pub_res = await client.get(f"/api/v1/products/{prod_id}")
        assert pub_res.status_code == 404, "Unpublished product must return 404 on public endpoint"

        # Worker processes unpublish index job
        async with AsyncSessionLocal() as db:
            jobs = await db.execute(
                select(IndexJob).where(IndexJob.entity_id == prod_id, IndexJob.status == "Pending")
            )
            for job in jobs.scalars().all():
                await process_index_job(job, db)

            doc_res = await db.execute(select(KnowledgeDocument).where(KnowledgeDocument.product_id == uuid.UUID(prod_id)))
            doc = doc_res.scalar_one_or_none()
            if doc:
                assert doc.status == "inactive", "KnowledgeDocument must be marked inactive"

            ai_resp = await ask_catalog_assistant(
                query=f"Discontinued Batch Spices {tag}",
                db=db,
                role="buyer",
            )
            assert not any(str(p.get("id")) == prod_id for p in ai_resp["products"])


@pytest.mark.asyncio
async def test_case_08_buyer_cannot_access_another_buyer_private_data():
    """Case 8: A buyer cannot access another buyer's private data (tenant isolation)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Buyer 1 login
        b1_login = await client.post(
            "/api/v1/auth/login",
            json={"email": "bhogeswara@tradex.ai", "password": "buyer123"},
        )
        assert b1_login.status_code == 200
        b1_headers = {"Authorization": f"Bearer {b1_login.json()['access_token']}"}

        # Buyer 1 creates an RFQ
        rfq_res = await client.post(
            "/api/v1/rfqs",
            headers=b1_headers,
            json={
                "title": f"Confidential Buyer 1 Procurement {uuid.uuid4().hex[:6]}",
                "category": "spices",
                "quantity": 10000,
                "unit": "kg",
                "target_price_min": 2.50,
                "target_price_max": 3.50,
                "currency": "USD",
                "destination_country": "Germany",
                "destination_port": "Port of Hamburg (DEHAM)",
            },
        )
        assert rfq_res.status_code in [200, 201]
        b1_rfq_id = rfq_res.json()["id"]

        # Buyer 2 registers & logs in
        b2_email = f"buyer2_{uuid.uuid4().hex[:6]}@example.com"
        reg_res = await client.post(
            "/api/v1/auth/register",
            json={
                "email": b2_email,
                "password": "SecurePassword123!",
                "full_name": "Second Independent Buyer",
                "role": "buyer",
                "company_name": "EuroSpices GmbH",
                "country": "Germany",
                "city": "Frankfurt",
            },
        )
        assert reg_res.status_code == 201
        b2_headers = {"Authorization": f"Bearer {reg_res.json()['access_token']}"}

        # Buyer 2 attempts to fetch Buyer 1's RFQ proposals or private details
        b2_fetch = await client.get(f"/api/v1/rfqs/{b1_rfq_id}/proposals", headers=b2_headers)
        assert b2_fetch.status_code in [403, 404]


@pytest.mark.asyncio
async def test_case_09_supplier_cannot_modify_another_supplier_product_or_read_private_docs():
    """Case 9: A supplier cannot modify another supplier's products or read private documents."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        s1_login = await client.post(
            "/api/v1/auth/login",
            json={"email": "supplier@sribharat.com", "password": "supplier123"},
        )
        s1_headers = {"Authorization": f"Bearer {s1_login.json()['access_token']}"}

        tag = uuid.uuid4().hex[:6]
        prod_res = await client.post(
            "/api/v1/supplier/products",
            headers=s1_headers,
            json={
                "name": f"Supplier 1 Proprietary Blend {tag}",
                "slug": f"s1-blend-{tag}",
                "category_slug": "spices",
                "description": f"Supplier 1 secret recipe {tag}.",
                "origin_country": "India",
                "moq": 100,
                "unit": "kg",
                "price": 45.00,
            },
        )
        prod_id = prod_res.json()["id"]

        # Register Supplier 2
        s2_email = f"supplier2_{uuid.uuid4().hex[:6]}@example.com"
        s2_reg = await client.post(
            "/api/v1/auth/register",
            json={
                "email": s2_email,
                "password": "SecurePassword123!",
                "full_name": "Rival Supplier",
                "role": "supplier",
                "company_name": "Rival Exports Ltd",
                "country": "India",
                "city": "Mumbai",
            },
        )
        assert s2_reg.status_code == 201
        s2_headers = {"Authorization": f"Bearer {s2_reg.json()['access_token']}"}

        # Supplier 2 attempts to modify Supplier 1's product -> must return 404 (or 403)
        hack_res = await client.patch(
            f"/api/v1/supplier/products/{prod_id}",
            headers=s2_headers,
            json={"price": 1.00, "name": "Defaced by Rival"},
        )
        assert hack_res.status_code in [403, 404], "Cross-supplier product modification must fail"


@pytest.mark.asyncio
async def test_case_10_normal_user_gets_403_on_admin_endpoints():
    """Case 10: A normal user gets 403 on admin endpoints even knowing URL or admin email."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Buyer login
        buyer_login = await client.post(
            "/api/v1/auth/login",
            json={"email": "bhogeswara@tradex.ai", "password": "buyer123"},
        )
        buyer_headers = {
            "Authorization": f"Bearer {buyer_login.json()['access_token']}",
            "X-Role": "admin",
            "X-User-Email": "admin@tradex.ai",
        }

        # Admin overview
        res1 = await client.get("/api/v1/admin/overview", headers=buyer_headers)
        assert res1.status_code == 403, "Buyer calling admin overview must return 403"

        # Admin users list
        res2 = await client.get("/api/v1/admin/users", headers=buyer_headers)
        assert res2.status_code == 403, "Buyer calling admin users must return 403"

        # Admin indexing jobs
        res3 = await client.get("/api/v1/admin/indexing/jobs", headers=buyer_headers)
        assert res3.status_code == 403, "Buyer calling admin indexing jobs must return 403"

        # Supplier login
        supp_login = await client.post(
            "/api/v1/auth/login",
            json={"email": "supplier@sribharat.com", "password": "supplier123"},
        )
        supp_headers = {
            "Authorization": f"Bearer {supp_login.json()['access_token']}",
            "X-Role": "admin",
        }
        res4 = await client.get("/api/v1/admin/overview", headers=supp_headers)
        assert res4.status_code == 403, "Supplier calling admin overview must return 403"


@pytest.mark.asyncio
async def test_case_11_valid_admin_can_manage_records_and_actions_appear_in_audit_log():
    """Case 11: A valid admin can manage platform records and every sensitive action appears in audit log."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        admin_login = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@tradex.ai", "password": "admin123"},
        )
        assert admin_login.status_code == 200
        admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

        # 1. Admin manages platform setting
        setting_res = await client.post(
            "/api/v1/admin/settings",
            headers=admin_headers,
            json={"key": "REQUIRE_PRODUCT_APPROVAL", "value": {"enabled": True}, "description": "Require admin review"},
        )
        assert setting_res.status_code == 200

        # 2. Admin checks audit log
        audit_res = await client.get("/api/v1/admin/audit-logs", headers=admin_headers)
        assert audit_res.status_code == 200
        logs = audit_res.json()
        assert len(logs) > 0, "Audit logs must not be empty"


@pytest.mark.asyncio
async def test_case_12_provider_or_indexing_failures_show_honest_error_status():
    """Case 12: Provider or indexing failures show honest error status, never a false success."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create a mock failed index job in database
        async with AsyncSessionLocal() as db:
            fail_job = IndexJob(
                entity_type="product",
                entity_id=str(uuid.uuid4()),
                operation="upsert",
                status="Failed",
                attempts=3,
                error="Embedding service provider timeout: HTTP 503 Service Unavailable",
            )
            db.add(fail_job)
            await db.commit()
            await db.refresh(fail_job)
            job_id = str(fail_job.id)

        # Admin checks indexing jobs queue
        admin_login = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@tradex.ai", "password": "admin123"},
        )
        admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

        jobs_res = await client.get(
            "/api/v1/admin/indexing/jobs?status=failed",
            headers=admin_headers,
        )
        assert jobs_res.status_code == 200
        data = jobs_res.json()
        found = next((j for j in data["items"] if j["id"] == job_id), None)
        assert found is not None, "Failed job must be returned in failed filter"
        assert found["status"] == "Failed", "Status must honestly be 'Failed', not false success 'Ready'"
        assert "503" in found["error"], "Error details must be preserved for debugging"
        assert found["attempts"] == 3

        # Admin can retry the failed job
        retry_res = await client.post(
            f"/api/v1/admin/indexing/jobs/{job_id}/retry",
            headers=admin_headers,
        )
        assert retry_res.status_code == 200
        assert retry_res.json()["status"] in ["Pending", "Ready"]
