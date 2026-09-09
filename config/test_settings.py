import pytest
from django.core.exceptions import ImproperlyConfigured

from config import settings as techtrack_settings


def set_postgres_environment(monkeypatch, password="safe-password"):
    monkeypatch.setenv("POSTGRES_HOST", "db")
    monkeypatch.setenv("POSTGRES_DB", "techtrack")
    monkeypatch.setenv("POSTGRES_USER", "techtrack")
    monkeypatch.setenv("POSTGRES_PASSWORD", password)


def test_database_config_preserves_reserved_password_characters(monkeypatch):
    password = "p@ss/with?reserved#chars:2026"
    monkeypatch.delenv("DATABASE_URL", raising=False)
    set_postgres_environment(monkeypatch, password=password)
    monkeypatch.setenv("POSTGRES_PORT", "5432")

    config = techtrack_settings.database_config()

    assert config["ENGINE"] == "django.db.backends.postgresql"
    assert config["HOST"] == "db"
    assert config["PASSWORD"] == password
    assert config["PORT"] == "5432"


def test_production_validation_rejects_insecure_external_frontend(monkeypatch):
    set_postgres_environment(monkeypatch)
    monkeypatch.setattr(techtrack_settings, "PRODUCTION_MODE", True)
    monkeypatch.setattr(techtrack_settings, "DEBUG", False)
    monkeypatch.setattr(techtrack_settings, "ALLOWED_HOSTS", ["techtrack.example.com"])
    monkeypatch.setattr(techtrack_settings, "FRONTEND_URL", "http://techtrack.example.com")
    monkeypatch.setattr(techtrack_settings, "TRUST_X_FORWARDED_PROTO", False)
    monkeypatch.setattr(techtrack_settings, "SECURE_SSL_REDIRECT", False)
    monkeypatch.setattr(techtrack_settings, "SESSION_COOKIE_SECURE", False)
    monkeypatch.setattr(techtrack_settings, "CSRF_COOKIE_SECURE", False)
    monkeypatch.setattr(techtrack_settings, "AUTH_REFRESH_COOKIE_SECURE", False)
    monkeypatch.setattr(techtrack_settings, "CSRF_TRUSTED_ORIGINS", [])
    monkeypatch.setattr(techtrack_settings, "EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend")

    with pytest.raises(ImproperlyConfigured, match="FRONTEND_URL must use https"):
        techtrack_settings.validate_production_configuration()


def test_production_validation_allows_local_smoke_runtime(monkeypatch):
    set_postgres_environment(monkeypatch)
    monkeypatch.setattr(techtrack_settings, "PRODUCTION_MODE", True)
    monkeypatch.setattr(techtrack_settings, "DEBUG", False)
    monkeypatch.setattr(techtrack_settings, "ALLOWED_HOSTS", ["localhost", "backend"])
    monkeypatch.setattr(techtrack_settings, "FRONTEND_URL", "http://localhost:8080")
    monkeypatch.setattr(techtrack_settings, "EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend")
    monkeypatch.setattr(techtrack_settings, "EMAIL_USE_TLS", False)
    monkeypatch.setattr(techtrack_settings, "EMAIL_USE_SSL", False)

    techtrack_settings.validate_production_configuration()


def test_production_validation_requires_smtp_credentials(monkeypatch):
    set_postgres_environment(monkeypatch)
    monkeypatch.setattr(techtrack_settings, "PRODUCTION_MODE", True)
    monkeypatch.setattr(techtrack_settings, "DEBUG", False)
    monkeypatch.setattr(techtrack_settings, "ALLOWED_HOSTS", ["localhost", "backend"])
    monkeypatch.setattr(techtrack_settings, "FRONTEND_URL", "http://localhost:8080")
    monkeypatch.setattr(techtrack_settings, "EMAIL_BACKEND", "django.core.mail.backends.smtp.EmailBackend")
    monkeypatch.setattr(techtrack_settings, "EMAIL_HOST", "smtp.example.com")
    monkeypatch.setattr(techtrack_settings, "EMAIL_HOST_USER", "")
    monkeypatch.setattr(techtrack_settings, "EMAIL_HOST_PASSWORD", "")
    monkeypatch.setattr(techtrack_settings, "DEFAULT_FROM_EMAIL", "TechTrack <noreply@techtrack.local>")
    monkeypatch.setattr(techtrack_settings, "EMAIL_USE_TLS", True)
    monkeypatch.setattr(techtrack_settings, "EMAIL_USE_SSL", False)

    with pytest.raises(ImproperlyConfigured, match="missing SMTP settings"):
        techtrack_settings.validate_production_configuration()
