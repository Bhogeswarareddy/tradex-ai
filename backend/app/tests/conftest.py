import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app


@pytest.fixture(autouse=True)
def reset_auth_rate_limit():
    from app.core.rate_limit import auth_limiter, ai_limiter
    auth_limiter.reset()
    ai_limiter.reset()


@pytest.fixture
async def async_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
async def db_session():
    from app.core.db import AsyncSessionLocal
    async with AsyncSessionLocal() as session:
        yield session
