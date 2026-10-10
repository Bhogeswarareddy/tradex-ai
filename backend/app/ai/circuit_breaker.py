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

    def record_success(self) -> None:
        """Record successful call, resetting failure counts."""
        if self.state != CircuitState.CLOSED:
            logger.info("Circuit breaker call succeeded. Transitioning to CLOSED.")
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.last_failure_time = None
        self.last_state_change = time.time()

    def record_failure(self) -> None:
        """Record a failed call. Trips circuit to OPEN if threshold reached."""
        now = time.time()
        self.failure_count += 1
        self.last_failure_time = now

        if self.failure_count >= self.failure_threshold:
            if self.state != CircuitState.OPEN:
                logger.warning(
                    f"Circuit breaker tripped to OPEN after {self.failure_count} consecutive failures. "
                    f"Will fallback for {self.reset_timeout}s."
                )
            self.state = CircuitState.OPEN
            self.last_state_change = now

    def reset(self) -> None:
        """Force reset circuit breaker to closed state (e.g. for testing)."""
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.last_failure_time = None
        self.last_state_change = time.time()


# Global singleton instance
circuit_breaker = CircuitBreaker()
