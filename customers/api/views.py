from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from customers.api.filters import CustomerFilter
from customers.api.serializers import CustomerListSerializer, CustomerSerializer
from customers.models import Customer
from inventory.api.serializers import EquipmentListSerializer
from workorders.api.serializers import WorkOrderListSerializer


class CustomerViewSet(viewsets.ModelViewSet):
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = CustomerFilter
    search_fields = ["name", "email", "phone", "whatsapp"]
    ordering_fields = ["name", "created_at", "customer_since", "status"]
    ordering = ["name"]

    def get_queryset(self):
        queryset = Customer.objects.filter(deleted_at__isnull=True)
        if self.action == "list":
            return queryset.with_dashboard_data()
        if self.action == "retrieve":
            return queryset.with_detail_data()
        return queryset

    def get_serializer_class(self):
        if self.action == "list":
            return CustomerListSerializer
        return CustomerSerializer

    def perform_destroy(self, instance):
        instance.deleted_at = timezone.now()
        instance.save(update_fields=["deleted_at", "updated_at"])

    @action(detail=True, methods=["get"], url_path="equipment")
    def equipment(self, request, pk=None):
        customer = self.get_object()
        queryset = customer.equipments.filter(deleted_at__isnull=True).with_list_data()
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = EquipmentListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = EquipmentListSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"], url_path="work-orders")
    def work_orders(self, request, pk=None):
        customer = self.get_object()
        queryset = customer.work_orders.with_list_data().order_by("-opened_at", "-number")
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = WorkOrderListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = WorkOrderListSerializer(queryset, many=True)
        return Response(serializer.data)
