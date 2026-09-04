from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.utils import timezone
from rest_framework.test import APIClient

from catalog.models import PaymentMethod
from customers.models import Customer
from finance.models import Receivable, ReceivableStatus, ServiceAgreement
from finance.services import generate_service_agreement_receivable, register_payment, void_payment


@pytest.fixture
def customer(db):
    return Customer.objects.create(name="Cliente Financeiro")


@pytest.fixture
def agreement(customer):
    return ServiceAgreement.objects.create(
        customer=customer,
        name="Suporte mensal",
        starts_on=date(2026, 9, 1),
        amount=Decimal("500.00"),
        billing_day=10,
    )


@pytest.fixture
def payment_method(db):
    return PaymentMethod.objects.create(name="PIX teste", slug="pix-test")


@pytest.fixture
def user(db):
    return get_user_model().objects.create_user(username="finance-user", password="secret123")


def test_monthly_receivable_generation_is_idempotent(agreement):
    first, created_first = generate_service_agreement_receivable(agreement=agreement, competence=date(2026, 9, 1))
    second, created_second = generate_service_agreement_receivable(agreement=agreement, competence=date(2026, 9, 20))

    assert created_first is True
    assert created_second is False
    assert first.pk == second.pk
    assert first.due_date == date(2026, 9, 10)
    assert Receivable.objects.filter(service_agreement=agreement).count() == 1


def test_payment_partial_then_full_updates_status(agreement, payment_method):
    receivable, _ = generate_service_agreement_receivable(agreement=agreement, competence=date(2026, 9, 1))
    register_payment(receivable=receivable, amount="200.00", payment_method=payment_method)
    receivable.refresh_from_db()
    assert receivable.status == ReceivableStatus.PARTIAL

    register_payment(receivable=receivable, amount="300.00", payment_method=payment_method)
    receivable.refresh_from_db()
    assert receivable.status == ReceivableStatus.PAID


def test_overpayment_is_rejected(agreement, payment_method):
    receivable, _ = generate_service_agreement_receivable(agreement=agreement, competence=date(2026, 9, 1))
    with pytest.raises(ValidationError):
        register_payment(receivable=receivable, amount="500.01", payment_method=payment_method)


def test_void_payment_restores_receivable_balance(agreement, payment_method):
    receivable, _ = generate_service_agreement_receivable(agreement=agreement, competence=date(2026, 9, 1))
    payment = register_payment(receivable=receivable, amount="500.00", payment_method=payment_method)
    payment = void_payment(payment=payment, reason="Lancamento duplicado")

    receivable.refresh_from_db()
    assert payment.voided_at is not None
    assert receivable.status == ReceivableStatus.PENDING


def test_overdue_is_calculated_not_persisted(customer):
    receivable = Receivable.objects.create(
        customer=customer,
        origin="manual",
        description="Atrasada",
        issued_at=timezone.localdate() - timezone.timedelta(days=10),
        due_date=timezone.localdate() - timezone.timedelta(days=1),
        amount=Decimal("100.00"),
    )
    assert receivable.is_overdue is True


def test_finance_api_requires_authentication(db):
    client = APIClient()
    response = client.get("/api/v1/receivables/")
    assert response.status_code in {401, 403}


def test_finance_dashboard_returns_totals(user, agreement):
    generate_service_agreement_receivable(agreement=agreement, competence=date(2026, 9, 1), created_by=user)
    client = APIClient()
    client.force_authenticate(user=user)
    response = client.get("/api/v1/finance/dashboard/")
    assert response.status_code == 200
    assert Decimal(response.data["pending_total"]) == Decimal("500.00")
