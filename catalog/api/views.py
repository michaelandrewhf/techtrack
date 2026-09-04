from django.db import IntegrityError
from django.db.models import ProtectedError
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets

from catalog.api.filters import (
    PartCategoryFilter,
    PartFilter,
    PaymentMethodFilter,
    ServiceCategoryFilter,
    ServiceTypeFilter,
)
from catalog.api.serializers import (
    PartCategorySerializer,
    PartSerializer,
    PaymentMethodSerializer,
    ServiceCategorySerializer,
    ServiceTypeSerializer,
)
from catalog.models import Part, PartCategory, PaymentMethod, ServiceCategory, ServiceType
from config.api_utils import IsAuthenticatedAndStaffForWrites, integrity_error_response, protected_delete_response


class ProtectedCatalogViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedAndStaffForWrites]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    ordering_fields = ["name", "slug", "created_at", "updated_at"]
    ordering = ["name"]
    search_fields = ["name", "slug", "description"]

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError as exc:
            return protected_delete_response(exc)
        except IntegrityError as exc:
            return integrity_error_response(exc)


class ServiceCategoryViewSet(ProtectedCatalogViewSet):
    queryset = ServiceCategory.objects.all()
    serializer_class = ServiceCategorySerializer
    filterset_class = ServiceCategoryFilter


class PartCategoryViewSet(ProtectedCatalogViewSet):
    queryset = PartCategory.objects.all()
    serializer_class = PartCategorySerializer
    filterset_class = PartCategoryFilter


class PaymentMethodViewSet(ProtectedCatalogViewSet):
    queryset = PaymentMethod.objects.all()
    serializer_class = PaymentMethodSerializer
    filterset_class = PaymentMethodFilter


class ServiceTypeViewSet(ProtectedCatalogViewSet):
    queryset = ServiceType.objects.select_related("category")
    serializer_class = ServiceTypeSerializer
    filterset_class = ServiceTypeFilter
    ordering_fields = ["name", "slug", "is_recurring", "created_at", "updated_at"]
    search_fields = ["name", "slug", "description"]


class PartViewSet(ProtectedCatalogViewSet):
    queryset = Part.objects.select_related("category")
    serializer_class = PartSerializer
    filterset_class = PartFilter
    ordering_fields = ["name", "brand", "model", "created_at", "updated_at"]
    search_fields = ["name", "brand", "model"]

    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)

    def perform_destroy(self, instance):
        instance.deleted_at = timezone.now()
        instance.save(update_fields=["deleted_at", "updated_at"])
