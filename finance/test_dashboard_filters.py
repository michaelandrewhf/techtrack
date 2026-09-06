from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from customers.models import Customer
from finance.models import Receivable


@pytest.mark.django_db
def test_finance_dashboard_can_scope_totals_to_customer():
    user = get_user_model().objects.create_user(
        username="finance-dashboard-user",
        password="secret123",
    )
    customer_a = Customer.objects.create(name="Cliente A")
    customer_b = Customer.objects.create(name="Cliente B")
    today = timezone.localdate()

    Receivable.objects.create(
        customer=customer_a,
        origin="manual",
        description="Cobranca A",
        issued_at=today,
        due_date=today,
        amount=Decimal("120.00"),
        created_by=user,
    )
    Receivable.objects.create(
        customer=customer_b,
        origin="manual",
        description="Cobranca B",
        issued_at=today,
        due_date=today,
        amount=Decimal("880.00"),
        created_by=user,
    )

    client = APIClient()
    client.force_authenticate(user=user)
    response = client.get(
        "/api/v1/finance/dashboard/",
        {"customer": str(customer_a.pk)},
    )

    assert response.status_code == 200
    assert Decimal(response.data["pending_total"]) == Decimal("120.00")
    assert [row["customer"] for row in response.data["upcoming"]] == [
        str(customer_a.pk)
    ]
