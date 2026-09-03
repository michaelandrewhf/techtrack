import pytest
from django.core.exceptions import ValidationError
from django.db.models import ProtectedError

from customers.models import Customer
from inventory.models import ComponentType, Equipment, EquipmentComponent, EquipmentType
from workorders.services import create_work_order


@pytest.fixture
def customer(db):
    return Customer.objects.create(name="Cliente")


@pytest.fixture
def notebook_type(db):
    return EquipmentType.objects.get(slug="notebook")


@pytest.fixture
def desktop_type(db):
    return EquipmentType.objects.get(slug="desktop")


@pytest.fixture
def ram_type(db):
    return ComponentType.objects.get(slug="ram")


@pytest.fixture
def storage_type(db):
    return ComponentType.objects.get(slug="storage")


def test_create_equipment(customer):
    equipment_type = EquipmentType.objects.get(slug="notebook")
    equipment = Equipment.objects.create(customer=customer, equipment_type=equipment_type, manufacturer="Dell")

    assert equipment.customer == customer
    assert equipment.equipment_type == equipment_type


def test_create_new_equipment_type_and_use_it(customer):
    nvr_type = EquipmentType.objects.create(name="NVR", slug="nvr")
    equipment = Equipment.objects.create(customer=customer, equipment_type=nvr_type, manufacturer="Intelbras")

    assert equipment.equipment_type == nvr_type


def test_inactive_equipment_type_does_not_break_existing_equipment(customer, notebook_type):
    equipment = Equipment.objects.create(customer=customer, equipment_type=notebook_type)
    notebook_type.is_active = False
    notebook_type.save(update_fields=["is_active", "updated_at"])

    equipment.refresh_from_db()
    assert equipment.equipment_type == notebook_type
    assert equipment.equipment_type.is_active is False


def test_used_equipment_type_delete_is_protected(customer, notebook_type):
    Equipment.objects.create(customer=customer, equipment_type=notebook_type)

    with pytest.raises(ProtectedError):
        notebook_type.delete()


def test_create_new_component_type_and_use_it(customer, notebook_type):
    wifi_card = ComponentType.objects.create(name="Placa Wi-Fi", slug="wifi-card")
    equipment = Equipment.objects.create(customer=customer, equipment_type=notebook_type)
    component = EquipmentComponent.objects.create(equipment=equipment, component_type=wifi_card)

    assert component.component_type == wifi_card


def test_equipment_component_history_dates(customer, notebook_type, ram_type):
    equipment = Equipment.objects.create(customer=customer, equipment_type=notebook_type)
    old_ram = EquipmentComponent.objects.create(
        equipment=equipment,
        component_type=ram_type,
        capacity="8 GB",
        installed_at="2025-01-01",
        removed_at="2026-01-01",
    )
    current_ram = EquipmentComponent.objects.create(
        equipment=equipment,
        component_type=ram_type,
        capacity="16 GB",
        installed_at="2026-01-01",
    )

    assert old_ram.removed_at is not None
    assert current_ram.removed_at is None


def test_component_removed_before_installed_fails(customer, notebook_type, storage_type):
    equipment = Equipment.objects.create(customer=customer, equipment_type=notebook_type)
    component = EquipmentComponent(
        equipment=equipment,
        component_type=storage_type,
        installed_at="2026-01-01",
        removed_at="2025-01-01",
    )

    with pytest.raises(ValidationError):
        component.full_clean()


def test_component_source_work_order_must_belong_to_same_equipment(customer, notebook_type, desktop_type, storage_type):
    first_equipment = Equipment.objects.create(customer=customer, equipment_type=notebook_type)
    second_equipment = Equipment.objects.create(customer=customer, equipment_type=desktop_type)
    work_order = create_work_order(
        customer=customer,
        equipment=first_equipment,
        title="OS",
        problem_description="Problema",
    )
    component = EquipmentComponent(
        equipment=second_equipment,
        source_work_order=work_order,
        component_type=storage_type,
    )

    with pytest.raises(ValidationError):
        component.full_clean()
