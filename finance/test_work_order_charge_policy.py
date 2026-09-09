from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from customers.models import Customer
from finance.models import ServiceAgreement
from inventory.models import Equipment, EquipmentType
from workorders.services import create_work_order


@pytest.fixture
def api_client(db):
    user = get_user_model().objects.create_user(username="finance-tech", password="secret123")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def monthly_work_order(db):
    customer = Customer.objects.create(name="Cliente mensalista")
    equipment = Equipment.objects.create(
        customer=customer,
        equipment_type=EquipmentType.objects.get(slug="notebook"),
        manufacturer="Dell",
        model="Latitude",
    )
    agreement = ServiceAgreement.objects.create(
        customer=customer,
        name="Plano mensal TI",
        starts_on=timezone.localdate(),
        amount=Decimal("250.00"),
        billing_day=10,
    )
    work_order = create_work_order(
        customer=customer,
        equipment=equipment,
        title="Manutencao mensal",
        problem_description="Atendimento preventivo",
    )
    return work_order, agreement


def _charge_payload(work_order):
    today = timezone.localdate().isoformat()
    return {
        "customer": str(work_order.customer_id),
        "work_order": str(work_order.id),
        "service_agreement": None,
        "origin": "work_order",
        "description": f"Cobranca {work_order.display_number}",
        "reference": work_order.display_number,
        "issued_at": today,
        "due_date": today,
        "amount": "100.00",
        "notes": "",
    }


def test_monthly_work_order_requires_explicit_charge_policy(api_client, monthly_work_order):
    work_order, agreement = monthly_work_order

    state = api_client.get(f"/api/v1/work-orders/{work_order.id}/charge-policy/")
    assert state.status_code == 200
    assert state.json()["has_active_agreement"] is True
    assert state.json()["policy"] is None
    assert state.json()["active_agreements"][0]["id"] == str(agreement.id)

    blocked = api_client.post("/api/v1/receivables/", _charge_payload(work_order), format="json")
    assert blocked.status_code == 400


def test_monthly_work_order_can_be_included_or_charged_extra(api_client, monthly_work_order):
    work_order, agreement = monthly_work_order
    url = f"/api/v1/work-orders/{work_order.id}/charge-policy/"

    included = api_client.put(
        url,
        {
            "mode": "agreement_included",
            "service_agreement_id": str(agreement.id),
        },
        format="json",
    )
    assert included.status_code == 200
    assert included.json()["policy"]["mode"] == "agreement_included"

    blocked = api_client.post("/api/v1/receivables/", _charge_payload(work_order), format="json")
    assert blocked.status_code == 400

    extra = api_client.put(
        url,
        {
            "mode": "agreement_extra",
            "service_agreement_id": str(agreement.id),
        },
        format="json",
    )
    assert extra.status_code == 200
    assert extra.json()["policy"]["mode"] == "agreement_extra"

    charge = api_client.post("/api/v1/receivables/", _charge_payload(work_order), format="json")
    assert charge.status_code == 201

    cannot_reclassify = api_client.put(
        url,
        {
            "mode": "agreement_included",
            "service_agreement_id": str(agreement.id),
        },
        format="json",
    )
    assert cannot_reclassify.status_code == 400
