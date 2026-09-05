from django.contrib.auth import get_user_model
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
