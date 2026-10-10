import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.core.db import AsyncSessionLocal
from app.core.security import create_access_token
from app.main import app
from app.models.identity import User
from app.models.content import Document


async def get_test_token(email: str) -> str:
    async with AsyncSessionLocal() as session:
        stmt = select(User).where(User.email == email)
        res = await session.execute(stmt)
        user = res.scalar_one_or_none()
        if not user:
            raise RuntimeError(f"User {email} not found")
        return create_access_token({"sub": str(user.id), "role": user.role})


@pytest.mark.asyncio
async def test_upload_spoofed_executable_rejected():
    """Security verification: an executable file renamed to .pdf must be rejected."""
    token = await get_test_token("supplier@sribharat.com")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        fake_exe_content = b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00"
        files = {"file": ("malicious_payload.pdf", fake_exe_content, "application/pdf")}
        data = {"doc_type": "certificate_organic", "title": "Spoofed Certificate"}

        res = await client.post(
            "/api/v1/documents",
            files=files,
            data=data,
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 400
        body = res.json()
        err_msg = body.get("detail") or (body.get("error", {}).get("message")) or ""
        assert "malicious" in err_msg.lower() or "executable" in err_msg.lower() or "header" in err_msg.lower()


@pytest.mark.asyncio
async def test_upload_valid_certificate_pdf():
    """Verifies valid PDF upload succeeds and is saved with uploaded status."""
    token = await get_test_token("supplier@sribharat.com")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        valid_pdf = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"
        files = {"file": ("organic_cert_2026.pdf", valid_pdf, "application/pdf")}
        data = {"doc_type": "certificate_organic", "title": "EU Organic Accreditation"}

        res = await client.post(
            "/api/v1/documents",
            files=files,
            data=data,
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 201
        res_data = res.json()
        assert res_data["status"] == "success"
        assert res_data["doc_type"] == "certificate_organic"
        assert "document_id" in res_data


@pytest.mark.asyncio
async def test_unauthorized_user_download_forbidden():
    """Access control test: an unrelated buyer cannot download another user's private document."""
    supplier_token = await get_test_token("supplier@sribharat.com")
    buyer_token = await get_test_token("bhogeswara@tradex.ai")
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Supplier uploads private compliance document
        valid_pdf = b"%PDF-1.4 confidential supplier document"
        files = {"file": ("confidential_compliance.pdf", valid_pdf, "application/pdf")}
        upload_res = await client.post(
            "/api/v1/documents",
            files=files,
            data={"doc_type": "compliance_file", "title": "Confidential Internal Audit"},
            headers={"Authorization": f"Bearer {supplier_token}"},
        )
        assert upload_res.status_code == 201
        doc_id = upload_res.json()["document_id"]

        # Buyer attempts unauthorized download
        dl_res = await client.get(
            f"/api/v1/documents/{doc_id}/download",
            headers={"Authorization": f"Bearer {buyer_token}"},
        )
        assert dl_res.status_code == 403


@pytest.mark.asyncio
async def test_ai_document_extraction_and_confirmation():
    """Full workflow: upload document, run AI extraction, review confidences, and confirm to profile."""
    token = await get_test_token("supplier@sribharat.com")
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Upload valid certificate
        valid_pdf = b"%PDF-1.4 EU Organic Certificate Sri Bharat Spices IN-BIO-149"
        files = {"file": ("organic_apeda_cert.pdf", valid_pdf, "application/pdf")}
        upload_res = await client.post(
            "/api/v1/documents",
            files=files,
            data={"doc_type": "certificate_organic", "title": "APEDA EU Organic 2026"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert upload_res.status_code == 201
        doc_id = upload_res.json()["document_id"]

        # 2. Trigger AI extraction
        ext_res = await client.post(
            f"/api/v1/documents/{doc_id}/extract",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert ext_res.status_code == 200
        ext_data = ext_res.json()
        assert ext_data["status"] == "extracted"
        assert "confidence_score" in ext_data
        assert ext_data["confidence_score"] >= 0.70
        assert "company_name" in ext_data["data"]

        # 3. Confirm extraction
        conf_res = await client.post(
            f"/api/v1/documents/{doc_id}/confirm",
            json={"apply_to_supplier": True, "apply_to_order": False},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert conf_res.status_code == 200
        conf_data = conf_res.json()
        assert conf_data["status"] == "confirmed"
        assert conf_data["document_status"] == "verified"
        assert len(conf_data["applied_actions"]) >= 1