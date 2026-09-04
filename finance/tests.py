from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.utils import timezone
from rest_framework.test import APIClient

from catalog.models import PaymentMethod
from customers.models import Customer
from finance.models import Payment, Receivable, ReceivableStatus, ServiceAgreement
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


def test_create_agreement_receive_now_creates_paid_first_month(user, customer, payment_method):
    today = timezone.localdate()
    client = APIClient()
    client.force_authenticate(user=user)
    response = client.post(
        "/api/v1/service-agreements/",
        {
            "customer": str(customer.pk),
            "name": "Plano recebido na entrada",
            "status": "active",
            "starts_on": today.isoformat(),
            "billing_frequency": "monthly",
            "amount": "500.00",
            "billing_day": 10,
            "first_billing_mode": "receive_now",
            "first_payment_method": str(payment_method.pk),
        },
        format="json",
    )

    assert response.status_code == 201, response.data
    agreement = ServiceAgreement.objects.get(pk=response.data["id"])
    assert agreement.first_billing_competence == today.replace(day=1)
    receivable = Receivable.objects.get(service_agreement=agreement)
    assert receivable.competence == today.replace(day=1)
    assert receivable.due_date == today
    assert receivable.status == ReceivableStatus.PAID
    assert Payment.objects.filter(receivable=receivable, voided_at__isnull=True).count() == 1


def test_create_agreement_next_month_skips_current_competence(user, customer):
    today = timezone.localdate()
    current_competence = today.replace(day=1)
    if current_competence.month == 12:
        next_competence = date(current_competence.year + 1, 1, 1)
    else:
        next_competence = date(current_competence.year, current_competence.month + 1, 1)

    client = APIClient()
    client.force_authenticate(user=user)
    response = client.post(
        "/api/v1/service-agreements/",
        {
            "customer": str(customer.pk),
            "name": "Plano com primeiro vencimento futuro",
            "status": "active",
            "starts_on": today.isoformat(),
            "billing_frequency": "monthly",
            "amount": "500.00",
            "billing_day": 10,
            "first_billing_mode": "next_month",
        },
        format="json",
    )

    assert response.status_code == 201, response.data
    agreement = ServiceAgreement.objects.get(pk=response.data["id"])
    assert agreement.first_billing_competence == next_competence
    assert not Receivable.objects.filter(service_agreement=agreement).exists()
    with pytest.raises(ValidationError):
        generate_service_agreement_receivable(agreement=agreement, competence=current_competence)

    receivable, created = generate_service_agreement_receivable(agreement=agreement, competence=next_competence)
    assert created is True
    assert receivable.competence == next_competence
    assert receivable.due_date.day == 10


def test_create_agreement_receive_now_requires_payment_method(user, customer):
    client = APIClient()
    client.force_authenticate(user=user)
    response = client.post(
        "/api/v1/service-agreements/",
        {
            "customer": str(customer.pk),
            "name": "Plano sem metodo",
            "status": "active",
            "starts_on": timezone.localdate().isoformat(),
            "billing_frequency": "monthly",
            "amount": "500.00",
            "billing_day": 10,
            "first_billing_mode": "receive_now",
        },
        format="json",
    )

    assert response.status_code == 400
    assert "first_payment_method" in response.data
