import django_filters

from customers.models import Customer


class CustomerFilter(django_filters.FilterSet):
    name = django_filters.CharFilter(lookup_expr="icontains")
    email = django_filters.CharFilter(lookup_expr="icontains")
    phone = django_filters.CharFilter(lookup_expr="icontains")
    whatsapp = django_filters.CharFilter(lookup_expr="icontains")

    class Meta:
        model = Customer
        fields = ["name", "email", "phone", "whatsapp", "status"]
