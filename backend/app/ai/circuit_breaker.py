import logging
import time
from enum import Enum
from typing import Optional

logger = logging.getLogger(__name__)


class CircuitState(str, Enum):
    CLOSED = "CLOSED"
    OPEN = "OPEN"
    HALF_OPEN = "HALF_OPEN"


class CircuitBreaker:
    """
    Circuit breaker for external LLM calls.
    After failure_threshold consecutive failures, opens the circuit for reset_timeout seconds,
    falling back to MockProvider.
    """

    def __init__(
        self,
        failure_threshold: int = 3,
        reset_timeout: float = 60.0,
    ) -> None:
        self.failure_threshold = failure_threshold
        self.reset_timeout = reset_timeout
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.last_failure_time: Optional[float] = None
        self.last_state_change: float = time.time()
        self.total_calls: int = 0
        self.total_successes: int = 0
        self.total_failures: int = 0
        self.rate_limit_errors: int = 0
        self.last_error: Optional[str] = None
        self.last_latency_ms: float = 0.0

    def is_open(self) -> bool:
        """Return True if circuit is open (calls should be bypassed to fallback)."""
        now = time.time()
        if self.state == CircuitState.OPEN:
            if self.last_failure_time and (now - self.last_failure_time >= self.reset_timeout):
                logger.info("Circuit breaker reset timeout elapsed. Transitioning from OPEN to HALF_OPEN.")
                self.state = CircuitState.HALF_OPEN
                self.last_state_change = now
                return False
            return True
        return False

    def record_success(self, latency_ms: float = 0.0) -> None:
        """Record successful call, resetting failure counts."""
        self.total_calls += 1
        self.total_successes += 1
        self.last_latency_ms = latency_ms
        if self.state != CircuitState.CLOSED:
            logger.info("Circuit breaker call succeeded. Transitioning to CLOSED.")
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.last_failure_time = None
        self.last_state_change = time.time()

    def record_failure(self, error: Optional[str] = None, is_rate_limit: bool = False) -> None:
        """Record a failed call. Trips circuit to OPEN if threshold reached."""
        now = time.time()
        self.total_calls += 1
        self.total_failures += 1
        self.failure_count += 1
        self.last_failure_time = now
        self.last_error = error
        if is_rate_limit:
            self.rate_limit_errors += 1

        if self.failure_count >= self.failure_threshold:
            if self.state != CircuitState.OPEN:
                logger.warning(
                    f"Circuit breaker tripped to OPEN after {self.failure_count} consecutive failures. "
                    f"Will fallback for {self.reset_timeout}s."
                )
            self.state = CircuitState.OPEN
            self.last_state_change = now

    def trip(self, reason: str = "Manually tripped for testing") -> None:
        """Explicitly trips the circuit breaker to OPEN."""
        self.state = CircuitState.OPEN
        self.last_failure_time = time.time()
        self.last_error = reason

    def reset(self) -> None:
        """Force reset circuit breaker to closed state (e.g. for testing)."""
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.last_failure_time = None
        self.last_error = None
        self.rate_limit_errors = 0
        self.last_state_change = time.time()

    def get_stats(self) -> dict:
        """Return diagnostic metrics for admin dashboard."""
        return {
            "state": self.state.value,
            "failure_count": self.failure_count,
            "failure_threshold": self.failure_threshold,
            "total_calls": self.total_calls,
            "total_successes": self.total_successes,
            "total_failures": self.total_failures,
            "rate_limit_errors": self.rate_limit_errors,
            "last_error": self.last_error,
            "last_latency_ms": round(self.last_latency_ms, 2),
            "is_tripped": self.state == CircuitState.OPEN,
        }


# Global singleton instance
circuit_breaker = CircuitBreaker()
