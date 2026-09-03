from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.db.models import ProtectedError
from django.utils import timezone

from catalog.models import IntervalUnit, Part, PartCategory, PaymentMethod, ServiceCategory, ServiceType
from customers.models import Customer
from inventory.models import Equipment, EquipmentType
from workorders.models import WorkOrder, WorkOrderBilling, WorkOrderPart, WorkOrderService, WorkOrderStatus
from workorders.services import (
    calculate_next_maintenance_due_at,
    change_work_order_status,
    complete_work_order,
    create_work_order,
    get_last_valid_maintenance,
    invalidate_work_order_service,
    register_work_order_service,
)


@pytest.fixture
def customer(db):
    return Customer.objects.create(name="Cliente A")


@pytest.fixture
def equipment(customer):
    return Equipment.objects.create(
        customer=customer,
        equipment_type=EquipmentType.objects.get(slug="notebook"),
        manufacturer="Dell",
    )


@pytest.fixture
def service_type(db):
    return ServiceType.objects.create(name="Limpeza interna", slug="internal-cleaning")


@pytest.fixture
def open_status(db):
    return WorkOrderStatus.objects.get(code="open")


@pytest.fixture
def in_progress_status(db):
    return WorkOrderStatus.objects.get(code="in_progress")


@pytest.fixture
def completed_status(db):
    return WorkOrderStatus.objects.get(code="completed")


@pytest.fixture
def cancelled_status(db):
    return WorkOrderStatus.objects.get(code="cancelled")


def test_equipment_belongs_to_customer(customer, equipment):
    assert equipment.customer == customer


def test_prevent_work_order_for_customer_different_from_equipment_owner(db, equipment):
    other_customer = Customer.objects.create(name="Cliente B")
    work_order = WorkOrder(
        number=1,
        customer=other_customer,
        equipment=equipment,
        title="OS invalida",
        problem_description="Equipamento de outro cliente",
        opened_at=timezone.now(),
    )

    with pytest.raises(ValidationError):
        work_order.full_clean()


def test_create_work_order_generates_number_and_initial_history(customer, equipment):
    work_order = create_work_order(
        customer=customer,
        equipment=equipment,
        title="Notebook sem video",
        problem_description="Cliente informou tela preta.",
    )

    assert work_order.number == 1
    assert work_order.status.code == "open"
    assert work_order.status_history.count() == 1
    assert work_order.status_history.first().status.code == "open"


def test_work_order_numbers_are_unique(customer, equipment):
    first = create_work_order(customer=customer, equipment=equipment, title="Primeira", problem_description="A")
    second = create_work_order(customer=customer, equipment=equipment, title="Segunda", problem_description="B")

    assert first.number == 1
    assert second.number == 2


def test_change_status_creates_history(customer, equipment, in_progress_status):
    work_order = create_work_order(customer=customer, equipment=equipment, title="OS", problem_description="Problema")

    changed = change_work_order_status(work_order=work_order, status=in_progress_status, comment="Inicio")

    assert changed.status == in_progress_status
    assert changed.started_at is not None
    assert changed.status_history.count() == 2


def test_cancelled_work_order_cannot_be_reopened(customer, equipment, cancelled_status, open_status):
    work_order = create_work_order(customer=customer, equipment=equipment, title="OS", problem_description="Problema")
    cancelled = change_work_order_status(work_order=work_order, status=cancelled_status)

    with pytest.raises(ValidationError):
        change_work_order_status(work_order=cancelled, status=open_status)


def test_complete_work_order_sets_completed_at(customer, equipment):
    work_order = create_work_order(customer=customer, equipment=equipment, title="OS", problem_description="Problema")

    completed = complete_work_order(work_order=work_order, comment="Concluida")

    assert completed.status.code == "completed"
    assert completed.completed_at is not None
    assert completed.status_history.filter(status__code="completed").exists()


def test_completed_at_before_opened_fails(customer, equipment, completed_status):
    opened_at = timezone.now()
    work_order = WorkOrder(
        number=1,
        customer=customer,
        equipment=equipment,
        title="OS",
        problem_description="Problema",
        status=completed_status,
        opened_at=opened_at,
        completed_at=opened_at - timezone.timedelta(days=1),
    )

    with pytest.raises(ValidationError):
        work_order.full_clean()


def test_completed_at_without_completed_status_fails(customer, equipment, open_status):
    opened_at = timezone.now()
    work_order = WorkOrder(
        number=1,
        customer=customer,
        equipment=equipment,
        title="OS",
        problem_description="Problema",
        status=open_status,
        opened_at=opened_at,
        completed_at=opened_at,
    )

    with pytest.raises(ValidationError):
        work_order.full_clean()


def test_recurring_service_type_requires_interval(db):
    service_type = ServiceType(name="Troca de pasta termica", slug="thermal-paste", is_recurring=True)

    with pytest.raises(ValidationError):
        service_type.full_clean()


def test_create_recurring_service_type(db):
    category = ServiceCategory.objects.create(name="Preventiva especializada", slug="special-preventive")
    service_type = ServiceType.objects.create(
        name="Troca de pasta termica",
        slug="thermal-paste",
        category=category,
        is_recurring=True,
        recommended_interval_value=18,
        recommended_interval_unit=IntervalUnit.MONTHS,
    )

    assert service_type.is_recurring is True
    assert service_type.category == category


def test_create_new_part_category(db):
    category = PartCategory.objects.create(name="Placa Wi-Fi", slug="wifi-card")

    assert category.is_active is True


def test_create_new_service_type(db):
    service = ServiceType.objects.create(name="Instalacao de NVR", slug="nvr-installation")

    assert service.slug == "nvr-installation"


def test_create_custom_work_order_status_and_use_it(customer, equipment):
    testing_status = WorkOrderStatus.objects.create(name="Em testes", code="testing", sort_order=60)
    work_order = create_work_order(customer=customer, equipment=equipment, title="OS", problem_description="Problema")
    changed = change_work_order_status(work_order=work_order, status=testing_status)

    assert changed.status == testing_status
    assert changed.status_history.filter(status=testing_status).exists()


def test_renaming_status_does_not_break_history(customer, equipment):
    testing_status = WorkOrderStatus.objects.create(name="Em testes", code="testing", sort_order=60)
    work_order = create_work_order(customer=customer, equipment=equipment, title="OS", problem_description="Problema")
    change_work_order_status(work_order=work_order, status=testing_status)

    testing_status.name = "Validacao final"
    testing_status.save(update_fields=["name", "updated_at"])

    history = work_order.status_history.get(status=testing_status)
    assert history.status.code == "testing"
    assert history.status.name == "Validacao final"


def test_register_work_order_service(customer, equipment, service_type):
    work_order = create_work_order(customer=customer, equipment=equipment, title="OS", problem_description="Problema")

    service = register_work_order_service(
        work_order=work_order, service_type=service_type, labor_price=Decimal("120.00")
    )

    assert service.work_order == work_order
    assert service.equipment == equipment
    assert service.labor_price == Decimal("120.00")


def test_last_maintenance_ignores_non_completed_work_orders(customer, equipment, service_type):
    work_order = create_work_order(customer=customer, equipment=equipment, title="OS", problem_description="Problema")
    register_work_order_service(work_order=work_order, service_type=service_type)

    assert get_last_valid_maintenance(equipment=equipment, service_type=service_type) is None


def test_last_maintenance_uses_completed_work_orders(customer, equipment, service_type):
    work_order = create_work_order(customer=customer, equipment=equipment, title="OS", problem_description="Problema")
    service = register_work_order_service(work_order=work_order, service_type=service_type)
    complete_work_order(work_order=work_order)

    assert get_last_valid_maintenance(equipment=equipment, service_type=service_type) == service


def test_voided_service_does_not_count_as_last_maintenance(customer, equipment, service_type):
    work_order = create_work_order(customer=customer, equipment=equipment, title="OS", problem_description="Problema")
    service = register_work_order_service(work_order=work_order, service_type=service_type)
    invalidate_work_order_service(service=service, void_reason="Lancamento incorreto")
    complete_work_order(work_order=work_order)

    assert get_last_valid_maintenance(equipment=equipment, service_type=service_type) is None


def test_service_cannot_be_voided_twice(customer, equipment, service_type):
    work_order = create_work_order(customer=customer, equipment=equipment, title="OS", problem_description="Problema")
    service = register_work_order_service(work_order=work_order, service_type=service_type)
    invalidate_work_order_service(service=service, void_reason="Lancamento incorreto")

    with pytest.raises(ValidationError):
        invalidate_work_order_service(service=service, void_reason="Segunda invalidacao")


def test_calculate_next_maintenance_due_at(customer, equipment):
    service_type = ServiceType.objects.create(
        name="Troca de pasta termica",
        slug="thermal-paste",
        is_recurring=True,
        recommended_interval_value=18,
        recommended_interval_unit=IntervalUnit.MONTHS,
    )
    performed_at = timezone.datetime(2025, 1, 10, 10, tzinfo=timezone.get_current_timezone())
    work_order = create_work_order(
        customer=customer,
        equipment=equipment,
        title="OS",
        problem_description="Problema",
        opened_at=performed_at - timezone.timedelta(hours=1),
    )
    register_work_order_service(work_order=work_order, service_type=service_type, performed_at=performed_at)
    complete_work_order(work_order=work_order, completed_at=performed_at + timezone.timedelta(hours=1))

    assert (
        calculate_next_maintenance_due_at(equipment=equipment, service_type=service_type).date().isoformat()
        == "2026-07-10"
    )


def test_negative_money_values_fail(customer, equipment, service_type):
    work_order = create_work_order(customer=customer, equipment=equipment, title="OS", problem_description="Problema")
    service = WorkOrderService(
        work_order=work_order,
        service_type=service_type,
        performed_at=timezone.now(),
        labor_price=Decimal("-1.00"),
    )

    with pytest.raises(ValidationError):
        service.full_clean()


def test_work_order_part_validates_quantity_and_service_same_work_order(customer, equipment, service_type):
    first = create_work_order(customer=customer, equipment=equipment, title="Primeira", problem_description="A")
    second = create_work_order(customer=customer, equipment=equipment, title="Segunda", problem_description="B")
    service = register_work_order_service(work_order=first, service_type=service_type)
    part = WorkOrderPart(
        work_order=second, work_order_service=service, description="SSD Kingston", quantity=Decimal("1.00")
    )

    with pytest.raises(ValidationError):
        part.full_clean()

    negative_quantity = WorkOrderPart(work_order=first, description="SSD Kingston", quantity=Decimal("-1.00"))
    with pytest.raises(ValidationError):
        negative_quantity.full_clean()


def test_work_order_part_installed_component_must_match_work_order_equipment(customer, equipment, service_type):
    from inventory.models import ComponentType, EquipmentComponent

    other_equipment = Equipment.objects.create(
        customer=customer,
        equipment_type=EquipmentType.objects.get(slug="desktop"),
    )
    component = EquipmentComponent.objects.create(
        equipment=other_equipment,
        component_type=ComponentType.objects.get(slug="storage"),
    )
    work_order = create_work_order(customer=customer, equipment=equipment, title="OS", problem_description="Problema")
    part = WorkOrderPart(
        work_order=work_order,
        installed_component=component,
        description="SSD Kingston",
        quantity=Decimal("1.00"),
    )

    with pytest.raises(ValidationError):
        part.full_clean()


def test_work_order_billing_negative_values_fail(customer, equipment):
    work_order = create_work_order(customer=customer, equipment=equipment, title="OS", problem_description="Problema")
    billing = WorkOrderBilling(work_order=work_order, total_amount=Decimal("-10.00"))

    with pytest.raises(ValidationError):
        billing.full_clean()


def test_work_order_number_unique_constraint(customer, equipment, open_status):
    WorkOrder.objects.create(
        number=100,
        customer=customer,
        equipment=equipment,
        status=open_status,
        title="A",
        problem_description="A",
        opened_at=timezone.now(),
    )

    with pytest.raises(IntegrityError):
        WorkOrder.objects.create(
            number=100,
            customer=customer,
            equipment=equipment,
            status=open_status,
            title="B",
            problem_description="B",
            opened_at=timezone.now(),
        )


def test_inactive_status_does_not_break_existing_work_order(customer, equipment):
    waiting_pickup = WorkOrderStatus.objects.create(name="Aguardando retirada", code="awaiting-pickup")
    work_order = create_work_order(customer=customer, equipment=equipment, title="OS", problem_description="Problema")
    change_work_order_status(work_order=work_order, status=waiting_pickup)

    waiting_pickup.is_active = False
    waiting_pickup.save(update_fields=["is_active", "updated_at"])

    work_order.refresh_from_db()
    assert work_order.status == waiting_pickup
    assert work_order.status.is_active is False


def test_used_work_order_status_delete_is_protected(customer, equipment):
    work_order = create_work_order(customer=customer, equipment=equipment, title="OS", problem_description="Problema")

    with pytest.raises(ProtectedError):
        work_order.status.delete()


def test_used_part_category_delete_is_protected(db):
    category = PartCategory.objects.create(name="Placa Wi-Fi", slug="wifi-board")
    Part.objects.create(name="Adaptador Wi-Fi", category=category)

    with pytest.raises(ProtectedError):
        category.delete()


def test_payment_method_is_configurable_for_billing(customer, equipment):
    payment_method = PaymentMethod.objects.create(name="Boleto", slug="bank-slip")
    work_order = create_work_order(customer=customer, equipment=equipment, title="OS", problem_description="Problema")
    billing = WorkOrderBilling.objects.create(work_order=work_order, payment_method=payment_method)

    assert billing.payment_method == payment_method


def test_system_enums_still_drive_interval_calculation(customer, equipment):
    service_type = ServiceType.objects.create(
        name="Backup mensal",
        slug="monthly-backup",
        is_recurring=True,
        recommended_interval_value=30,
        recommended_interval_unit=IntervalUnit.DAYS,
    )
    performed_at = timezone.datetime(2026, 1, 1, 10, tzinfo=timezone.get_current_timezone())
    work_order = create_work_order(
        customer=customer,
        equipment=equipment,
        title="Backup",
        problem_description="Preventiva",
        opened_at=performed_at - timezone.timedelta(hours=1),
    )
    register_work_order_service(work_order=work_order, service_type=service_type, performed_at=performed_at)
    complete_work_order(work_order=work_order, completed_at=performed_at + timezone.timedelta(hours=1))

    assert calculate_next_maintenance_due_at(
        equipment=equipment, service_type=service_type
    ) == performed_at + timezone.timedelta(days=30)
