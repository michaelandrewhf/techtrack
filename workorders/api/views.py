from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from django.db.models import ProtectedError
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, OpenApiTypes, extend_schema
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from config.api_utils import (
    IsAuthenticatedAndStaffForWrites,
    django_validation_to_drf,
    integrity_error_response,
    protected_delete_response,
)
from workorders.api.filters import WorkOrderFilter, WorkOrderStatusFilter
from workorders.api.serializers import (
    AddWorkOrderPartSerializer,
    CancelWorkOrderSerializer,
    ChangeWorkOrderStatusSerializer,
    CompleteWorkOrderSerializer,
    RegisterWorkOrderServiceSerializer,
    VoidSerializer,
    WorkOrderBillingSerializer,
    WorkOrderCreateSerializer,
    WorkOrderDetailSerializer,
    WorkOrderListSerializer,
    WorkOrderPartSerializer,
    WorkOrderServiceSerializer,
    WorkOrderStatusHistorySerializer,
    WorkOrderStatusSerializer,
    WorkOrderUpdateSerializer,
)
from workorders.models import WorkOrder, WorkOrderPart, WorkOrderService, WorkOrderStatus
from workorders.services import (
    add_work_order_part,
    cancel_work_order,
    change_work_order_status,
    complete_work_order,
    create_work_order,
    invalidate_work_order_part,
    invalidate_work_order_service,
    register_work_order_service,
    upsert_work_order_billing,
)


def _raise_api_validation(exc):
    if isinstance(exc, DjangoValidationError):
        raise django_validation_to_drf(exc) from exc
    raise exc


class WorkOrderStatusViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedAndStaffForWrites]
    queryset = WorkOrderStatus.objects.all()
    serializer_class = WorkOrderStatusSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = WorkOrderStatusFilter
    search_fields = ["name", "code", "description"]
    ordering_fields = ["sort_order", "name", "code", "kind", "created_at"]
    ordering = ["sort_order", "name"]

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError as exc:
            return protected_delete_response(exc)
        except IntegrityError as exc:
            return integrity_error_response(exc)


class WorkOrderViewSet(viewsets.ModelViewSet):
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = WorkOrderFilter
    search_fields = [
        "number",
        "title",
        "problem_description",
        "customer__name",
        "equipment__manufacturer",
        "equipment__model",
        "equipment__serial_number",
        "equipment__asset_tag",
    ]
    ordering_fields = ["number", "opened_at", "completed_at", "priority"]
    ordering = ["-opened_at", "-number"]

    def get_queryset(self):
        if self.action == "list":
            return WorkOrder.objects.with_list_data()
        return WorkOrder.objects.with_detail_data()

    def get_serializer_class(self):
        if self.action == "list":
            return WorkOrderListSerializer
        if self.action == "create":
            return WorkOrderCreateSerializer
        if self.action in {"partial_update", "update"}:
            return WorkOrderUpdateSerializer
        return WorkOrderDetailSerializer

    @extend_schema(request=WorkOrderCreateSerializer, responses={201: WorkOrderDetailSerializer})
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            work_order = create_work_order(**serializer.validated_data)
        except DjangoValidationError as exc:
            raise django_validation_to_drf(exc) from exc
        output = WorkOrderDetailSerializer(WorkOrder.objects.with_detail_data().get(pk=work_order.pk))
        return Response(output.data, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        instance = serializer.save()
        try:
            instance.full_clean()
        except DjangoValidationError as exc:
            raise django_validation_to_drf(exc) from exc

    @extend_schema(responses={405: OpenApiResponse(description="Work orders cannot be deleted through the API.")})
    def destroy(self, request, *args, **kwargs):
        return Response(
            {"detail": "Work orders are historical records and cannot be deleted through the API."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    @extend_schema(responses=WorkOrderStatusHistorySerializer(many=True))
    @action(detail=True, methods=["get"], url_path="timeline")
    def timeline(self, request, pk=None):
        work_order = self.get_object()
        queryset = work_order.status_history.all()
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = WorkOrderStatusHistorySerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = WorkOrderStatusHistorySerializer(queryset, many=True)
        return Response(serializer.data)

    @extend_schema(request=ChangeWorkOrderStatusSerializer, responses=WorkOrderDetailSerializer)
    @action(detail=True, methods=["post"], url_path="change-status")
    def change_status(self, request, pk=None):
        work_order = self.get_object()
        serializer = ChangeWorkOrderStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            changed = change_work_order_status(
                work_order=work_order,
                status=serializer.validated_data["status_id"],
                changed_by=request.user,
                comment=serializer.validated_data.get("comment", ""),
                description=serializer.validated_data.get("description", ""),
            )
        except DjangoValidationError as exc:
            _raise_api_validation(exc)
        return Response(WorkOrderDetailSerializer(WorkOrder.objects.with_detail_data().get(pk=changed.pk)).data)

    @extend_schema(request=CompleteWorkOrderSerializer, responses=WorkOrderDetailSerializer)
    @action(detail=True, methods=["post"], url_path="complete")
    def complete(self, request, pk=None):
        work_order = self.get_object()
        if work_order.is_closed:
            return Response(
                {"detail": "Closed work orders cannot be completed again through the API."},
                status=status.HTTP_409_CONFLICT,
            )
        serializer = CompleteWorkOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        for field in ["diagnosis", "service_description", "solution", "internal_notes"]:
            if field in data:
                setattr(work_order, field, data[field])
        try:
            work_order.full_clean()
            work_order.save(
                update_fields=["diagnosis", "service_description", "solution", "internal_notes", "updated_at"]
            )
            completed = complete_work_order(
                work_order=work_order,
                changed_by=request.user,
                comment=data.get("comment", ""),
                description=data.get("description", ""),
            )
        except DjangoValidationError as exc:
            _raise_api_validation(exc)
        return Response(WorkOrderDetailSerializer(WorkOrder.objects.with_detail_data().get(pk=completed.pk)).data)

    @extend_schema(request=CancelWorkOrderSerializer, responses=WorkOrderDetailSerializer)
    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        work_order = self.get_object()
        serializer = CancelWorkOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            cancelled = cancel_work_order(
                work_order=work_order,
                changed_by=request.user,
                comment=serializer.validated_data.get("comment", ""),
                description=serializer.validated_data.get("description", ""),
            )
        except DjangoValidationError as exc:
            _raise_api_validation(exc)
        return Response(WorkOrderDetailSerializer(WorkOrder.objects.with_detail_data().get(pk=cancelled.pk)).data)

    @extend_schema(methods=["GET"], responses=WorkOrderServiceSerializer(many=True))
    @extend_schema(
        methods=["POST"],
        request=RegisterWorkOrderServiceSerializer,
        responses={201: WorkOrderServiceSerializer},
    )
    @action(detail=True, methods=["get", "post"], url_path="services")
    def services(self, request, pk=None):
        work_order = self.get_object()
        if request.method == "GET":
            queryset = work_order.services.all()
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = WorkOrderServiceSerializer(page, many=True)
                return self.get_paginated_response(serializer.data)
            serializer = WorkOrderServiceSerializer(queryset, many=True)
            return Response(serializer.data)

        serializer = RegisterWorkOrderServiceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            service = register_work_order_service(
                work_order=work_order,
                service_type=serializer.validated_data["service_type_id"],
                performed_at=serializer.validated_data.get("performed_at"),
                performed_by=request.user,
                description=serializer.validated_data.get("description", ""),
                notes=serializer.validated_data.get("notes", ""),
                labor_price=serializer.validated_data.get("labor_price"),
            )
        except DjangoValidationError as exc:
            _raise_api_validation(exc)
        return Response(
            WorkOrderServiceSerializer(WorkOrderService.objects.with_list_data().get(pk=service.pk)).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(
        request=VoidSerializer,
        responses=WorkOrderServiceSerializer,
        parameters=[OpenApiParameter("service_id", OpenApiTypes.UUID, OpenApiParameter.PATH)],
    )
    @action(detail=True, methods=["post"], url_path=r"services/(?P<service_id>[^/.]+)/void")
    def void_service(self, request, pk=None, service_id=None):
        self.get_object()
        serializer = VoidSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        service = get_object_or_404(WorkOrderService.objects.all(), pk=service_id, work_order_id=pk)
        try:
            voided = invalidate_work_order_service(
                service=service,
                voided_by=request.user,
                void_reason=serializer.validated_data["reason"],
            )
        except DjangoValidationError as exc:
            _raise_api_validation(exc)
        return Response(WorkOrderServiceSerializer(WorkOrderService.objects.with_list_data().get(pk=voided.pk)).data)

    @extend_schema(methods=["GET"], responses=WorkOrderPartSerializer(many=True))
    @extend_schema(methods=["POST"], request=AddWorkOrderPartSerializer, responses={201: WorkOrderPartSerializer})
    @action(detail=True, methods=["get", "post"], url_path="parts")
    def parts(self, request, pk=None):
        work_order = self.get_object()
        if request.method == "GET":
            queryset = work_order.parts.all()
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = WorkOrderPartSerializer(page, many=True)
                return self.get_paginated_response(serializer.data)
            serializer = WorkOrderPartSerializer(queryset, many=True)
            return Response(serializer.data)

        serializer = AddWorkOrderPartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            part = add_work_order_part(
                work_order=work_order,
                work_order_service=serializer.validated_data.get("work_order_service_id"),
                part=serializer.validated_data.get("part_id"),
                installed_component=serializer.validated_data.get("installed_component_id"),
                description=serializer.validated_data["description"],
                quantity=serializer.validated_data["quantity"],
                unit_cost=serializer.validated_data.get("unit_cost"),
                unit_price=serializer.validated_data.get("unit_price"),
                serial_number=serializer.validated_data.get("serial_number", ""),
                warranty_until=serializer.validated_data.get("warranty_until"),
            )
        except DjangoValidationError as exc:
            _raise_api_validation(exc)
        return Response(
            WorkOrderPartSerializer(WorkOrderPart.objects.valid().with_list_data().get(pk=part.pk)).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(
        request=VoidSerializer,
        responses=WorkOrderPartSerializer,
        parameters=[OpenApiParameter("part_id", OpenApiTypes.UUID, OpenApiParameter.PATH)],
    )
    @action(detail=True, methods=["post"], url_path=r"parts/(?P<part_id>[^/.]+)/void")
    def void_part(self, request, pk=None, part_id=None):
        self.get_object()
        serializer = VoidSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        part = get_object_or_404(WorkOrderPart.objects.all(), pk=part_id, work_order_id=pk)
        try:
            voided = invalidate_work_order_part(
                part=part,
                voided_by=request.user,
                void_reason=serializer.validated_data["reason"],
            )
        except DjangoValidationError as exc:
            _raise_api_validation(exc)
        return Response(WorkOrderPartSerializer(WorkOrderPart.objects.with_list_data().get(pk=voided.pk)).data)

    @extend_schema(
        methods=["GET"],
        responses={200: WorkOrderBillingSerializer, 404: OpenApiResponse(description="Billing not found.")},
    )
    @extend_schema(methods=["PUT", "PATCH"], request=WorkOrderBillingSerializer, responses=WorkOrderBillingSerializer)
    @action(detail=True, methods=["get", "put", "patch"], url_path="billing")
    def billing(self, request, pk=None):
        work_order = self.get_object()
        if request.method == "GET":
            if not hasattr(work_order, "billing"):
                return Response({"detail": "Billing not found."}, status=status.HTTP_404_NOT_FOUND)
            serializer = WorkOrderBillingSerializer(work_order.billing)
            return Response(serializer.data)

        partial = request.method == "PATCH"
        current = getattr(work_order, "billing", None)
        serializer = WorkOrderBillingSerializer(current, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        data = {}
        if partial and current:
            data = {
                "labor_total": current.labor_total,
                "parts_total": current.parts_total,
                "discount": current.discount,
                "total_amount": current.total_amount,
                "payment_status": current.payment_status,
                "payment_method": current.payment_method,
                "paid_at": current.paid_at,
                "notes": current.notes,
            }
        data.update(serializer.validated_data)
        try:
            billing = upsert_work_order_billing(work_order=work_order, **data)
        except DjangoValidationError as exc:
            _raise_api_validation(exc)
        return Response(WorkOrderBillingSerializer(billing).data)
