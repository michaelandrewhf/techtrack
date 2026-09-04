from calendar import monthrange

from django.contrib.auth import get_user_model
from django.utils import timezone
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from accounts.api.serializers import UserSummarySerializer
from catalog.api.serializers import (
    PartSerializer,
    PaymentMethodSummarySerializer,
    ServiceTypeSerializer,
)
from catalog.models import Part, PaymentMethod, ServiceType
from config.api_utils import validate_active
from customers.api.serializers import CustomerSummarySerializer
from customers.models import Customer
from inventory.api.serializers import EquipmentTypeSummarySerializer
from inventory.models import Equipment, EquipmentComponent
from workorders.models import (
    PaymentStatus,
    WorkOrder,
    WorkOrderBilling,
    WorkOrderPart,
    WorkOrderPriority,
    WorkOrderService,
    WorkOrderStatus,
    WorkOrderStatusHistory,
)
from workorders.services import get_latest_valid_maintenances_by_service_type


class WorkOrderStatusSerializer(serializers.ModelSerializer):
    is_terminal = serializers.BooleanField(read_only=True)
    counts_as_completed = serializers.BooleanField(read_only=True)
    counts_as_cancelled = serializers.BooleanField(read_only=True)

    class Meta:
        model = WorkOrderStatus
        fields = [
            "id",
            "name",
            "code",
            "description",
            "kind",
            "is_initial",
            "is_active",
            "sort_order",
            "is_terminal",
            "counts_as_completed",
            "counts_as_cancelled",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "is_terminal",
            "counts_as_completed",
            "counts_as_cancelled",
            "created_at",
            "updated_at",
        ]


class WorkOrderStatusSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkOrderStatus
        fields = ["id", "name", "code", "kind", "is_active"]
        read_only_fields = fields


class WorkOrderStatusHistorySerializer(serializers.ModelSerializer):
    status = WorkOrderStatusSummarySerializer(read_only=True)
    changed_by = UserSummarySerializer(read_only=True)

    class Meta:
        model = WorkOrderStatusHistory
        fields = ["id", "status", "changed_at", "changed_by", "comment", "description", "created_at"]
        read_only_fields = fields


class WorkOrderServiceSerializer(serializers.ModelSerializer):
    service_type = ServiceTypeSerializer(read_only=True)
    performed_by = UserSummarySerializer(read_only=True)

    class Meta:
        model = WorkOrderService
        fields = [
            "id",
            "service_type",
            "performed_at",
            "performed_by",
            "description",
            "notes",
            "labor_price",
            "voided_at",
            "voided_by",
            "void_reason",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class WorkOrderPartSerializer(serializers.ModelSerializer):
    part = PartSerializer(read_only=True)
    work_order_service = WorkOrderServiceSerializer(read_only=True)

    class Meta:
        model = WorkOrderPart
        fields = [
            "id",
            "work_order_service",
            "part",
            "installed_component",
            "description",
            "quantity",
            "unit_cost",
            "unit_price",
            "serial_number",
            "warranty_until",
            "voided_at",
            "voided_by",
            "void_reason",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class WorkOrderBillingSerializer(serializers.ModelSerializer):
    payment_method = PaymentMethodSummarySerializer(read_only=True)
    payment_method_id = serializers.PrimaryKeyRelatedField(
        source="payment_method",
        queryset=PaymentMethod.objects.all(),
        required=False,
        allow_null=True,
        write_only=True,
    )

    class Meta:
        model = WorkOrderBilling
        fields = [
            "id",
            "labor_total",
            "parts_total",
            "discount",
            "total_amount",
            "payment_status",
            "payment_method",
            "payment_method_id",
            "paid_at",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "payment_method", "created_at", "updated_at"]

    def validate(self, attrs):
        validate_active(
            attrs.get("payment_method", getattr(self.instance, "payment_method", None)),
            "payment_method_id",
        )
        if attrs.get("payment_status") and attrs["payment_status"] not in PaymentStatus.values:
            raise serializers.ValidationError({"payment_status": "Invalid payment status."})
        return attrs


class WorkOrderListSerializer(serializers.ModelSerializer):
    customer = CustomerSummarySerializer(read_only=True)
    equipment = serializers.SerializerMethodField()
    status = WorkOrderStatusSummarySerializer(read_only=True)
    responsible_user = UserSummarySerializer(read_only=True)
    display_number = serializers.CharField(read_only=True)

    class Meta:
        model = WorkOrder
        fields = [
            "id",
            "number",
            "display_number",
            "customer",
            "equipment",
            "status",
            "priority",
            "responsible_user",
            "title",
            "opened_at",
            "completed_at",
            "cancelled_at",
        ]
        read_only_fields = fields

    @extend_schema_field(serializers.DictField)
    def get_equipment(self, obj):
        return {
            "id": str(obj.equipment_id),
            "equipment_type": EquipmentTypeSummarySerializer(obj.equipment.equipment_type).data,
            "manufacturer": obj.equipment.manufacturer,
            "model": obj.equipment.model,
            "serial_number": obj.equipment.serial_number,
            "asset_tag": obj.equipment.asset_tag,
            "status": obj.equipment.status,
        }


class WorkOrderDetailSerializer(WorkOrderListSerializer):
    status_history = WorkOrderStatusHistorySerializer(many=True, read_only=True)
    services = WorkOrderServiceSerializer(many=True, read_only=True)
    parts = WorkOrderPartSerializer(many=True, read_only=True)
    billing = WorkOrderBillingSerializer(read_only=True)

    class Meta(WorkOrderListSerializer.Meta):
        fields = WorkOrderListSerializer.Meta.fields + [
            "problem_description",
            "started_at",
            "diagnosis",
            "service_description",
            "solution",
            "internal_notes",
            "status_history",
            "services",
            "parts",
            "billing",
            "created_at",
            "updated_at",
        ]


class WorkOrderCreateSerializer(serializers.Serializer):
    customer_id = serializers.PrimaryKeyRelatedField(source="customer", queryset=Customer.objects.all())
    equipment_id = serializers.PrimaryKeyRelatedField(source="equipment", queryset=Equipment.objects.all())
    title = serializers.CharField(max_length=255)
    problem_description = serializers.CharField()
    priority = serializers.ChoiceField(choices=WorkOrderPriority.choices, required=False)
    responsible_user = serializers.HiddenField(default=serializers.CurrentUserDefault())

    def validate(self, attrs):
        equipment = attrs["equipment"]
        customer = attrs["customer"]
        if equipment.deleted_at:
            raise serializers.ValidationError({"equipment_id": "Deleted equipment cannot be used."})
        if customer.deleted_at:
            raise serializers.ValidationError({"customer_id": "Deleted customers cannot be used."})
        if equipment.customer_id != customer.id:
            raise serializers.ValidationError({"equipment_id": "Equipment must belong to the selected customer."})
        if not equipment.equipment_type.is_active:
            raise serializers.ValidationError({"equipment_id": "Equipment type is inactive."})
        return attrs


class WorkOrderUpdateSerializer(serializers.ModelSerializer):
    responsible_user_id = serializers.PrimaryKeyRelatedField(
        source="responsible_user",
        queryset=get_user_model().objects.all(),
        required=False,
        allow_null=True,
        write_only=True,
    )

    class Meta:
        model = WorkOrder
        fields = [
            "title",
            "problem_description",
            "priority",
            "responsible_user_id",
            "diagnosis",
            "service_description",
            "solution",
            "internal_notes",
        ]

    def validate(self, attrs):
        if self.instance and self.instance.is_closed:
            raise serializers.ValidationError("Closed work orders cannot be updated through the generic endpoint.")
        return attrs


class ChangeWorkOrderStatusSerializer(serializers.Serializer):
    status_id = serializers.PrimaryKeyRelatedField(queryset=WorkOrderStatus.objects.all())
    comment = serializers.CharField(required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)

    def validate_status_id(self, value):
        validate_active(value, "status_id")
        return value


class CompleteWorkOrderSerializer(serializers.Serializer):
    diagnosis = serializers.CharField(required=False, allow_blank=True)
    service_description = serializers.CharField(required=False, allow_blank=True)
    solution = serializers.CharField(required=False, allow_blank=True)
    internal_notes = serializers.CharField(required=False, allow_blank=True)
    comment = serializers.CharField(required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)


class CancelWorkOrderSerializer(serializers.Serializer):
    comment = serializers.CharField(required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)


class RegisterWorkOrderServiceSerializer(serializers.Serializer):
    service_type_id = serializers.PrimaryKeyRelatedField(queryset=ServiceType.objects.all())
    performed_at = serializers.DateTimeField(required=False)
    description = serializers.CharField(required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    labor_price = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)

    def validate_service_type_id(self, value):
        validate_active(value, "service_type_id")
        return value


class VoidSerializer(serializers.Serializer):
    reason = serializers.CharField()


class AddWorkOrderPartSerializer(serializers.Serializer):
    work_order_service_id = serializers.PrimaryKeyRelatedField(
        queryset=WorkOrderService.objects.all(),
        required=False,
        allow_null=True,
    )
    part_id = serializers.PrimaryKeyRelatedField(queryset=Part.objects.all(), required=False, allow_null=True)
    installed_component_id = serializers.PrimaryKeyRelatedField(
        queryset=EquipmentComponent.objects.all(),
        required=False,
        allow_null=True,
    )
    description = serializers.CharField(max_length=255)
    quantity = serializers.DecimalField(max_digits=10, decimal_places=2)
    unit_cost = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)
    unit_price = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)
    serial_number = serializers.CharField(max_length=120, required=False, allow_blank=True)
    warranty_until = serializers.DateField(required=False, allow_null=True)

    def validate_part_id(self, value):
        validate_active(value, "part_id")
        if value and value.deleted_at:
            raise serializers.ValidationError("Deleted parts cannot be selected.")
        return value


def _add_interval(value, service_type):
    interval = service_type.recommended_interval_value
    if service_type.recommended_interval_unit == "days":
        return value + timezone.timedelta(days=interval)
    if service_type.recommended_interval_unit == "months":
        month = value.month - 1 + interval
        year = value.year + month // 12
        month = month % 12 + 1
        day = min(value.day, monthrange(year, month)[1])
        return value.replace(year=year, month=month, day=day)
    if service_type.recommended_interval_unit == "years":
        try:
            return value.replace(year=value.year + interval)
        except ValueError:
            return value.replace(year=value.year + interval, month=2, day=28)
    return None


class MaintenanceItemSerializer(serializers.ModelSerializer):
    service_type = serializers.SerializerMethodField()
    last_performed_at = serializers.SerializerMethodField()
    next_due_at = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = ServiceType
        fields = [
            "service_type",
            "last_performed_at",
            "recommended_interval_value",
            "recommended_interval_unit",
            "next_due_at",
            "status",
        ]

    def _latest_service(self, obj):
        latest_by_service_type = self.context.get("latest_by_service_type")
        if latest_by_service_type is None:
            latest_by_service_type = get_latest_valid_maintenances_by_service_type(equipment=self.context["equipment"])
            self.context["latest_by_service_type"] = latest_by_service_type
        return latest_by_service_type.get(obj.id)

    def get_service_type(self, obj):
        return {"id": str(obj.id), "name": obj.name, "slug": obj.slug}

    def get_last_performed_at(self, obj):
        latest = self._latest_service(obj)
        return latest.performed_at if latest else None

    def get_next_due_at(self, obj):
        latest = self._latest_service(obj)
        return _add_interval(latest.performed_at, obj) if latest else None

    def get_status(self, obj):
        next_due_at = self.get_next_due_at(obj)
        if next_due_at is None:
            return "never_performed"
        now = timezone.now()
        if next_due_at <= now:
            return "overdue"
        if next_due_at <= now + timezone.timedelta(days=30):
            return "upcoming"
        return "ok"
