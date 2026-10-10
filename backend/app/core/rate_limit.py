import time
from collections import defaultdict, deque
from typing import Dict
from fastapi import Request

from app.core.errors import AppException


class InMemoryRateLimiter:
    """Sliding-window rate limiter per client IP."""

    def __init__(self, max_requests: int = 5, window_seconds: int = 60) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.storage: Dict[str, deque] = defaultdict(deque)

    def check(self, key: str) -> None:
        now = time.time()
        timestamps = self.storage[key]

        # Prune expired timestamps outside current window
        while timestamps and timestamps[0] <= now - self.window_seconds:
            timestamps.popleft()

        if len(timestamps) >= self.max_requests:
            raise AppException(
                message=f"Rate limit exceeded. Maximum {self.max_requests} attempts per minute.",
                code="RATE_LIMIT_EXCEEDED",
                status_code=429,
                details={"retry_after_seconds": int(self.window_seconds - (now - timestamps[0]))},
            )

        timestamps.append(now)

    def reset(self) -> None:
        """Resets rate limit records (useful for test suites)."""
        self.storage.clear()


auth_limiter = InMemoryRateLimiter(max_requests=5, window_seconds=60)


async def rate_limit_auth(request: Request) -> None:
    """FastAPI dependency to rate limit sensitive authentication routes per IP."""
    # Obtain client IP, respecting proxy forwarded headers
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()
    else:
        client_ip = request.client.host if request.client else "unknown"

    auth_limiter.check(client_ip)
