import json
import os
import pytest
from httpx import AsyncClient
from pydantic import BaseModel, Field

from app.ai import (
    MockProvider,
    SearchRequirement,
    ai_cache,
    circuit_breaker,
    generate_structured,
)
from app.ai.circuit_breaker import CircuitState


class SampleStructuredModel(BaseModel):
    product: str
    quantity: float
    unit: str
    target_price: float = Field(default=10.0)


@pytest.mark.asyncio
async def test_valid_json_passes(async_client: AsyncClient):
    """Test that valid JSON passes Pydantic validation on the first attempt."""
    mock = MockProvider()
    result = await generate_structured(
        prompt_name="search_extract.v1",
        variables={"query": "I need 20 tons of organic turmeric from India delivered to Hamburg within 45 days"},
        pydantic_model=SearchRequirement,
        override_provider=mock,
        use_cache=False,
    )
    assert result.product == "turmeric"
    assert result.quantity == 20000.0
    assert result.unit == "kg"
    assert result.origin_country == "India"
    assert result.destination_port == "Hamburg"
    assert "Organic" in result.certifications
    assert result.delivery_days == 45


@pytest.mark.asyncio
async def test_invalid_json_triggers_retry(async_client: AsyncClient):
    """Test that invalid JSON triggers retry and recovers."""
    mock = MockProvider()
    # Inject 1 invalid JSON response
    mock.simulated_invalid_json_count = 1

    result = await generate_structured(
        prompt_name="search_extract.v1",
        variables={"query": "I need 20 tons of organic turmeric from India delivered to Hamburg within 45 days"},
        pydantic_model=SearchRequirement,
        override_provider=mock,
        use_cache=False,
    )
    assert result.product == "turmeric"
    # Verification that the simulated failure was consumed
    assert mock.simulated_invalid_json_count == 0


@pytest.mark.asyncio
async def test_repeated_failure_falls_back(async_client: AsyncClient):
    """Test that repeated failures (exceeding retries) fall back gracefully."""
    mock = MockProvider()
    # Inject 5 invalid JSON responses (exceeds max_retries = 2)
    mock.simulated_invalid_json_count = 5

    result = await generate_structured(
        prompt_name="search_extract.v1",
        variables={"query": "I need 20 tons of organic turmeric from India delivered to Hamburg within 45 days"},
        pydantic_model=SearchRequirement,
        override_provider=mock,
        use_cache=False,
    )
    # Even on multiple retries exhausted, returns fallback search requirement
    assert result is not None
    assert result.product is not None


@pytest.mark.asyncio
async def test_circuit_breaker_behavior():
    """Test circuit breaker trips after 3 failures, falls back, and resets."""
    circuit_breaker.reset()
    assert circuit_breaker.state == CircuitState.CLOSED
    assert not circuit_breaker.is_open()

    # Record 3 failures
    circuit_breaker.record_failure()
    assert circuit_breaker.failure_count == 1
    assert not circuit_breaker.is_open()

    circuit_breaker.record_failure()
    assert circuit_breaker.failure_count == 2
    assert not circuit_breaker.is_open()

    circuit_breaker.record_failure()
    assert circuit_breaker.failure_count == 3
    assert circuit_breaker.state == CircuitState.OPEN
    assert circuit_breaker.is_open()

    # Success records reset
    circuit_breaker.record_success()
    assert circuit_breaker.state == CircuitState.CLOSED
    assert not circuit_breaker.is_open()


@pytest.mark.asyncio
async def test_response_cache():
    """Test that identical prompt and variables are served from cache."""
    ai_cache.clear()
    vars_payload = {"query": "Test caching basmati rice"}
    cached_val = {"product": "Basmati rice", "quantity": 1000.0, "unit": "kg", "target_price": 5.0}

    # Verify cache miss
    assert ai_cache.get("test_prompt.v1", vars_payload) is None

    # Set cache
    ai_cache.set("test_prompt.v1", vars_payload, cached_val)
    hit = ai_cache.get("test_prompt.v1", vars_payload)
    assert hit is not None
    assert hit["product"] == "Basmati rice"


@pytest.mark.asyncio
async def test_ten_fixtures_search_queries():
    """Test all 10 sample sentences in tests/fixtures/search_queries.json extract the right fields."""
    fixture_path = os.path.join(
        os.path.dirname(__file__),
        "fixtures",
        "search_queries.json",
    )
    with open(fixture_path, "r", encoding="utf-8") as f:
        fixtures = json.load(f)

    assert len(fixtures) == 10

    mock = MockProvider()
    for item in fixtures:
        query_text = item["query"]
        expected = item["expected"]

        extracted = await generate_structured(
            prompt_name="search_extract.v1",
            variables={"query": query_text},
            pydantic_model=SearchRequirement,
            override_provider=mock,
            use_cache=False,
        )

        assert extracted.product.lower() in expected["product"].lower() or expected["product"].lower() in extracted.product.lower()
        if "quantity" in expected:
            assert extracted.quantity == expected["quantity"]
        if "unit" in expected:
            assert extracted.unit.lower() == expected["unit"].lower()
        if "origin_country" in expected:
            assert extracted.origin_country == expected["origin_country"]
        if "destination_port" in expected:
            assert extracted.destination_port == expected["destination_port"]
        if "certifications" in expected:
            for cert in expected["certifications"]:
                assert cert in extracted.certifications
        if "delivery_days" in expected:
            assert extracted.delivery_days == expected["delivery_days"]


@pytest.mark.asyncio
async def test_ai_search_endpoint(async_client: AsyncClient):
    """Test POST /api/v1/ai/search endpoint and fixed turmeric example."""
    res = await async_client.post(
        "/api/v1/ai/search",
        json={"query": "I need 20 tons of organic turmeric from India delivered to Hamburg within 45 days"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["query"] == "I need 20 tons of organic turmeric from India delivered to Hamburg within 45 days"
    req = data["requirement"]
    assert req["product"] == "turmeric"
    assert req["quantity"] == 20000.0
    assert req["unit"] == "kg"
    assert req["origin_country"] == "India"
    assert req["destination_port"] == "Hamburg"
    assert "Organic" in req["certifications"]
    assert req["delivery_days"] == 45

    # Check products and suppliers returned
    assert isinstance(data["products"], list)
    assert isinstance(data["suppliers"], list)
    if len(data["suppliers"]) > 0:
        assert "match_score" in data["suppliers"][0]
        assert "match_reasons" in data["suppliers"][0]


@pytest.mark.asyncio
async def test_ai_search_history_and_admin_usage(async_client: AsyncClient):
    """Test GET /api/v1/ai/search/history and GET /api/v1/admin/ai/usage."""
    # 1. Post search
    await async_client.post(
        "/api/v1/ai/search",
        json={"query": "Need 50 MT Basmati rice 1121 steam from India to Dubai Jebel Ali CIF"},
    )

    # 2. History
    res_hist = await async_client.get("/api/v1/ai/search/history")
    assert res_hist.status_code == 200
    hist = res_hist.json()
    assert isinstance(hist, list)
    assert len(hist) >= 1
    assert "query" in hist[0]
    assert "results_count" in hist[0]

    # 3. Admin AI usage
    res_usage = await async_client.get("/api/v1/admin/ai/usage")
    assert res_usage.status_code == 200
    usage = res_usage.json()
    assert "summary" in usage
    assert "features" in usage
    assert usage["summary"]["total_calls"] >= 1
