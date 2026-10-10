import hashlib
import json
import logging
import os
import re
import time
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

import httpx

from app.ai.models import LLMResponse
from app.core.config import settings

logger = logging.getLogger(__name__)


class LLMProvider(ABC):
    """Abstract interface for all LLM inference and embeddings."""

    @abstractmethod
    async def complete(
        self,
        system: str,
        messages: List[Dict[str, str]],
        json_schema: Optional[Dict[str, Any]] = None,
        max_tokens: int = 2048,
        temperature: float = 0.0,
    ) -> LLMResponse:
        """Generate text completion from system prompt and message history."""
        pass

    @abstractmethod
    async def embed(self, texts: List[str]) -> List[List[float]]:
        """Generate dense vector embeddings (1536 dimensions for pgvector compatibility)."""
        pass


class MockProvider(LLMProvider):
    """
    Deterministic rule-based Mock AI Provider.
    Used for unit testing, CI pipelines, and whenever no external API key is configured.
    Returns deterministic B2B trade structures labeled with 'Demo AI'.
    """

    def __init__(self) -> None:
        self.fixtures_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            "tests",
            "fixtures",
            "search_queries.json",
        )
        self._fixtures: List[Dict[str, Any]] = []
        self._load_fixtures()
        # For testing retries and failure injection
        self.simulated_invalid_json_count = 0
        self.simulated_network_failures_count = 0

    def _load_fixtures(self) -> None:
        if os.path.exists(self.fixtures_path):
            try:
                with open(self.fixtures_path, "r", encoding="utf-8") as f:
                    self._fixtures = json.load(f)
            except Exception as e:
                logger.warning(f"Could not load search fixtures: {e}")

    async def complete(
        self,
        system: str,
        messages: List[Dict[str, str]],
        json_schema: Optional[Dict[str, Any]] = None,
        max_tokens: int = 2048,
        temperature: float = 0.0,
    ) -> LLMResponse:
        t0 = time.time()

        # Check for simulated failures (for circuit breaker & retry tests)
        if self.simulated_network_failures_count > 0:
            self.simulated_network_failures_count -= 1
            raise RuntimeError("Simulated network outage to LLM vendor API")

        if self.simulated_invalid_json_count > 0:
            self.simulated_invalid_json_count -= 1
            latency = (time.time() - t0) * 1000
            return LLMResponse(
                content="[Invalid JSON: { corrupted_token: ",
                raw_json=None,
                prompt_tokens=45,
                completion_tokens=10,
                total_tokens=55,
                latency_ms=latency,
                model="mock-rule-engine-v1",
                provider="mock",
                is_mock=True,
            )

        # Extract user prompt containing the input query
        prompt_text = ""
        for m in messages:
            if m.get("role") == "user":
                c = m.get("content", "")
                if "<untrusted_input>" in c:
                    prompt_text = c
                    break
        if not prompt_text and messages:
            prompt_text = messages[0].get("content", "")

        res_json = self._extract_search_requirement(prompt_text)
        content_str = json.dumps(res_json, indent=2)
        latency = (time.time() - t0) * 1000

        return LLMResponse(
            content=content_str,
            raw_json=res_json,
            prompt_tokens=len(prompt_text) // 4 + 100,
            completion_tokens=len(content_str) // 4,
            total_tokens=(len(prompt_text) + len(content_str)) // 4 + 100,
            latency_ms=latency,
            model="mock-rule-engine-v1",
            provider="mock",
            is_mock=True,
        )

    def _extract_search_requirement(self, text: str) -> Dict[str, Any]:
        """Match against 10 fixtures or apply heuristic trade entity extractor."""
        # Clean text: extract content inside the last <untrusted_input> block if present
        clean_text = text.lower()
        matches = re.findall(r"<untrusted_input>\s*(.*?)\s*</untrusted_input>", text, re.DOTALL)
        if matches:
            clean_text = matches[-1].strip().lower()

        # 1. Exact or partial match in fixtures
        for fix in self._fixtures:
            q_expected = fix["query"].lower().strip()
            if q_expected in clean_text or clean_text in q_expected or q_expected in text.lower():
                exp = fix["expected"].copy()
                exp["confidence"] = {k: 0.98 for k in exp.keys()}
                exp["other_constraints"] = ["Standard verified export specification", "Demo AI Extracted"]
                return exp

        # 2. Fixed turmeric reference check
        if "turmeric" in clean_text or "turmeric" in text.lower():
            return {
                "product": "turmeric",
                "category": "Spices & Herbs",
                "quantity": 20000.0,
                "unit": "kg",
                "origin_country": "India",
                "destination_country": "Germany",
                "destination_port": "Hamburg",
                "certifications": ["Organic"],
                "currency": "USD",
                "delivery_days": 45,
                "incoterm": "CIF",
                "other_constraints": ["Demo AI"],
                "confidence": {
                    "product": 0.99,
                    "quantity": 0.98,
                    "origin_country": 0.98,
                    "destination_port": 0.95,
                    "certifications": 0.95,
                    "delivery_days": 0.95,
                },
            }

        # 3. Rule-based heuristic extraction for any other query
        # Product
        product = "General Commodities"
        category = "General Trade"
        if "rice" in clean_text:
            product = "Basmati Rice"
            category = "Grains & Cereals"
        elif "pepper" in clean_text:
            product = "Black Pepper"
            category = "Spices & Herbs"
        elif "ginger" in clean_text:
            product = "Fresh Ginger"
            category = "Spices & Herbs"
        elif "cardamom" in clean_text:
            product = "Green Cardamom"
            category = "Spices & Herbs"
        elif "cotton" in clean_text or "yarn" in clean_text:
            product = "Cotton Yarn"
            category = "Textiles & Apparel"
        elif "auto" in clean_text or "cnc" in clean_text:
            product = "CNC Auto Components"
            category = "Auto Components & Industrial"
        elif "solar" in clean_text or "panel" in clean_text:
            product = "Solar Panels"
            category = "Renewable Energy & Solar"
        elif "coffee" in clean_text:
            product = "Arabica Coffee"
            category = "Coffee & Tea"

        # Quantity
        qty: Optional[float] = None
        unit = "kg"
        qty_match = re.search(r"(\d+(?:,\d+)*(?:\.\d+)?)\s*(tons?|tonnes?|mt|kg|units?|lbs)", clean_text)
        if qty_match:
            val = float(qty_match.group(1).replace(",", ""))
            u_str = qty_match.group(2).lower()
            if "ton" in u_str:
                qty = val * 1000.0
                unit = "kg"
            elif u_str == "mt":
                qty = val
                unit = "MT"
            else:
                qty = val
                unit = u_str

        # Countries
        origin: Optional[str] = None
        destination: Optional[str] = None
        if "from india" in clean_text or "in india" in clean_text:
            origin = "India"
        elif "from germany" in clean_text:
            origin = "Germany"
        elif "from vietnam" in clean_text:
            origin = "Vietnam"

        if "to germany" in clean_text or "hamburg" in clean_text:
            destination = "Germany"
        elif "to usa" in clean_text or "detroit" in clean_text or "california" in clean_text:
            destination = "United States"
        elif "to uae" in clean_text or "dubai" in clean_text:
            destination = "United Arab Emirates"
        elif "to uk" in clean_text or "london" in clean_text:
            destination = "United Kingdom"
        elif "to netherlands" in clean_text or "rotterdam" in clean_text:
            destination = "Netherlands"
        elif "to saudi" in clean_text or "dammam" in clean_text:
            destination = "Saudi Arabia"

        port: Optional[str] = None
        for p in ["Hamburg", "Rotterdam", "Dubai", "Jebel Ali", "Detroit", "New York", "London", "Dammam", "Felixstowe"]:
            if p.lower() in clean_text:
                port = p
                break

        # Certifications
        certs: List[str] = []
        if "organic" in clean_text:
            certs.append("Organic")
        if "iso" in clean_text:
            certs.append("ISO 9001")
        if "haccp" in clean_text:
            certs.append("HACCP")
        if "globalgap" in clean_text:
            certs.append("GlobalGAP")
        if "ce" in clean_text:
            certs.append("CE")

        # Delivery days
        delivery: Optional[int] = None
        days_match = re.search(r"(\d+)\s*days", clean_text)
        if days_match:
            delivery = int(days_match.group(1))

        # Incoterms
        incoterm: Optional[str] = None
        for it in ["CIF", "FOB", "CFR", "DDP", "EXW"]:
            if it.lower() in clean_text:
                incoterm = it
                break

        return {
            "product": product,
            "category": category,
            "quantity": qty,
            "unit": unit,
            "origin_country": origin,
            "destination_country": destination,
            "destination_port": port,
            "certifications": certs,
            "currency": "USD",
            "delivery_days": delivery,
            "incoterm": incoterm,
            "other_constraints": ["Demo AI Extracted"],
            "confidence": {
                "product": 0.95,
                "quantity": 0.90 if qty else 0.0,
                "origin_country": 0.90 if origin else 0.0,
                "destination_country": 0.90 if destination else 0.0,
            },
        }

    async def embed(self, texts: List[str]) -> List[List[float]]:
        """Generate deterministic pseudo-random unit vectors (dimension: 1536)."""
        results: List[List[float]] = []
        for text in texts:
            seed = int(hashlib.sha256(text.encode("utf-8")).hexdigest(), 16)
            vector: List[float] = []
            state = seed
            for _ in range(1536):
                state = (state * 1103515245 + 12345) & 0x7FFFFFFF
                val = (state / 0x7FFFFFFF) * 2.0 - 1.0
                vector.append(round(val, 6))

            norm = sum(x * x for x in vector) ** 0.5
            if norm > 0:
                vector = [round(x / norm, 6) for x in vector]
            results.append(vector)
        return results


class ClaudeProvider(LLMProvider):
    """
    Anthropic Claude 3.5 Sonnet Provider.
    Calls Anthropic API directly with strict JSON schema instructions and timeouts.
    """

    def __init__(
        self,
        api_key: str,
        model_name: str = "claude-3-5-sonnet-20241022",
        timeout_seconds: float = 20.0,
    ) -> None:
        self.api_key = api_key
        self.model_name = model_name
        self.timeout_seconds = timeout_seconds
        self.mock_fallback = MockProvider()

    async def complete(
        self,
        system: str,
        messages: List[Dict[str, str]],
        json_schema: Optional[Dict[str, Any]] = None,
        max_tokens: int = 2048,
        temperature: float = 0.0,
    ) -> LLMResponse:
        t0 = time.time()
        if not self.api_key:
            logger.info("No ANTHROPIC_API_KEY configured; utilizing MockProvider with 'Demo AI' label.")
            resp = await self.mock_fallback.complete(system, messages, json_schema, max_tokens, temperature)
            resp.fallback = True
            return resp

        # Construct system prompt with strict JSON schema directive if provided
        final_system = system
        if json_schema:
            schema_str = json.dumps(json_schema, indent=2)
            final_system += (
                f"\n\nCRITICAL INSTRUCTION: You MUST return strictly valid JSON matching this schema.\n"
                f"Do not include markdown code block backticks (```json), commentary, or extra text.\n"
                f"JSON Schema:\n{schema_str}"
            )

        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }

        payload = {
            "model": self.model_name,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "system": final_system,
            "messages": messages,
        }

        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            resp = await client.post("https://api.anthropic.com/v1/messages", headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()

        latency = (time.time() - t0) * 1000

        # Extract text content
        raw_text = ""
        for block in data.get("content", []):
            if block.get("type") == "text":
                raw_text += block.get("text", "")

        raw_text = raw_text.strip()
        # Strip ```json if model wrapped it
        if raw_text.startswith("```"):
            raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text)
            raw_text = re.sub(r"\s*```$", "", raw_text)

        parsed_json: Optional[Dict[str, Any]] = None
        try:
            parsed_json = json.loads(raw_text)
        except Exception:
            pass

        usage = data.get("usage", {})
        prompt_tokens = usage.get("input_tokens", 0)
        completion_tokens = usage.get("output_tokens", 0)

        return LLMResponse(
            content=raw_text,
            raw_json=parsed_json,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens,
            latency_ms=latency,
            model=self.model_name,
            provider="anthropic",
            fallback=False,
            is_mock=False,
        )

    async def embed(self, texts: List[str]) -> List[List[float]]:
        # Anthropic provides completions; use normalized mock embeddings for pgvector compatibility
        return await self.mock_fallback.embed(texts)
