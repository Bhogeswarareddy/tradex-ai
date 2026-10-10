import pytest
from app.ai.provider import DeterministicFallbackProvider, get_ai_provider


@pytest.mark.asyncio
async def test_deterministic_ai_provider():
    provider = DeterministicFallbackProvider()

    # Test completion
    completion = await provider.generate_completion("Find me supplier for industrial steel")
    assert "TradeX Deterministic Recommendation" in completion

    # Test embedding generation (must be 1536 floats)
    embedding = await provider.generate_embedding("Precision CNC machining parts")
    assert len(embedding) == 1536
    assert isinstance(embedding[0], float)

    # Test structured data extraction
    extracted = await provider.extract_structured_data("Invoice text sample", "invoice")
    assert "extracted_fields" in extracted
    assert extracted["extracted_fields"]["supplier_name"] == "Apex Global Manufacturing"


@pytest.mark.asyncio
async def test_get_ai_provider_factory():
    provider = get_ai_provider()
    assert provider is not None
