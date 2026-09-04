import django_filters

from workorders.models import WorkOrder, WorkOrderStatus


class WorkOrderStatusFilter(django_filters.FilterSet):
    code = django_filters.CharFilter(lookup_expr="iexact")
    is_active = django_filters.BooleanFilter()
    is_initial = django_filters.BooleanFilter()

    class Meta:
        model = WorkOrderStatus
        fields = ["code", "kind", "is_active", "is_initial"]


class WorkOrderFilter(django_filters.FilterSet):
    customer = django_filters.UUIDFilter(field_name="customer_id")
    equipment = django_filters.UUIDFilter(field_name="equipment_id")
    status = django_filters.UUIDFilter(field_name="status_id")
    status_kind = django_filters.CharFilter(field_name="status__kind")
    responsible_user = django_filters.UUIDFilter(field_name="responsible_user_id")
    opened_at_after = django_filters.DateTimeFilter(field_name="opened_at", lookup_expr="gte")
    opened_at_before = django_filters.DateTimeFilter(field_name="opened_at", lookup_expr="lte")
    completed_at_after = django_filters.DateTimeFilter(field_name="completed_at", lookup_expr="gte")
    completed_at_before = django_filters.DateTimeFilter(field_name="completed_at", lookup_expr="lte")

    class Meta:
        model = WorkOrder
        fields = [
            "number",
            "customer",
            "equipment",
            "status",
            "status_kind",
            "priority",
            "responsible_user",
            "opened_at_after",
            "opened_at_before",
            "completed_at_after",
            "completed_at_before",
        ]
