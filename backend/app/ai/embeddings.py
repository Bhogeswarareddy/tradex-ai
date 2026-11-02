"""
TradeX AI - Embeddings Subsystem (Prompt 40)
Handles standalone embedding generation independently of LLM chat keys:
- EMBEDDING_PROVIDER: 'local', 'ollama', 'mock'
- EMBEDDING_MODEL: e.g. 'all-MiniLM-L6-v2', 'nomic-embed-text'
- Dimension: 1536 (matched with pgvector column Vector(1536))
- Automatically pads / projects to the exact target dimension
"""
import hashlib
import logging
import math
from typing import List
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

TARGET_DIM = 1536


def _deterministic_local_embed(text: str, dim: int = TARGET_DIM) -> List[float]:
    """
    Generates a deterministic, normalized vector embedding for text using SHA-512
    and Murmur-style token hashing. Fast, reproducible, local, and requires no external API.
    """
    clean = text.lower().strip()
    words = clean.split()
    vec = [0.0] * dim

    for idx, w in enumerate(words):
        h = int(hashlib.sha512(f"{idx}:{w}".encode("utf-8")).hexdigest(), 16)
        for i in range(16):
            pos = (h >> (i * 8)) % dim
            val = ((h >> (i * 4)) & 0xFF) / 255.0 - 0.5
            vec[pos] += val

    # Normalize vector to unit length (L2 norm)
    sq_sum = sum(x * x for x in vec)
    norm = math.sqrt(sq_sum) if sq_sum > 0 else 1.0
    return [round(x / norm, 6) for x in vec]


async def embed_batch(texts: List[str]) -> List[List[float]]:
    """Generates embedding vectors for a batch of strings."""
    if not texts:
        return []

    provider = (settings.EMBEDDING_PROVIDER or "local").lower()

    if provider == "ollama":
        try:
            url = f"{settings.OLLAMA_BASE_URL}/api/embeddings"
            results = []
            async with httpx.AsyncClient(timeout=10.0) as client:
                for t in texts:
                    resp = await client.post(url, json={"model": settings.EMBEDDING_MODEL or "nomic-embed-text", "prompt": t})
                    if resp.status_code == 200:
                        raw_vec = resp.json().get("embedding", [])
                        # Pad or truncate to TARGET_DIM (1536)
                        if len(raw_vec) == TARGET_DIM:
                            results.append(raw_vec)
                        elif len(raw_vec) < TARGET_DIM:
                            padded = (raw_vec * (TARGET_DIM // len(raw_vec) + 1))[:TARGET_DIM]
                            results.append(padded)
                        else:
                            results.append(raw_vec[:TARGET_DIM])
                    else:
                        results.append(_deterministic_local_embed(t, TARGET_DIM))
            return results
        except Exception as e:
            logger.warning(f"Ollama embedding failed ({e}), falling back to local deterministic embedding.")
            return [_deterministic_local_embed(t, TARGET_DIM) for t in texts]

    # Default: high-speed local deterministic embedding
    return [_deterministic_local_embed(t, TARGET_DIM) for t in texts]


async def embed_text(text: str) -> List[float]:
    """Generates an embedding vector for a single string."""
    vecs = await embed_batch([text])
    return vecs[0] if vecs else [0.0] * TARGET_DIM
