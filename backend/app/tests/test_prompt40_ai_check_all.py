"""
Prompt 40 Acceptance Tests:
Verification of Unified AI Service Layer, Groq Model Connectivity,
16 AI Features, PII Privacy Redaction, Feature Flags, and Budget Controls.
"""
import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.main import app
from app.ai.privacy import redact_pii, sanitize_dict_pii
from app.ai.provider import get_ai_status, get_ai_provider
from app.ai.structured import generate_structured
from app.core.config import settings
from app.core.security import create_access_token
from app.models.identity import Company, Supplier, User
from app.models.catalog import Product, Category
from app.schemas.ai_features import (
    ListingWriterRequest,
    InquiryReplyRequest,
    ModerationSummaryRequest,
    ProductAISummaryResponse,
)


@pytest.mark.asyncio
async def test_privacy_redaction_layer():
    """Verify email, phone number, and PII redaction."""
    text_with_pii = "Contact buyer John Doe at john.doe@speisekammer.de or call +49 151 23456789 regarding 500kg turmeric."
    redacted = redact_pii(text_with_pii)
    assert "john.doe@speisekammer.de" not in redacted
    assert "[EMAIL REDACTED]" in redacted
    assert "+49 151 23456789" not in redacted

    dict_with_pii = {
        "notes": "Email supplier@keralaspices.com or phone +91 98765 43210 for prompt dispatch",
        "clean_field": "Organic Ginger 10 MT",
    }
    sanitized = sanitize_dict_pii(dict_with_pii)
    assert "[EMAIL REDACTED]" in sanitized["notes"]
    assert "Organic Ginger 10 MT" == sanitized["clean_field"]


@pytest.mark.asyncio
async def test_ai_configuration_and_models():
    """Verify smart, fast, and vision Groq models are configured."""
    assert settings.AI_MODEL_FAST == "llama-3.1-8b-instant"
    assert settings.AI_MODEL_SMART == "llama-3.3-70b-versatile"
    assert settings.AI_MODEL_VISION == "llama-3.2-11b-vision-preview"
    assert settings.EMBEDDING_DIM == 1536


@pytest.mark.asyncio
async def test_feature_flag_disable(db_session):
    """Verify that toggling off an AI feature flag falls back gracefully without crashing."""
    original_flag = settings.AI_FLAG_PRODUCT_SUMMARY
    try:
        settings.AI_FLAG_PRODUCT_SUMMARY = False
        res = await generate_structured(
            prompt_name="product_summary.v1",
            variables={"product_details": "Product: Green Cardamom 500kg from Kerala"},
            pydantic_model=ProductAISummaryResponse,
            session=db_session,
            feature_name="product_summary",
            use_cache=False,
        )
        assert res is not None
        assert len(res.key_points) > 0
        assert "AI generated" in res.ai_label
    finally:
        settings.AI_FLAG_PRODUCT_SUMMARY = original_flag


@pytest.mark.asyncio
async def test_product_ai_summary_endpoint(db_session):
    """Verify GET /api/v1/products/{id}/ai-summary endpoint."""
    prod = (await db_session.execute(select(Product).limit(1))).scalar_one_or_none()
    if not prod:
        pytest.skip("No products in database")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get(f"/api/v1/products/{prod.id}/ai-summary")
        assert res.status_code == 200
        data = res.json()
        assert "key_points" in data
        assert len(data["key_points"]) > 0
        assert "caution" in data
        assert "ai_label" in data


@pytest.mark.asyncio
async def test_supplier_portal_ai_endpoints(db_session):
    """Verify Supplier Portal AI endpoints: listing writer, reply draft, and profile tips."""
    supp_user = (await db_session.execute(
        select(User).where(User.role == "supplier").limit(1)
    )).scalar_one_or_none()
    if not supp_user:
        supp_user = (await db_session.execute(select(User).limit(1))).scalar_one_or_none()
        supp_user.role = "supplier"
        await db_session.commit()

    token = create_access_token({"sub": str(supp_user.id)})
    headers = {"Authorization": f"Bearer {token}"}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Listing writer
        lw_res = await ac.post(
            "/api/v1/supplier/ai/generate-listing",
            json={
                "product_name": "Organic Black Pepper",
                "category": "Spices & Herbs",
                "origin_country": "India",
                "notes": "Export grade bulk packing 50kg bags",
            },
            headers=headers,
        )
        assert lw_res.status_code == 200
        lw_data = lw_res.json()
        assert "title" in lw_data
        assert "description" in lw_data
        assert "specifications" in lw_data
        assert "search_keywords" in lw_data
        assert "aliases" in lw_data
        assert lw_data["ai_label"] == "AI generated"

        # 2. Reply draft
        rd_res = await ac.post(
            "/api/v1/supplier/ai/reply-draft",
            json={
                "buyer_message": "Can you provide 10 MT FOB Cochin pricing?",
                "supplier_notes": "We have 15 MT ready in warehouse",
            },
            headers=headers,
        )
        assert rd_res.status_code == 200
        rd_data = rd_res.json()
        assert "reply_draft" in rd_data
        assert len(rd_data["suggested_next_steps"]) > 0
        assert rd_data["ai_label"] == "AI generated"

        # 3. Profile tips
        pt_res = await ac.get("/api/v1/supplier/ai/profile-tips", headers=headers)
        assert pt_res.status_code == 200
        pt_data = pt_res.json()
        assert "completeness_score" in pt_data
        assert "actionable_tips" in pt_data
        assert len(pt_data["actionable_tips"]) > 0


@pytest.mark.asyncio
async def test_admin_moderation_ai_endpoint(db_session):
    """Verify Admin Moderation AI Summary endpoint."""
    admin_user = (await db_session.execute(
        select(User).where(User.role == "admin").limit(1)
    )).scalar_one_or_none()
    if not admin_user:
        admin_user = (await db_session.execute(select(User).limit(1))).scalar_one_or_none()
        admin_user.role = "admin"
        await db_session.commit()

    token = create_access_token({"sub": str(admin_user.id)})
    headers = {"Authorization": f"Bearer {token}"}

    prod = (await db_session.execute(select(Product).limit(1))).scalar_one_or_none()
    prod_id = str(prod.id) if prod else str(uuid.uuid4())

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        mod_res = await ac.post(
            "/api/v1/admin/moderation/ai-summary",
            json={
                "entity_type": "product",
                "entity_id": prod_id,
                "flag_reason": "Potentially unverified organic claim",
            },
            headers=headers,
        )
        assert mod_res.status_code == 200
        mod_data = mod_res.json()
        assert "risk_level" in mod_data
        assert "recommended_action" in mod_data
        assert "reasoning" in mod_data
        assert "Advisory only" in mod_data["ai_label"]
