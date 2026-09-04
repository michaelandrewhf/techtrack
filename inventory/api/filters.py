import django_filters

from inventory.models import ComponentType, Equipment, EquipmentComponent, EquipmentType


class EquipmentTypeFilter(django_filters.FilterSet):
    slug = django_filters.CharFilter(lookup_expr="iexact")
    is_active = django_filters.BooleanFilter()

    class Meta:
        model = EquipmentType
        fields = ["slug", "is_active"]


class ComponentTypeFilter(EquipmentTypeFilter):
    class Meta:
        model = ComponentType
        fields = ["slug", "is_active"]


class EquipmentFilter(django_filters.FilterSet):
    customer = django_filters.UUIDFilter(field_name="customer_id")
    equipment_type = django_filters.UUIDFilter(field_name="equipment_type_id")
    manufacturer = django_filters.CharFilter(lookup_expr="icontains")
    model = django_filters.CharFilter(lookup_expr="icontains")
    serial_number = django_filters.CharFilter(lookup_expr="icontains")
    asset_tag = django_filters.CharFilter(lookup_expr="icontains")

    class Meta:
        model = Equipment
        fields = ["customer", "equipment_type", "status", "manufacturer", "model", "serial_number", "asset_tag"]


class EquipmentComponentFilter(django_filters.FilterSet):
    component_type = django_filters.UUIDFilter(field_name="component_type_id")
    current = django_filters.BooleanFilter(method="filter_current")

    class Meta:
        model = EquipmentComponent
        fields = ["component_type", "current"]

    def filter_current(self, queryset, name, value):
        if value:
            return queryset.filter(removed_at__isnull=True)
        return queryset.filter(removed_at__isnull=False)
