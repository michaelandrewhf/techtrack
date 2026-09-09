from unittest.mock import patch

from django.db.utils import OperationalError


def test_liveness_does_not_require_database(client):
    response = client.get("/api/health/")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_readiness_confirms_database_connection(client):
    response = client.get("/api/ready/")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_readiness_returns_503_when_database_is_unavailable(client):
    with patch("config.api.connection.cursor", side_effect=OperationalError("database unavailable")):
        response = client.get("/api/ready/")

    assert response.status_code == 503
    assert response.json() == {"status": "unavailable"}
