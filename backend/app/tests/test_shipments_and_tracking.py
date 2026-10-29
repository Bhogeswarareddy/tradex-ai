import pytest
import uuid
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.core.db import AsyncSessionLocal
from app.core.security import create_access_token
from app.main import app
from app.models.identity import User


async def get_test_token(email: str) -> str:
    async with AsyncSessionLocal() as session:
        stmt = select(User).where(User.email == email)
        res = await session.execute(stmt)
        user = res.scalar_one_or_none()
        if not user:
            raise RuntimeError(f'User {email} not found')
        return create_access_token({'sub': str(user.id), 'role': user.role})


@pytest.mark.asyncio
async def test_list_shipments():
    token = await get_test_token('bhogeswara@tradex.ai')
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url='http://test') as client:
        resp = await client.get('/api/v1/shipments', headers={'Authorization': f'Bearer {token}'})
        assert resp.status_code == 200
        data = resp.json()
        assert 'items' in data


@pytest.mark.asyncio
async def test_get_seeded_shipment_ex2026_1024():
    token = await get_test_token('bhogeswara@tradex.ai')
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url='http://test') as client:
        resp = await client.get('/api/v1/shipments?search=EX2026-1024', headers={'Authorization': f'Bearer {token}'})
        assert resp.status_code == 200
        items = resp.json()['items']
        assert len(items) >= 1
        assert items[0]['shipment_number'] == 'EX2026-1024'
        shipment_id = items[0]['id']

        detail = await client.get(f'/api/v1/shipments/{shipment_id}', headers={'Authorization': f'Bearer {token}'})
        assert detail.status_code == 200
        data = detail.json()
        assert data['shipment_number'] == 'EX2026-1024'
        assert 'mode' in data
        assert 'current_location' in data


@pytest.mark.asyncio
async def test_get_shipment_events():
    token = await get_test_token('bhogeswara@tradex.ai')
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url='http://test') as client:
        resp = await client.get('/api/v1/shipments?search=EX2026-1024', headers={'Authorization': f'Bearer {token}'})
        assert resp.status_code == 200
        items = resp.json()['items']
        if items:
            shipment_id = items[0]['id']
            events_resp = await client.get(f'/api/v1/shipments/{shipment_id}/events', headers={'Authorization': f'Bearer {token}'})
            assert events_resp.status_code == 200
            data = events_resp.json()
            assert isinstance(data, list)
            assert len(data) >= 1


@pytest.mark.asyncio
async def test_shipment_not_found():
    token = await get_test_token('bhogeswara@tradex.ai')
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url='http://test') as client:
        resp = await client.get(f'/api/v1/shipments/{uuid.uuid4()}', headers={'Authorization': f'Bearer {token}'})
        assert resp.status_code == 404


@pytest.mark.asyncio
async def test_ai_shipment_summary():
    token = await get_test_token('bhogeswara@tradex.ai')
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url='http://test') as client:
        resp = await client.get('/api/v1/shipments?search=EX2026-1024', headers={'Authorization': f'Bearer {token}'})
        assert resp.status_code == 200
        items = resp.json()['items']
        if items:
            shipment_id = items[0]['id']
            ai_resp = await client.post(f'/api/v1/ai/shipments/{shipment_id}/summary', headers={'Authorization': f'Bearer {token}'})
            assert ai_resp.status_code == 200
            data = ai_resp.json()
            assert 'current_status' in data or 'summary' in data
            assert 'delay_risk_level' in data
