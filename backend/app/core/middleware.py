import time
import uuid
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.logging import logger, request_id_ctx


class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    Middleware that attaches a unique X-Request-ID header to every request/response
    and binds it to the logging contextvar.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Honor incoming request ID or generate a fresh UUID4
        request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex
        token = request_id_ctx.set(request_id)

        start_time = time.perf_counter()
        try:
            response = await call_next(request)
            process_time = (time.perf_counter() - start_time) * 1000.0
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Process-Time"] = f"{process_time:.2f}ms"
            return response
        finally:
            request_id_ctx.reset(token)
