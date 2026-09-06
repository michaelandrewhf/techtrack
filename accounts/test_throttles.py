from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APIClient

from accounts.api.throttles import LoginRateThrottle, PasswordResetRateThrottle


def test_login_endpoint_is_throttled_after_repeated_attempts(db):
    get_user_model().objects.create_user(username="throttle-user", password="CorrectPassword!2026")
    client = APIClient()
    cache.clear()

    with patch.object(LoginRateThrottle, "rate", "2/min", create=True):
        for _ in range(2):
            response = client.post(
                "/api/token/",
                {"username": "throttle-user", "password": "wrong-password"},
                format="json",
            )
            assert response.status_code == 401

        throttled = client.post(
            "/api/token/",
            {"username": "throttle-user", "password": "wrong-password"},
            format="json",
        )

    assert throttled.status_code == 429
    cache.clear()


def test_password_reset_endpoint_is_throttled(db):
    client = APIClient()
    cache.clear()

    with patch.object(PasswordResetRateThrottle, "rate", "2/min", create=True):
        for index in range(2):
            response = client.post(
                "/api/v1/auth/password-reset/",
                {"email": f"missing-{index}@example.com"},
                format="json",
            )
            assert response.status_code == 200

        throttled = client.post(
            "/api/v1/auth/password-reset/",
            {"email": "missing-3@example.com"},
            format="json",
        )

    assert throttled.status_code == 429
    cache.clear()
