import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_profile_exposes_superuser_flag_and_superuser_can_manage_settings():
    user = get_user_model().objects.create_user(
        username="root-without-staff",
        password="secret123",
        is_staff=False,
        is_superuser=True,
    )
    client = APIClient()
    client.force_authenticate(user=user)

    profile = client.get("/api/v1/me/")
    assert profile.status_code == 200
    assert profile.json()["is_superuser"] is True

    catalog = client.post(
        "/api/v1/equipment-types/",
        {"name": "Servidor de teste", "slug": "server-superuser-test"},
        format="json",
    )
    assert catalog.status_code == 201

    business = client.patch(
        "/api/v1/business-profile/",
        {"name": "TechTrack Admin"},
        format="json",
    )
    assert business.status_code == 200
    assert business.json()["name"] == "TechTrack Admin"
