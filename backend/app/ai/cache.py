import hashlib
import json
import time
from typing import Any, Dict, Optional


class AICache:
    """
    In-memory response cache keyed by prompt name and SHA-256 hash of input variables.
    """

    def __init__(self, default_ttl_seconds: int = 300) -> None:
        self.default_ttl = default_ttl_seconds
        self._store: Dict[str, Dict[str, Any]] = {}

    def _make_key(self, prompt_name: str, variables: Dict[str, Any]) -> str:
        serialized = json.dumps(variables, sort_keys=True, default=str)
        payload = f"{prompt_name}:{serialized}"
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    def get(self, prompt_name: str, variables: Dict[str, Any]) -> Optional[Any]:
        key = self._make_key(prompt_name, variables)
        item = self._store.get(key)
        if not item:
            return None

        # Check expiration
        if time.time() > item["expires_at"]:
            del self._store[key]
            return None

        return item["value"]

    def set(
        self,
        prompt_name: str,
        variables: Dict[str, Any],
        value: Any,
        ttl_seconds: Optional[int] = None,
    ) -> None:
        key = self._make_key(prompt_name, variables)
        ttl = ttl_seconds if ttl_seconds is not None else self.default_ttl
        self._store[key] = {
            "value": value,
            "expires_at": time.time() + ttl,
        }

    def clear(self) -> None:
        self._store.clear()


ai_cache = AICache()
