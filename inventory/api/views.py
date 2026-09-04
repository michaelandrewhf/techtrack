from django.db import IntegrityError
from django.db.models import ProtectedError
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from catalog.models import ServiceType
from config.api_utils import (
    IsAuthenticatedAndStaffForWrites,
    integrity_error_response,
    protected_delete_response,
    raise_drf_validation,
)
from inventory.api.filters import ComponentTypeFilter, EquipmentComponentFilter, EquipmentFilter, EquipmentTypeFilter
from inventory.api.serializers import (
    ComponentRemovalSerializer,
    ComponentTypeSerializer,
    EquipmentComponentSerializer,
    EquipmentDetailSerializer,
    EquipmentListSerializer,
    EquipmentTypeSerializer,
    EquipmentWriteSerializer,
)
from inventory.models import ComponentType, Equipment, EquipmentType
from workorders.api.serializers import MaintenanceItemSerializer, WorkOrderListSerializer


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


class EquipmentTypeViewSet(ProtectedCatalogViewSet):
    queryset = EquipmentType.objects.all()
    serializer_class = EquipmentTypeSerializer
    filterset_class = EquipmentTypeFilter


class ComponentTypeViewSet(ProtectedCatalogViewSet):
    queryset = ComponentType.objects.all()
    serializer_class = ComponentTypeSerializer
    filterset_class = ComponentTypeFilter


class EquipmentViewSet(viewsets.ModelViewSet):
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = EquipmentFilter
    search_fields = ["manufacturer", "model", "serial_number", "asset_tag", "customer__name"]
    ordering_fields = ["manufacturer", "model", "serial_number", "asset_tag", "created_at", "status"]
    ordering = ["manufacturer", "model", "asset_tag"]

    def get_queryset(self):
        queryset = Equipment.objects.filter(deleted_at__isnull=True)
        if self.action == "list":
            return queryset.with_list_data()
        if self.action in {"retrieve", "components", "work_orders", "maintenance"}:
            return queryset.with_detail_data()
        return queryset.with_list_data()

    def get_serializer_class(self):
        if self.action == "list":
            return EquipmentListSerializer
        if self.action in {"create", "update", "partial_update"}:
            return EquipmentWriteSerializer
        return EquipmentDetailSerializer

    def perform_create(self, serializer):
        instance = serializer.save()
        try:
            instance.full_clean()
        except Exception as exc:
            instance.delete()
            raise_drf_validation(exc)

    def perform_update(self, serializer):
        instance = serializer.save()
        try:
            instance.full_clean()
        except Exception as exc:
            raise_drf_validation(exc)

    def perform_destroy(self, instance):
        instance.deleted_at = timezone.now()
        instance.save(update_fields=["deleted_at", "updated_at"])

    @action(detail=True, methods=["get", "post"], url_path="components")
    def components(self, request, pk=None):
        equipment = self.get_object()
        if request.method == "GET":
            queryset = equipment.components.with_list_data().order_by("removed_at", "component_type__name")
            filterset = EquipmentComponentFilter(request.GET, queryset=queryset)
            queryset = filterset.qs
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = EquipmentComponentSerializer(page, many=True)
                return self.get_paginated_response(serializer.data)
            serializer = EquipmentComponentSerializer(queryset, many=True)
            return Response(serializer.data)

        serializer = EquipmentComponentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        component = serializer.save(equipment=equipment)
        try:
            component.full_clean()
        except Exception as exc:
            component.delete()
            raise_drf_validation(exc)
        return Response(EquipmentComponentSerializer(component).data, status=status.HTTP_201_CREATED)

    @extend_schema(parameters=[OpenApiParameter("component_id", OpenApiTypes.UUID, OpenApiParameter.PATH)])
    @action(detail=True, methods=["post"], url_path=r"components/(?P<component_id>[^/.]+)/remove")
    def remove_component(self, request, pk=None, component_id=None):
        equipment = self.get_object()
        component = get_object_or_404(equipment.components.all(), pk=component_id)
        serializer = ComponentRemovalSerializer(data=request.data, context={"component": component})
        serializer.is_valid(raise_exception=True)
        component = serializer.save()
        return Response(EquipmentComponentSerializer(component).data)

    @action(detail=True, methods=["get"], url_path="work-orders")
    def work_orders(self, request, pk=None):
        equipment = self.get_object()
        queryset = equipment.work_orders.with_list_data().order_by("-opened_at", "-number")
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = WorkOrderListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = WorkOrderListSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"], url_path="maintenance")
    def maintenance(self, request, pk=None):
        equipment = self.get_object()
        service_types = ServiceType.objects.filter(is_recurring=True, is_active=True).select_related("category")
        serializer = MaintenanceItemSerializer(
            service_types,
            many=True,
            context={"equipment": equipment},
        )
        return Response(serializer.data)
