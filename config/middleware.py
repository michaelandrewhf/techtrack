import logging
import re
import time
import uuid

from django.conf import settings
from django.http import HttpRequest, HttpResponse

REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]{1,128}$")
request_logger = logging.getLogger("techtrack.request")
ROUTINE_HEALTH_PATHS = {"/api/health/", "/api/ready/"}


def normalize_request_id(value: str | None) -> str:
    if value:
        candidate = value.strip()
        if REQUEST_ID_PATTERN.fullmatch(candidate):
            return candidate
    return uuid.uuid4().hex


class RequestObservabilityMiddleware:
    """Attach a safe request id and emit one metadata-only log per response."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        request_id = normalize_request_id(request.headers.get("X-Request-ID"))
        request.request_id = request_id
        started_at = time.perf_counter()

        response = self.get_response(request)
        duration_ms = round((time.perf_counter() - started_at) * 1000, 2)
        response["X-Request-ID"] = request_id

        if request.path in ROUTINE_HEALTH_PATHS and not getattr(settings, "OBSERVABILITY_LOG_HEALTH", False):
            return response

        status_code = response.status_code
        if status_code >= 500:
            level = logging.ERROR
        elif status_code >= 400:
            level = logging.WARNING
        else:
            level = logging.INFO

        request_logger.log(
            level,
            "HTTP request completed",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.path,
                "status_code": status_code,
                "duration_ms": duration_ms,
            },
        )
        return response
