from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken


def _create_user():
    return get_user_model().objects.create_user(
        username="session-user",
        password="SecurePassword!2026",
    )


def _login(client: APIClient):
    return client.post(
        "/api/token/",
        {"username": "session-user", "password": "SecurePassword!2026"},
        format="json",
    )


def test_login_returns_only_access_token_and_sets_http_only_refresh_cookie(db):
    _create_user()
    client = APIClient()

    response = _login(client)

    assert response.status_code == 200
    assert "access" in response.data
    assert "refresh" not in response.data

    cookie = response.cookies[settings.AUTH_REFRESH_COOKIE_NAME]
    assert cookie.value
    assert cookie["httponly"] is True
    assert cookie["path"] == "/api/token/"
    assert cookie["samesite"] == "Lax"
    assert int(cookie["max-age"]) == settings.AUTH_REFRESH_COOKIE_MAX_AGE


def test_refresh_uses_http_only_cookie_without_request_body(db):
    _create_user()
    client = APIClient()
    login = _login(client)
    assert login.status_code == 200

    response = client.post("/api/token/refresh/", {}, format="json")

    assert response.status_code == 200
    assert "access" in response.data
    assert "refresh" not in response.data


def test_refresh_token_in_request_body_is_not_accepted_without_cookie(db):
    user = _create_user()
    refresh = str(RefreshToken.for_user(user))
    client = APIClient()

    response = client.post(
        "/api/token/refresh/",
        {"refresh": refresh},
        format="json",
    )

    assert response.status_code == 401
    assert response.data["code"] == "refresh_cookie_missing"


def test_logout_clears_refresh_cookie_and_prevents_future_refresh(db):
    _create_user()
    client = APIClient()
    login = _login(client)
    assert login.status_code == 200

    logout = client.post("/api/token/logout/", {}, format="json")

    assert logout.status_code == 204
    cleared_cookie = logout.cookies[settings.AUTH_REFRESH_COOKIE_NAME]
    assert int(cleared_cookie["max-age"]) == 0

    refresh = client.post("/api/token/refresh/", {}, format="json")
    assert refresh.status_code == 401


@override_settings(AUTH_REFRESH_COOKIE_SECURE=True)
def test_refresh_cookie_is_secure_when_configured(db):
    _create_user()
    client = APIClient()

    response = _login(client)

    assert response.status_code == 200
    assert response.cookies[settings.AUTH_REFRESH_COOKIE_NAME]["secure"] is True
