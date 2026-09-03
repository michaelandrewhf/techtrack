from decimal import Decimal

import pytest
from django.utils import timezone

from catalog.models import Part, PaymentMethod, ServiceType
from customers.models import Customer
from inventory.models import ComponentType, Equipment, EquipmentComponent, EquipmentType
from workorders.models import WorkOrder, WorkOrderBilling, WorkOrderPart, WorkOrderService, WorkOrderStatus
from workorders.services import change_work_order_status, complete_work_order, create_work_order


@pytest.fixture
def notebook_type(db):
    return EquipmentType.objects.get(slug="notebook")


@pytest.fixture
def storage_type(db):
    return ComponentType.objects.get(slug="storage")


@pytest.fixture
def open_status(db):
    return WorkOrderStatus.objects.get(code="open")


@pytest.fixture
def in_progress_status(db):
    return WorkOrderStatus.objects.get(code="in_progress")


def _create_customer_equipment(index, equipment_type):
    customer = Customer.objects.create(name=f"Cliente {index:02d}")
    equipment = Equipment.objects.create(
        customer=customer,
        equipment_type=equipment_type,
        manufacturer="Dell",
        model=f"Latitude {index:02d}",
    )
    return customer, equipment


def _create_work_orders(count, equipment_type):
    work_orders = []
    for index in range(count):
        customer, equipment = _create_customer_equipment(index, equipment_type)
        work_orders.append(
            create_work_order(
                customer=customer,
                equipment=equipment,
                title=f"OS {index:02d}",
                problem_description="Problema relatado",
            )
        )
    return work_orders


def _touch_work_order_list(rows):
    touched = []
    for work_order in rows:
        touched.append(
            (
                work_order.customer.name,
                work_order.equipment.model,
                work_order.equipment.equipment_type.name,
                work_order.status.name,
            )
        )
        if work_order.responsible_user_id:
            touched.append((work_order.responsible_user.username,))
    return touched


def _create_detailed_work_order(service_count, equipment_type, storage_type, in_progress_status):
    customer, equipment = _create_customer_equipment(1, equipment_type)
    work_order = create_work_order(
        customer=customer,
        equipment=equipment,
        title="OS detalhada",
        problem_description="Manutencao completa",
    )
    change_work_order_status(work_order=work_order, status=in_progress_status)

    service_types = [
        ServiceType.objects.create(name=f"Servico {index:02d}", slug=f"service-{service_count}-{index:02d}")
        for index in range(service_count)
    ]
    part = Part.objects.create(name="SSD Kingston")
    component = EquipmentComponent.objects.create(
        equipment=equipment,
        component_type=storage_type,
        manufacturer="Kingston",
        model="NV3",
    )

    for index, service_type in enumerate(service_types):
        service = WorkOrderService.objects.create(
            work_order=work_order,
            service_type=service_type,
            performed_at=timezone.now() + timezone.timedelta(minutes=index),
            labor_price=Decimal("50.00"),
        )
        WorkOrderPart.objects.create(
            work_order=work_order,
            work_order_service=service,
            part=part,
            installed_component=component,
            description=f"Peca {index:02d}",
            quantity=Decimal("1.00"),
            unit_cost=Decimal("100.00"),
            unit_price=Decimal("150.00"),
        )

    WorkOrderBilling.objects.create(
        work_order=work_order,
        payment_method=PaymentMethod.objects.get(slug="pix"),
        labor_total=Decimal("500.00"),
        parts_total=Decimal("1500.00"),
        total_amount=Decimal("2000.00"),
    )
    complete_work_order(work_order=work_order)
    return work_order


def _touch_work_order_detail(work_order):
    touched = [
        work_order.customer.name,
        work_order.equipment.model,
        work_order.equipment.equipment_type.name,
        work_order.status.name,
        work_order.billing.payment_method.name,
    ]

    for history in work_order.status_history.all():
        touched.append(history.status.name)
        if history.changed_by_id:
            touched.append(history.changed_by.username)

    for service in work_order.services.all():
        touched.append(service.service_type.name)
        if service.service_type.category_id:
            touched.append(service.service_type.category.name)
        if service.performed_by_id:
            touched.append(service.performed_by.username)

    for part in work_order.parts.all():
        touched.append(part.description)
        if part.part_id:
            touched.append(part.part.name)
            if part.part.category_id:
                touched.append(part.part.category.name)
        if part.work_order_service_id:
            touched.append(part.work_order_service.service_type.name)
        if part.installed_component_id:
            touched.append(part.installed_component.component_type.name)
    return touched


def test_work_order_list_query_count_does_not_grow(django_assert_num_queries, notebook_type):
    _create_work_orders(1, notebook_type)

    with django_assert_num_queries(1):
        rows = list(WorkOrder.objects.with_list_data())
        _touch_work_order_list(rows)

    _create_work_orders(19, notebook_type)

    with django_assert_num_queries(1):
        rows = list(WorkOrder.objects.with_list_data())
        _touch_work_order_list(rows)

    assert len(rows) == 20


@pytest.mark.parametrize("service_count", [10, 50])
def test_work_order_detail_query_count_does_not_grow(
    django_assert_num_queries,
    notebook_type,
    storage_type,
    in_progress_status,
    service_count,
):
    work_order = _create_detailed_work_order(service_count, notebook_type, storage_type, in_progress_status)

    with django_assert_num_queries(4):
        detailed = WorkOrder.objects.with_detail_data().get(pk=work_order.pk)
        _touch_work_order_detail(detailed)


def test_equipment_list_query_count_does_not_grow(django_assert_num_queries, notebook_type):
    for index in range(20):
        _create_customer_equipment(index, notebook_type)

    with django_assert_num_queries(1):
        rows = list(Equipment.objects.with_list_data())
        touched = []
        for equipment in rows:
            touched.append((equipment.customer.name, equipment.equipment_type.name, equipment.model, equipment.status))

    assert len(rows) == 20
    assert len(touched) == 20


def test_equipment_detail_query_count_is_bounded(django_assert_num_queries, notebook_type, storage_type):
    customer, equipment = _create_customer_equipment(1, notebook_type)
    for index in range(5):
        EquipmentComponent.objects.create(
            equipment=equipment,
            component_type=storage_type,
            capacity=f"{index + 1} TB",
        )
        create_work_order(
            customer=customer,
            equipment=equipment,
            title=f"OS {index}",
            problem_description="Problema",
        )

    with django_assert_num_queries(3):
        detailed = Equipment.objects.with_detail_data().get(pk=equipment.pk)
        touched = [detailed.customer.name, detailed.equipment_type.name]
        for component in detailed.current_components:
            touched.append(component.component_type.name)
        for work_order in detailed.recent_work_orders:
            touched.extend([work_order.customer.name, work_order.status.name])
        assert touched


def test_customer_dashboard_annotations_are_single_query(django_assert_num_queries, notebook_type):
    _create_work_orders(20, notebook_type)

    with django_assert_num_queries(1):
        rows = list(Customer.objects.with_dashboard_data())
        touched = []
        for customer in rows:
            touched.append(
                (
                    customer.name,
                    customer.equipment_count,
                    customer.active_work_order_count,
                    customer.latest_work_order_at,
                )
            )

    assert len(rows) == 20
    assert len(touched) == 20
