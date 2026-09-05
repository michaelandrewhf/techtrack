import re
from datetime import datetime, timedelta
from unittest.mock import patch
from urllib.parse import urlparse

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import override_settings
from rest_framework.test import APIClient


def test_custom_user_uses_uuid(db):
    user = get_user_model().objects.create_user(username="tech", password="password")

    assert user.id
    assert str(user._meta.pk.__class__.__name__) == "UUIDField"


def test_authenticated_user_can_get_and_update_own_profile(db):
    user = get_user_model().objects.create_user(
        username="tech",
        password="password",
        first_name="Nome antigo",
        email="old@example.com",
    )
    client = APIClient()
    client.force_authenticate(user=user)

    response = client.get("/api/v1/me/")
    assert response.status_code == 200
    assert response.data["username"] == "tech"

    response = client.patch(
        "/api/v1/me/",
        {
            "username": "michael",
            "first_name": "Michael",
            "last_name": "Andrew",
            "email": "michael@example.com",
        },
        format="json",
    )
    assert response.status_code == 200, response.data
    assert response.data["username"] == "michael"
    assert response.data["first_name"] == "Michael"

    user.refresh_from_db()
    assert user.username == "michael"
    assert user.last_name == "Andrew"
    assert user.email == "michael@example.com"


def test_profile_update_rejects_duplicate_username(db):
    user_model = get_user_model()
    user = user_model.objects.create_user(username="tech", password="password")
    user_model.objects.create_user(username="existing", password="password")
    client = APIClient()
    client.force_authenticate(user=user)

    response = client.patch("/api/v1/me/", {"username": "existing"}, format="json")

    assert response.status_code == 400
    assert "username" in response.data


def _create_reset_user():
    return get_user_model().objects.create_user(
        username="reset-user",
        password="OldPassword!2026",
        email="user@example.com",
        first_name="Michael",
    )


def _request_reset(client, email="user@example.com"):
    return client.post(
        "/api/v1/auth/password-reset/",
        {"email": email},
        format="json",
    )


def _reset_credentials_from_outbox():
    match = re.search(r"https?://\S+", mail.outbox[-1].body)
    assert match is not None
    path_parts = urlparse(match.group(0)).path.rstrip("/").split("/")
    return path_parts[-2], path_parts[-1]


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    FRONTEND_URL="https://app.techtrack.test",
)
def test_password_reset_request_sends_frontend_link_without_revealing_account(db):
    _create_reset_user()
    client = APIClient()

    existing_response = _request_reset(client)
    missing_response = _request_reset(client, "missing@example.com")

    assert existing_response.status_code == 200
    assert missing_response.status_code == 200
    assert existing_response.data == missing_response.data
    assert len(mail.outbox) == 1
    assert "Redefinicao de senha" in mail.outbox[0].subject
    assert "https://app.techtrack.test/reset-password/" in mail.outbox[0].body


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    FRONTEND_URL="https://app.techtrack.test",
)
def test_password_reset_confirm_changes_password_and_invalidates_used_token(db):
    user = _create_reset_user()
    client = APIClient()
    _request_reset(client)
    uid, token = _reset_credentials_from_outbox()

    payload = {
        "uid": uid,
        "token": token,
        "new_password": "NewSecurePassword!2026",
        "confirm_password": "NewSecurePassword!2026",
    }
    response = client.post("/api/v1/auth/password-reset/confirm/", payload, format="json")

    assert response.status_code == 200
    user.refresh_from_db()
    assert user.check_password("NewSecurePassword!2026")

    reused = client.post("/api/v1/auth/password-reset/confirm/", payload, format="json")
    assert reused.status_code == 400
    assert "token" in reused.data


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    FRONTEND_URL="https://app.techtrack.test",
)
def test_password_reset_rejects_invalid_token(db):
    _create_reset_user()
    client = APIClient()
    _request_reset(client)
    uid, _ = _reset_credentials_from_outbox()

    response = client.post(
        "/api/v1/auth/password-reset/confirm/",
        {
            "uid": uid,
            "token": "invalid-token",
            "new_password": "NewSecurePassword!2026",
            "confirm_password": "NewSecurePassword!2026",
        },
        format="json",
    )

    assert response.status_code == 400
    assert "token" in response.data


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    FRONTEND_URL="https://app.techtrack.test",
    PASSWORD_RESET_TIMEOUT=3600,
)
def test_password_reset_rejects_expired_token(db):
    _create_reset_user()
    client = APIClient()
    _request_reset(client)
    uid, token = _reset_credentials_from_outbox()

    future = datetime.now() + timedelta(seconds=3601)
    with patch(
        "django.contrib.auth.tokens.PasswordResetTokenGenerator._now",
        return_value=future,
    ):
        response = client.post(
            "/api/v1/auth/password-reset/confirm/",
            {
                "uid": uid,
                "token": token,
                "new_password": "NewSecurePassword!2026",
                "confirm_password": "NewSecurePassword!2026",
            },
            format="json",
        )

    assert response.status_code == 400
    assert "token" in response.data


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    FRONTEND_URL="https://app.techtrack.test",
)
def test_password_reset_rejects_mismatched_passwords(db):
    _create_reset_user()
    client = APIClient()
    _request_reset(client)
    uid, token = _reset_credentials_from_outbox()

    response = client.post(
        "/api/v1/auth/password-reset/confirm/",
        {
            "uid": uid,
            "token": token,
            "new_password": "NewSecurePassword!2026",
            "confirm_password": "AnotherSecurePassword!2026",
        },
        format="json",
    )

    assert response.status_code == 400
    assert "confirm_password" in response.data


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    FRONTEND_URL="https://app.techtrack.test",
)
def test_password_reset_uses_django_password_validators(db):
    _create_reset_user()
    client = APIClient()
    _request_reset(client)
    uid, token = _reset_credentials_from_outbox()

    response = client.post(
        "/api/v1/auth/password-reset/confirm/",
        {
            "uid": uid,
            "token": token,
            "new_password": "12345678",
            "confirm_password": "12345678",
        },
        format="json",
    )

    assert response.status_code == 400
    assert "new_password" in response.data
