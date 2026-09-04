from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from catalog.models import IntervalUnit, Part, PartCategory, PaymentMethod, ServiceType
from customers.models import Customer
from inventory.models import ComponentType, Equipment, EquipmentType
from workorders.models import WorkOrderPart, WorkOrderStatus
from workorders.services import complete_work_order, create_work_order, register_work_order_service


@pytest.fixture
def user(db):
    return get_user_model().objects.create_user(username="tech", password="secret123")


@pytest.fixture
def api_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def staff_user(db):
    return get_user_model().objects.create_user(username="staff-tech", password="secret123", is_staff=True)


@pytest.fixture
def staff_client(staff_user):
    client = APIClient()
    client.force_authenticate(user=staff_user)
    return client


@pytest.fixture
def anonymous_client():
    return APIClient()


@pytest.fixture
def customer(db):
    return Customer.objects.create(name="Cliente API", email="cliente@example.com", phone="11999990000")


@pytest.fixture
def notebook_type(db):
    return EquipmentType.objects.get(slug="notebook")


@pytest.fixture
def storage_type(db):
    return ComponentType.objects.get(slug="storage")


@pytest.fixture
def equipment(customer, notebook_type):
    return Equipment.objects.create(
        customer=customer,
        equipment_type=notebook_type,
        manufacturer="Dell",
        model="Latitude",
        serial_number="SN-1",
    )


@pytest.fixture
def service_type(db):
    return ServiceType.objects.create(
        name="Limpeza interna",
        slug="internal-cleaning-api",
        is_recurring=True,
        recommended_interval_value=12,
        recommended_interval_unit=IntervalUnit.MONTHS,
    )


def _json(response):
    return response.json()


def _query_count_for(client, url):
    with CaptureQueriesContext(connection) as ctx:
        response = client.get(url)
        assert response.status_code == 200
    return len(ctx), response


def test_protected_endpoint_requires_authentication(anonymous_client):
    response = anonymous_client.get("/api/v1/customers/")

    assert response.status_code == 401


def test_jwt_token_login_and_authenticated_access(db):
    get_user_model().objects.create_user(username="api-user", password="secret123")
    client = APIClient()

    token_response = client.post("/api/token/", {"username": "api-user", "password": "secret123"}, format="json")
    assert token_response.status_code == 200
    access = token_response.json()["access"]

    response = client.get("/api/v1/customers/", HTTP_AUTHORIZATION=f"Bearer {access}")
    assert response.status_code == 200


def test_health_is_public(anonymous_client):
    response = anonymous_client.get("/api/health/")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_customer_crud_filters_search_and_soft_delete(api_client):
    create_response = api_client.post(
        "/api/v1/customers/",
        {"name": "Maria Cliente", "email": "maria@example.com", "phone": "1133334444"},
        format="json",
    )
    assert create_response.status_code == 201
    customer_id = _json(create_response)["id"]

    list_response = api_client.get("/api/v1/customers/?search=Maria&email=maria")
    assert list_response.status_code == 200
    assert list_response.json()["count"] == 1
    assert list_response.json()["results"][0]["equipment_count"] == 0

    patch_response = api_client.patch(f"/api/v1/customers/{customer_id}/", {"whatsapp": "11988887777"}, format="json")
    assert patch_response.status_code == 200
    assert patch_response.json()["whatsapp"] == "11988887777"

    delete_response = api_client.delete(f"/api/v1/customers/{customer_id}/")
    assert delete_response.status_code == 204
    assert api_client.get(f"/api/v1/customers/{customer_id}/").status_code == 404


def test_equipment_crud_filters_components_and_remove(api_client, customer, notebook_type, storage_type):
    response = api_client.post(
        "/api/v1/equipment/",
        {
            "customer_id": str(customer.id),
            "equipment_type_id": str(notebook_type.id),
            "manufacturer": "Dell",
            "model": "XPS",
            "serial_number": "EQ-1",
        },
        format="json",
    )
    assert response.status_code == 201
    equipment_id = response.json()["id"]

    list_response = api_client.get(f"/api/v1/equipment/?customer={customer.id}&search=XPS")
    assert list_response.status_code == 200
    assert list_response.json()["count"] == 1

    component_response = api_client.post(
        f"/api/v1/equipment/{equipment_id}/components/",
        {"component_type_id": str(storage_type.id), "manufacturer": "Kingston", "model": "NV3"},
        format="json",
    )
    assert component_response.status_code == 201
    component_id = component_response.json()["id"]

    remove_response = api_client.post(
        f"/api/v1/equipment/{equipment_id}/components/{component_id}/remove/",
        {},
        format="json",
    )
    assert remove_response.status_code == 200
    assert remove_response.json()["removed_at"] is not None


def test_catalog_dynamic_create_inactivate_and_protect_used_delete(staff_client, customer):
    type_response = staff_client.post("/api/v1/equipment-types/", {"name": "NVR", "slug": "nvr-api"}, format="json")
    assert type_response.status_code == 201
    type_id = type_response.json()["id"]

    equipment = Equipment.objects.create(customer=customer, equipment_type_id=type_id)
    patch_response = staff_client.patch(f"/api/v1/equipment-types/{type_id}/", {"is_active": False}, format="json")
    assert patch_response.status_code == 200
    assert equipment.equipment_type_id == type_response.data.get("id", equipment.equipment_type_id)

    delete_response = staff_client.delete(f"/api/v1/equipment-types/{type_id}/")
    assert delete_response.status_code == 409


def test_catalog_writes_require_staff(api_client):
    response = api_client.post("/api/v1/equipment-types/", {"name": "NAS", "slug": "nas-api"}, format="json")

    assert response.status_code == 403


def test_catalog_reads_allow_authenticated_non_staff(api_client):
    response = api_client.get("/api/v1/equipment-types/")

    assert response.status_code == 200


def test_work_order_create_initial_history_and_invalid_equipment_customer(api_client, customer, equipment):
    response = api_client.post(
        "/api/v1/work-orders/",
        {
            "customer_id": str(customer.id),
            "equipment_id": str(equipment.id),
            "title": "Notebook sem video",
            "problem_description": "Tela preta",
        },
        format="json",
    )
    assert response.status_code == 201
    data = response.json()
    assert data["number"] == 1
    assert data["status"]["code"] == "open"
    assert len(data["status_history"]) == 1

    other_customer = Customer.objects.create(name="Outro")
    invalid_response = api_client.post(
        "/api/v1/work-orders/",
        {
            "customer_id": str(other_customer.id),
            "equipment_id": str(equipment.id),
            "title": "OS invalida",
            "problem_description": "Equipamento errado",
        },
        format="json",
    )
    assert invalid_response.status_code == 400


def test_work_order_actions_use_domain_services_and_audit_user(api_client, user, customer, equipment, service_type):
    work_order = create_work_order(customer=customer, equipment=equipment, title="OS", problem_description="Problema")
    in_progress = WorkOrderStatus.objects.get(code="in_progress")

    status_response = api_client.post(
        f"/api/v1/work-orders/{work_order.id}/change-status/",
        {"status_id": str(in_progress.id), "comment": "Inicio"},
        format="json",
    )
    assert status_response.status_code == 200
    assert status_response.json()["status"]["code"] == "in_progress"
    assert status_response.json()["status_history"][-1]["changed_by"]["id"] == str(user.id)

    service_response = api_client.post(
        f"/api/v1/work-orders/{work_order.id}/services/",
        {"service_type_id": str(service_type.id), "labor_price": "120.00"},
        format="json",
    )
    assert service_response.status_code == 201
    assert service_response.json()["performed_by"]["id"] == str(user.id)

    void_response = api_client.post(
        f"/api/v1/work-orders/{work_order.id}/services/{service_response.json()['id']}/void/",
        {"reason": "Lancamento incorreto"},
        format="json",
    )
    assert void_response.status_code == 200
    assert void_response.json()["void_reason"] == "Lancamento incorreto"

    complete_response = api_client.post(
        f"/api/v1/work-orders/{work_order.id}/complete/",
        {"diagnosis": "Falha de software", "solution": "Reinstalacao"},
        format="json",
    )
    assert complete_response.status_code == 200
    assert complete_response.json()["completed_at"] is not None


def test_completed_work_order_rejects_generic_update_and_new_service(api_client, customer, equipment, service_type):
    work_order = create_work_order(customer=customer, equipment=equipment, title="OS", problem_description="Problema")
    complete_work_order(work_order=work_order)

    patch_response = api_client.patch(f"/api/v1/work-orders/{work_order.id}/", {"title": "Novo"}, format="json")
    assert patch_response.status_code == 400

    service_response = api_client.post(
        f"/api/v1/work-orders/{work_order.id}/services/",
        {"service_type_id": str(service_type.id)},
        format="json",
    )
    assert service_response.status_code == 400


def test_complete_action_does_not_edit_already_closed_work_order(api_client, customer, equipment):
    work_order = create_work_order(customer=customer, equipment=equipment, title="OS", problem_description="Problema")
    complete_work_order(work_order=work_order)

    response = api_client.post(
        f"/api/v1/work-orders/{work_order.id}/complete/",
        {"internal_notes": "alterado apos fechamento"},
        format="json",
    )

    assert response.status_code == 409
    work_order.refresh_from_db()
    assert work_order.internal_notes == ""


def test_work_order_parts_and_billing(api_client, customer, equipment, service_type):
    category = PartCategory.objects.create(name="Armazenamento API", slug="storage-api")
    part = Part.objects.create(name="SSD Kingston NV3", category=category, default_price=Decimal("350.00"))
    payment_method = PaymentMethod.objects.get(slug="pix")
    work_order = create_work_order(customer=customer, equipment=equipment, title="OS", problem_description="Problema")
    service = register_work_order_service(work_order=work_order, service_type=service_type)

    part_response = api_client.post(
        f"/api/v1/work-orders/{work_order.id}/parts/",
        {
            "work_order_service_id": str(service.id),
            "part_id": str(part.id),
            "description": "SSD Kingston NV3 1 TB",
            "quantity": "1.00",
            "unit_cost": "250.00",
            "unit_price": "350.00",
            "serial_number": "XYZ",
        },
        format="json",
    )
    assert part_response.status_code == 201
    assert part_response.json()["description"] == "SSD Kingston NV3 1 TB"

    void_response = api_client.post(
        f"/api/v1/work-orders/{work_order.id}/parts/{part_response.json()['id']}/void/",
        {"reason": "Peca incorreta"},
        format="json",
    )
    assert void_response.status_code == 200
    assert void_response.json()["void_reason"] == "Peca incorreta"

    billing_response = api_client.put(
        f"/api/v1/work-orders/{work_order.id}/billing/",
        {
            "labor_total": "100.00",
            "parts_total": "350.00",
            "discount": "0.00",
            "total_amount": "450.00",
            "payment_status": "pending",
            "payment_method_id": str(payment_method.id),
        },
        format="json",
    )
    assert billing_response.status_code == 200
    assert billing_response.json()["total_amount"] == "450.00"

    invalid_response = api_client.put(
        f"/api/v1/work-orders/{work_order.id}/billing/",
        {"total_amount": "-1.00"},
        format="json",
    )
    assert invalid_response.status_code == 400


def test_nested_missing_ids_return_404(api_client, customer, equipment):
    work_order = create_work_order(customer=customer, equipment=equipment, title="OS", problem_description="P")
    missing_id = "00000000-0000-0000-0000-000000000000"

    service_response = api_client.post(
        f"/api/v1/work-orders/{work_order.id}/services/{missing_id}/void/",
        {"reason": "missing"},
        format="json",
    )
    component_response = api_client.post(
        f"/api/v1/equipment/{equipment.id}/components/{missing_id}/remove/",
        {},
        format="json",
    )

    assert service_response.status_code == 404
    assert component_response.status_code == 404


def test_customer_equipment_action_hides_soft_deleted_equipment(api_client, customer, equipment):
    equipment.soft_delete()

    response = api_client.get(f"/api/v1/customers/{customer.id}/equipment/")

    assert response.status_code == 200
    assert response.json()["count"] == 0


def test_equipment_creation_rejects_soft_deleted_customer(api_client, customer, notebook_type):
    customer.soft_delete()

    response = api_client.post(
        "/api/v1/equipment/",
        {"customer_id": str(customer.id), "equipment_type_id": str(notebook_type.id)},
        format="json",
    )

    assert response.status_code == 400


def test_component_source_work_order_is_read_only(api_client, customer, equipment, storage_type):
    other_work_order = create_work_order(customer=customer, equipment=equipment, title="OS", problem_description="P")

    response = api_client.post(
        f"/api/v1/equipment/{equipment.id}/components/",
        {
            "component_type_id": str(storage_type.id),
            "source_work_order": str(other_work_order.id),
        },
        format="json",
    )

    assert response.status_code == 201
    assert response.json()["source_work_order"] is None


def test_billing_missing_returns_404(api_client, customer, equipment):
    work_order = create_work_order(customer=customer, equipment=equipment, title="OS", problem_description="P")

    response = api_client.get(f"/api/v1/work-orders/{work_order.id}/billing/")

    assert response.status_code == 404


def test_preventive_maintenance_endpoint_ignores_open_and_voided_services(
    api_client,
    customer,
    equipment,
    service_type,
):
    service_type.recommended_interval_value = 1
    service_type.recommended_interval_unit = IntervalUnit.DAYS
    service_type.save(update_fields=["recommended_interval_value", "recommended_interval_unit", "updated_at"])

    never = ServiceType.objects.create(
        name="Troca pasta API",
        slug="thermal-api",
        is_recurring=True,
        recommended_interval_value=1,
        recommended_interval_unit=IntervalUnit.DAYS,
    )
    open_work_order = create_work_order(customer=customer, equipment=equipment, title="Aberta", problem_description="P")
    register_work_order_service(work_order=open_work_order, service_type=never)

    performed_at = timezone.now() - timezone.timedelta(days=2)
    completed = create_work_order(
        customer=customer,
        equipment=equipment,
        title="Concluida",
        problem_description="P",
        opened_at=performed_at - timezone.timedelta(hours=1),
    )
    register_work_order_service(work_order=completed, service_type=service_type, performed_at=performed_at)
    complete_work_order(work_order=completed, completed_at=performed_at + timezone.timedelta(hours=1))

    response = api_client.get(f"/api/v1/equipment/{equipment.id}/maintenance/")
    assert response.status_code == 200
    rows = {row["service_type"]["slug"]: row for row in response.json()}
    assert rows[service_type.slug]["status"] == "overdue"
    assert rows[service_type.slug]["last_performed_at"] is not None
    assert rows[never.slug]["status"] == "never_performed"


def test_http_work_order_list_query_count_does_not_grow(api_client, notebook_type):
    def create_rows(count):
        for index in range(count):
            customer = Customer.objects.create(name=f"Cliente {index}")
            equipment = Equipment.objects.create(customer=customer, equipment_type=notebook_type, model=f"M{index}")
            create_work_order(customer=customer, equipment=equipment, title=f"OS {index}", problem_description="P")

    create_rows(1)
    one_count, _ = _query_count_for(api_client, "/api/v1/work-orders/")

    create_rows(19)
    many_count, response = _query_count_for(api_client, "/api/v1/work-orders/")

    assert response.json()["count"] == 20
    assert many_count <= one_count + 1


def test_http_equipment_list_query_count_does_not_grow(api_client, notebook_type):
    def create_rows(count):
        for index in range(count):
            customer = Customer.objects.create(name=f"Cliente EQ {index}")
            Equipment.objects.create(customer=customer, equipment_type=notebook_type, model=f"M{index}")

    create_rows(1)
    one_count, _ = _query_count_for(api_client, "/api/v1/equipment/")

    create_rows(19)
    many_count, response = _query_count_for(api_client, "/api/v1/equipment/")

    assert response.json()["count"] == 20
    assert many_count <= one_count + 1


@pytest.mark.parametrize("count", [5, 30])
def test_http_work_order_detail_query_count_is_bounded(api_client, customer, equipment, service_type, count):
    work_order = create_work_order(customer=customer, equipment=equipment, title="OS", problem_description="P")
    part = Part.objects.create(name=f"SSD {count}")
    for index in range(count):
        service = register_work_order_service(work_order=work_order, service_type=service_type)
        WorkOrderPart.objects.create(
            work_order=work_order,
            work_order_service=service,
            part=part,
            description=f"Peca {index}",
            quantity=Decimal("1.00"),
        )

    query_count, response = _query_count_for(api_client, f"/api/v1/work-orders/{work_order.id}/")

    assert len(response.json()["services"]) == count
    assert query_count <= 6


def test_http_preventive_maintenance_query_count_does_not_grow(api_client, customer, equipment):
    def create_recurring(count):
        for index in range(count):
            ServiceType.objects.create(
                name=f"Preventiva {index}",
                slug=f"preventive-{count}-{index}",
                is_recurring=True,
                recommended_interval_value=12,
                recommended_interval_unit=IntervalUnit.MONTHS,
            )

    create_recurring(1)
    one_count, _ = _query_count_for(api_client, f"/api/v1/equipment/{equipment.id}/maintenance/")

    create_recurring(19)
    many_count, response = _query_count_for(api_client, f"/api/v1/equipment/{equipment.id}/maintenance/")

    assert len(response.json()) == 20
    assert many_count <= one_count + 1
