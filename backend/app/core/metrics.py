"""Prometheus metrics collectors and exposition for TradeX AI platform."""

from prometheus_client import (
    CONTENT_TYPE_LATEST,
    Counter,
    Gauge,
    Histogram,
    generate_latest,
)
from starlette.responses import Response

# 1. HTTP Request Metrics
HTTP_REQUESTS_TOTAL = Counter(
    "tradex_http_requests_total",
    "Total count of HTTP requests processed by TradeX backend",
    ["method", "endpoint", "status_code"],
)

HTTP_REQUEST_DURATION_SECONDS = Histogram(
    "tradex_http_request_duration_seconds",
    "HTTP request latency in seconds",
    ["method", "endpoint"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
)

HTTP_ERRORS_TOTAL = Counter(
    "tradex_http_errors_total",
    "Total count of HTTP 4xx and 5xx errors by endpoint",
    ["endpoint", "error_type"],
)

# 2. AI Inference & Copilot Metrics
AI_CALLS_TOTAL = Counter(
    "tradex_ai_calls_total",
    "Total count of AI service invocations (LLM, RAG, Translation, Fraud, Extraction)",
    ["feature", "status"],
)

# 3. Connection and Queue Metrics
ACTIVE_WS_CONNECTIONS = Gauge(
    "tradex_active_ws_connections",
    "Number of active WebSocket connections on /ws",
)

BACKGROUND_QUEUE_SIZE = Gauge(
    "tradex_background_queue_size",
    "Estimated queue size for asynchronous background tasks",
    ["queue_name"],
)


def get_metrics_response() -> Response:
    """Returns the latest Prometheus exposition metrics format."""
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST,
    )
