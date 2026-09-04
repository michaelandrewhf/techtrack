from collections import defaultdict

from django.db.models import Count
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from catalog.models import IntervalUnit, ServiceType
from customers.models import Customer, CustomerStatus
from inventory.models import Equipment, EquipmentStatus
from workorders.models import WorkOrder, WorkOrderService
from workorders.services import _add_months


class DashboardCountSerializer(serializers.Serializer):
    active = serializers.IntegerField(required=False)
    open = serializers.IntegerField(required=False)
    in_progress = serializers.IntegerField(required=False)
    completed = serializers.IntegerField(required=False)
    cancelled = serializers.IntegerField(required=False)
    overdue = serializers.IntegerField(required=False)
    upcoming = serializers.IntegerField(required=False)
    never_performed = serializers.IntegerField(required=False)


class DashboardWorkOrderSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    number = serializers.IntegerField()
    display_number = serializers.CharField()
    title = serializers.CharField()
    customer = serializers.DictField()
    status = serializers.DictField(required=False)
    opened_at = serializers.DateTimeField()


class DashboardSerializer(serializers.Serializer):
    customers = DashboardCountSerializer()
    equipment = DashboardCountSerializer()
    work_orders = DashboardCountSerializer()
    maintenance = DashboardCountSerializer()
    recent_work_orders = DashboardWorkOrderSerializer(many=True)
    awaiting_customer = DashboardWorkOrderSerializer(many=True)


def _next_due_at(performed_at, service_type):
    interval = service_type.recommended_interval_value
    if service_type.recommended_interval_unit == IntervalUnit.DAYS:
        return performed_at + timezone.timedelta(days=interval)
    if service_type.recommended_interval_unit == IntervalUnit.MONTHS:
        return _add_months(performed_at, interval)
    if service_type.recommended_interval_unit == IntervalUnit.YEARS:
        try:
            return performed_at.replace(year=performed_at.year + interval)
        except ValueError:
            return performed_at.replace(year=performed_at.year + interval, month=2, day=28)
    return None


class DashboardView(APIView):
    @extend_schema(responses=DashboardSerializer)
    def get(self, request):
        work_orders_by_code = {
            row["status__code"]: row["total"]
            for row in WorkOrder.objects.values("status__code").annotate(total=Count("id"))
        }
        work_orders_by_kind = {
            row["status__kind"]: row["total"]
            for row in WorkOrder.objects.values("status__kind").annotate(total=Count("id"))
        }

        recurring_services = list(ServiceType.objects.filter(is_recurring=True, is_active=True))
        active_equipment_ids = set(
            Equipment.objects.filter(deleted_at__isnull=True, status=EquipmentStatus.ACTIVE).values_list(
                "id",
                flat=True,
            )
        )
        latest_services = (
            WorkOrderService.objects.for_preventive_history()
            .filter(work_order__equipment_id__in=active_equipment_ids, service_type__in=recurring_services)
            .select_related("service_type", "work_order")
            .order_by("work_order__equipment_id", "service_type_id", "-performed_at", "-created_at")
        )
        latest_by_equipment_service = {}
        for service in latest_services:
            key = (service.work_order.equipment_id, service.service_type_id)
            latest_by_equipment_service.setdefault(key, service)

        maintenance = defaultdict(int)
        now = timezone.now()
        upcoming_limit = now + timezone.timedelta(days=30)
        for equipment_id in active_equipment_ids:
            for service_type in recurring_services:
                service = latest_by_equipment_service.get((equipment_id, service_type.id))
                if not service:
                    maintenance["never_performed"] += 1
                    continue
                next_due_at = _next_due_at(service.performed_at, service_type)
                if next_due_at and next_due_at <= now:
                    maintenance["overdue"] += 1
                elif next_due_at and next_due_at <= upcoming_limit:
                    maintenance["upcoming"] += 1
                else:
                    maintenance["ok"] += 1

        recent_work_orders = WorkOrder.objects.with_list_data().order_by("-opened_at", "-number")[:5]
        awaiting_customer = WorkOrder.objects.with_list_data().filter(status__code="awaiting_customer")[:5]

        return Response(
            {
                "customers": {
                    "active": Customer.objects.filter(
                        deleted_at__isnull=True,
                        status=CustomerStatus.ACTIVE,
                    ).count(),
                },
                "equipment": {
                    "active": Equipment.objects.filter(
                        deleted_at__isnull=True,
                        status=EquipmentStatus.ACTIVE,
                    ).count(),
                },
                "work_orders": {
                    "open": work_orders_by_code.get("open", 0),
                    "in_progress": work_orders_by_code.get("in_progress", 0),
                    "active": work_orders_by_kind.get("active", 0),
                    "completed": work_orders_by_kind.get("completed", 0),
                    "cancelled": work_orders_by_kind.get("cancelled", 0),
                },
                "maintenance": {
                    "overdue": maintenance["overdue"],
                    "upcoming": maintenance["upcoming"],
                    "never_performed": maintenance["never_performed"],
                },
                "recent_work_orders": [
                    {
                        "id": str(work_order.id),
                        "number": work_order.number,
                        "display_number": work_order.display_number,
                        "title": work_order.title,
                        "customer": {"id": str(work_order.customer_id), "name": work_order.customer.name},
                        "status": {"id": str(work_order.status_id), "name": work_order.status.name},
                        "opened_at": work_order.opened_at,
                    }
                    for work_order in recent_work_orders
                ],
                "awaiting_customer": [
                    {
                        "id": str(work_order.id),
                        "number": work_order.number,
                        "display_number": work_order.display_number,
                        "title": work_order.title,
                        "customer": {"id": str(work_order.customer_id), "name": work_order.customer.name},
                        "opened_at": work_order.opened_at,
                    }
                    for work_order in awaiting_customer
                ],
            }
        )
