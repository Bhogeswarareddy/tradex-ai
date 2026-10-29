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
async def test_list_orders_unauthenticated():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url='http://test') as client:
        resp = await client.get('/api/v1/orders')
        assert resp.status_code == 401


@pytest.mark.asyncio
async def test_list_orders_as_buyer():
    token = await get_test_token('bhogeswara@tradex.ai')
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url='http://test') as client:
        resp = await client.get('/api/v1/orders', headers={'Authorization': f'Bearer {token}'})
        assert resp.status_code == 200
        data = resp.json()
        assert 'items' in data
        assert 'total' in data


@pytest.mark.asyncio
async def test_get_order_detail():
    token = await get_test_token('bhogeswara@tradex.ai')
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url='http://test') as client:
        resp = await client.get('/api/v1/orders', headers={'Authorization': f'Bearer {token}'})
        assert resp.status_code == 200
        orders = resp.json()['items']
        if orders:
            order_id = orders[0]['id']
            detail_resp = await client.get(f'/api/v1/orders/{order_id}', headers={'Authorization': f'Bearer {token}'})
            assert detail_resp.status_code == 200
            data = detail_resp.json()
            assert 'order_number' in data
            assert 'payments' in data
            assert 'payment_summary' in data


@pytest.mark.asyncio
async def test_get_order_not_found():
    token = await get_test_token('bhogeswara@tradex.ai')
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url='http://test') as client:
        resp = await client.get(f'/api/v1/orders/{uuid.uuid4()}', headers={'Authorization': f'Bearer {token}'})
        assert resp.status_code in [403, 404]


@pytest.mark.asyncio
async def test_simulate_payment_invalid_order():
    token = await get_test_token('bhogeswara@tradex.ai')
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url='http://test') as client:
        resp = await client.post(
            f'/api/v1/orders/{uuid.uuid4()}/payments/simulate',
            json={'payment_type': 'advance'},
            headers={'Authorization': f'Bearer {token}'}
        )
        assert resp.status_code == 404


@pytest.mark.asyncio
async def test_trade_finance_overview():
    token = await get_test_token('bhogeswara@tradex.ai')
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url='http://test') as client:
        resp = await client.get('/api/v1/trade-finance/overview', headers={'Authorization': f'Bearer {token}'})
        assert resp.status_code == 200
        data = resp.json()
        assert data['simulated'] is True
        assert 'Trade Finance is simulated' in data['banner']
        assert 'credit_facility' in data
        assert 'balances' in data


@pytest.mark.asyncio
async def test_trade_finance_apply():
    token = await get_test_token('bhogeswara@tradex.ai')
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url='http://test') as client:
        resp = await client.post(
            '/api/v1/trade-finance/apply',
            json={
                'facility_type': 'Letter of Credit (LC)',
                'requested_amount': 50000.0,
                'tenor_days': 90,
                'counterparty_name': 'Speisekammer GmbH'
            },
            headers={'Authorization': f'Bearer {token}'}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data['status'] == 'approved'
        assert data['simulated'] is True
        assert 'SIM-LC' in data['application_reference']
