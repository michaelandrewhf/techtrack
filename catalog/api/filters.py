import django_filters

from catalog.models import Part, PartCategory, PaymentMethod, ServiceCategory, ServiceType


class ActiveSlugFilterSet(django_filters.FilterSet):
    slug = django_filters.CharFilter(lookup_expr="iexact")
    is_active = django_filters.BooleanFilter()


class ServiceCategoryFilter(ActiveSlugFilterSet):
    class Meta:
        model = ServiceCategory
        fields = ["slug", "is_active"]


class PartCategoryFilter(ActiveSlugFilterSet):
    class Meta:
        model = PartCategory
        fields = ["slug", "is_active"]


class PaymentMethodFilter(ActiveSlugFilterSet):
    class Meta:
        model = PaymentMethod
        fields = ["slug", "is_active"]


class ServiceTypeFilter(ActiveSlugFilterSet):
    category = django_filters.UUIDFilter(field_name="category_id")
    is_recurring = django_filters.BooleanFilter()

    class Meta:
        model = ServiceType
        fields = ["slug", "category", "is_recurring", "is_active"]


class PartFilter(django_filters.FilterSet):
    category = django_filters.UUIDFilter(field_name="category_id")
    brand = django_filters.CharFilter(lookup_expr="icontains")
    model = django_filters.CharFilter(lookup_expr="icontains")
    is_active = django_filters.BooleanFilter()

    class Meta:
        model = Part
        fields = ["category", "brand", "model", "is_active"]
