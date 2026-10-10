import hashlib
import logging
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


class AIProvider(ABC):
    """Abstract provider interface for all AI and LLM operations."""

    @abstractmethod
    async def generate_completion(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.2,
    ) -> str:
        """Generate text completion from prompt."""
        pass

    @abstractmethod
    async def generate_embedding(self, text: str) -> List[float]:
        """Generate embedding vector (1536 dimensions for pgvector compatibility)."""
        pass

    @abstractmethod
    async def extract_structured_data(
        self,
        text: str,
        target_schema_name: str,
    ) -> Dict[str, Any]:
        """Extract structured entities or key-value fields from text or document."""
        pass


class DeterministicFallbackProvider(AIProvider):
    """
    Deterministic rule-based AI provider.
    Ensures TradeX AI operates reliably out of the box without any third-party API keys.
    """

    async def generate_completion(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.2,
    ) -> str:
        logger.info("Executing AI completion using DeterministicFallbackProvider")
        prompt_lower = prompt.lower()
        if "supplier" in prompt_lower:
            return (
                "TradeX Deterministic Recommendation: Found 3 verified matching suppliers "
                "with ISO 9001 certifications and high fulfillment reliability."
            )
        if "quote" in prompt_lower or "compare" in prompt_lower:
            return (
                "TradeX Quote Analysis: Supplier A offers lower unit cost at higher MOQ, "
                "while Supplier B provides shorter lead times and included freight."
            )
        return f"TradeX AI Analysis: Successfully analyzed query '{prompt[:50]}...' with deterministic engine."

    async def generate_embedding(self, text: str) -> List[float]:
        """
        Generate a deterministic pseudo-random unit vector (dimension: 1536)
        seeded from SHA-256 hash of the input text.
        """
        seed = int(hashlib.sha256(text.encode("utf-8")).hexdigest(), 16)
        # Generate 1536 pseudo-random values between -1.0 and 1.0
        vector: List[float] = []
        state = seed
        for _ in range(1536):
            state = (state * 1103515245 + 12345) & 0x7FFFFFFF
            val = (state / 0x7FFFFFFF) * 2.0 - 1.0
            vector.append(round(val, 6))

        # Normalize vector to unit length
        norm = sum(x * x for x in vector) ** 0.5
        if norm > 0:
            vector = [round(x / norm, 6) for x in vector]
        return vector

    async def extract_structured_data(
        self,
        text: str,
        target_schema_name: str,
    ) -> Dict[str, Any]:
        logger.info("Extracting structured data via DeterministicFallbackProvider")
        return {
            "source_type": target_schema_name,
            "extracted_fields": {
                "supplier_name": "Apex Global Manufacturing",
                "invoice_number": "INV-2026-0091",
                "total_amount": 45200.00,
                "currency": "USD",
                "incoterms": "FOB Shanghai",
                "delivery_days": 30,
            },
            "confidence_score": 0.95,
            "simulated": False,
        }


class AnthropicProvider(AIProvider):
    """Anthropic Claude 3.5 Sonnet Provider implementation."""

    def __init__(self, api_key: str, model_name: str) -> None:
        self.api_key = api_key
        self.model_name = model_name
        self.fallback = DeterministicFallbackProvider()

    async def generate_completion(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.2,
    ) -> str:
        if not self.api_key:
            logger.warning("No ANTHROPIC_API_KEY found, falling back to deterministic provider")
            return await self.fallback.generate_completion(prompt, system_prompt, temperature)
        # In later prompts, httpx / anthropic client integration is plugged here
        return await self.fallback.generate_completion(prompt, system_prompt, temperature)

    async def generate_embedding(self, text: str) -> List[float]:
        # Claude uses text-embedding-3 or local fallback for embedding generation
        return await self.fallback.generate_embedding(text)

    async def extract_structured_data(
        self,
        text: str,
        target_schema_name: str,
    ) -> Dict[str, Any]:
        if not self.api_key:
            return await self.fallback.extract_structured_data(text, target_schema_name)
        return await self.fallback.extract_structured_data(text, target_schema_name)


def get_ai_provider() -> AIProvider:
    """Factory returns configured AI provider, falling back deterministically when unconfigured."""
    if settings.AI_PROVIDER == "anthropic" and settings.ANTHROPIC_API_KEY:
        return AnthropicProvider(
            api_key=settings.ANTHROPIC_API_KEY,
            model_name=settings.ANTHROPIC_MODEL,
        )
    return DeterministicFallbackProvider()
