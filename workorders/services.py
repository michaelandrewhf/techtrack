from calendar import monthrange

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from catalog.models import IntervalUnit, ServiceType

from .models import (
    WorkOrder,
    WorkOrderNumberSequence,
    WorkOrderPart,
    WorkOrderService,
    WorkOrderStatus,
    WorkOrderStatusHistory,
    WorkOrderStatusKind,
)


def _next_work_order_number():
    with transaction.atomic():
        try:
            sequence = WorkOrderNumberSequence.objects.select_for_update().get(pk=1)
        except WorkOrderNumberSequence.DoesNotExist:
            try:
                sequence = WorkOrderNumberSequence.objects.create(pk=1, current_number=0)
            except IntegrityError:
                sequence = WorkOrderNumberSequence.objects.select_for_update().get(pk=1)

        sequence.current_number += 1
        sequence.save(update_fields=["current_number", "updated_at"])
        return sequence.current_number


def get_initial_work_order_status():
    try:
        return WorkOrderStatus.objects.get(is_initial=True)
    except WorkOrderStatus.DoesNotExist as exc:
        raise ValidationError("An initial work order status must be configured.") from exc
    except WorkOrderStatus.MultipleObjectsReturned as exc:
        raise ValidationError("Only one initial work order status can be configured.") from exc


def get_completed_work_order_status():
    try:
        return (
            WorkOrderStatus.objects.filter(kind=WorkOrderStatusKind.COMPLETED, is_active=True)
            .order_by("sort_order", "name")
            .get()
        )
    except WorkOrderStatus.DoesNotExist as exc:
        raise ValidationError("A completed work order status must be configured.") from exc
    except WorkOrderStatus.MultipleObjectsReturned:
        return (
            WorkOrderStatus.objects.filter(kind=WorkOrderStatusKind.COMPLETED, is_active=True)
            .order_by("sort_order", "name")
            .first()
        )


@transaction.atomic
def create_work_order(
    *, customer, equipment, title, problem_description, opened_at=None, priority=None, responsible_user=None
):
    opened_at = opened_at or timezone.now()
    work_order = WorkOrder(
        number=_next_work_order_number(),
        customer=customer,
        equipment=equipment,
        status=get_initial_work_order_status(),
        title=title,
        problem_description=problem_description,
        opened_at=opened_at,
        responsible_user=responsible_user,
    )
    if priority:
        work_order.priority = priority
    work_order.full_clean()
    work_order.save()
    WorkOrderStatusHistory.objects.create(
        work_order=work_order,
        status=work_order.status,
        changed_at=opened_at,
        changed_by=responsible_user,
        comment="Work order opened.",
    )
    return work_order


@transaction.atomic
def change_work_order_status(*, work_order, status, changed_by=None, comment="", description="", changed_at=None):
    changed_at = changed_at or timezone.now()
    work_order = WorkOrder.objects.select_related("status").select_for_update().get(pk=work_order.pk)
    previous_status = work_order.status

    if work_order.is_closed and status != work_order.status:
        raise ValidationError("Closed work orders cannot be reopened by the basic domain service.")

    work_order.status = status
    if status.counts_as_completed and not work_order.completed_at:
        work_order.completed_at = changed_at
    if status.counts_as_cancelled and not work_order.cancelled_at:
        work_order.cancelled_at = changed_at
    if not status.is_terminal and not status.is_initial and not work_order.started_at:
        work_order.started_at = changed_at

    work_order.full_clean()
    work_order.save()

    if previous_status != status:
        WorkOrderStatusHistory.objects.create(
            work_order=work_order,
            status=status,
            changed_at=changed_at,
            changed_by=changed_by,
            comment=comment,
            description=description,
        )
    return work_order


def complete_work_order(*, work_order, changed_by=None, comment="", description="", completed_at=None):
    return change_work_order_status(
        work_order=work_order,
        status=get_completed_work_order_status(),
        changed_by=changed_by,
        comment=comment,
        description=description,
        changed_at=completed_at,
    )


@transaction.atomic
def register_work_order_service(
    *, work_order, service_type, performed_at=None, performed_by=None, description="", notes="", labor_price=None
):
    work_order = WorkOrder.objects.select_related("status").select_for_update().get(pk=work_order.pk)
    if work_order.is_closed:
        raise ValidationError("Closed work orders cannot receive new services through the basic domain service.")

    service = WorkOrderService(
        work_order=work_order,
        service_type=service_type,
        performed_at=performed_at or timezone.now(),
        performed_by=performed_by,
        description=description,
        notes=notes,
        labor_price=labor_price,
    )
    service.full_clean()
    service.save()
    return service


@transaction.atomic
def invalidate_work_order_service(*, service, voided_by=None, void_reason, voided_at=None):
    service = WorkOrderService.objects.select_for_update().get(pk=service.pk)
    if service.voided_at:
        raise ValidationError("Service is already voided.")
    service.voided_at = voided_at or timezone.now()
    service.voided_by = voided_by
    service.void_reason = void_reason
    service.full_clean()
    service.save(update_fields=["voided_at", "voided_by", "void_reason", "updated_at"])
    return service


@transaction.atomic
def invalidate_work_order_part(*, part, voided_by=None, void_reason, voided_at=None):
    part = WorkOrderPart.objects.select_for_update().get(pk=part.pk)
    if part.voided_at:
        raise ValidationError("Part usage is already voided.")
    part.voided_at = voided_at or timezone.now()
    part.voided_by = voided_by
    part.void_reason = void_reason
    part.full_clean()
    part.save(update_fields=["voided_at", "voided_by", "void_reason", "updated_at"])
    return part


def get_last_valid_maintenance(*, equipment, service_type):
    return (
        WorkOrderService.objects.for_preventive_history()
        .for_equipment(equipment)
        .select_related("work_order", "service_type")
        .filter(service_type=service_type)
        .order_by("-performed_at", "-created_at")
        .first()
    )


def get_latest_valid_maintenances_by_service_type(*, equipment):
    services = (
        WorkOrderService.objects.for_preventive_history()
        .for_equipment(equipment)
        .select_related("service_type")
        .order_by("service_type_id", "-performed_at", "-created_at")
    )
    latest_by_service_type = {}
    for service in services:
        latest_by_service_type.setdefault(service.service_type_id, service)
    return latest_by_service_type


def _add_months(value, months):
    month = value.month - 1 + months
    year = value.year + month // 12
    month = month % 12 + 1
    day = min(value.day, monthrange(year, month)[1])
    return value.replace(year=year, month=month, day=day)


def calculate_next_maintenance_due_at(*, equipment, service_type: ServiceType):
    if not service_type.is_recurring:
        return None

    last_service = get_last_valid_maintenance(equipment=equipment, service_type=service_type)
    if not last_service:
        return None

    base = last_service.performed_at
    interval = service_type.recommended_interval_value
    if service_type.recommended_interval_unit == IntervalUnit.DAYS:
        return base + timezone.timedelta(days=interval)
    if service_type.recommended_interval_unit == IntervalUnit.MONTHS:
        return _add_months(base, interval)
    if service_type.recommended_interval_unit == IntervalUnit.YEARS:
        try:
            return base.replace(year=base.year + interval)
        except ValueError:
            return base.replace(year=base.year + interval, month=2, day=28)

    raise ValidationError("Recurring service type has an invalid interval unit.")
