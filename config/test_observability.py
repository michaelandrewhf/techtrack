import json
import logging

import pytest
from django.http import HttpResponse
from django.test import RequestFactory

from config.logging import JsonFormatter
from config.middleware import RequestObservabilityMiddleware, normalize_request_id


def test_json_formatter_emits_structured_request_metadata():
    record = logging.LogRecord(
        name="techtrack.request",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="HTTP request completed",
        args=(),
        exc_info=None,
    )
    record.request_id = "trace-123"
    record.method = "GET"
    record.path = "/api/health/"
    record.status_code = 200
    record.duration_ms = 12.34

    payload = json.loads(JsonFormatter().format(record))

    assert payload["level"] == "INFO"
    assert payload["logger"] == "techtrack.request"
    assert payload["message"] == "HTTP request completed"
    assert payload["request_id"] == "trace-123"
    assert payload["method"] == "GET"
    assert payload["path"] == "/api/health/"
    assert payload["status_code"] == 200
    assert payload["duration_ms"] == 12.34
    assert payload["timestamp"].endswith("Z")


def test_request_observability_middleware_preserves_safe_request_id(caplog):
    request = RequestFactory().get("/api/health/?token=must-not-be-logged", HTTP_X_REQUEST_ID="trace-123")
    middleware = RequestObservabilityMiddleware(lambda _: HttpResponse("ok"))

    with caplog.at_level(logging.INFO, logger="techtrack.request"):
        response = middleware(request)

    assert response["X-Request-ID"] == "trace-123"
    record = next(record for record in caplog.records if record.name == "techtrack.request")
    assert record.request_id == "trace-123"
    assert record.method == "GET"
    assert record.path == "/api/health/"
    assert record.status_code == 200
    assert "must-not-be-logged" not in record.getMessage()


@pytest.mark.parametrize(
    "unsafe_value",
    ["bad request id", "line\nbreak", "x" * 129],
)
def test_normalize_request_id_rejects_unsafe_values(unsafe_value):
    generated = normalize_request_id(unsafe_value)

    assert generated != unsafe_value
    assert len(generated) == 32
    int(generated, 16)
