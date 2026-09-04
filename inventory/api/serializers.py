from django.utils import timezone
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from config.api_utils import validate_active
from customers.api.serializers import CustomerSummarySerializer
from customers.models import Customer
from inventory.models import ComponentType, Equipment, EquipmentComponent, EquipmentType


class EquipmentTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = EquipmentType
        fields = ["id", "name", "slug", "description", "is_active", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class ComponentTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ComponentType
        fields = ["id", "name", "slug", "description", "is_active", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class EquipmentTypeSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = EquipmentType
        fields = ["id", "name", "slug", "is_active"]
        read_only_fields = fields


class ComponentTypeSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = ComponentType
        fields = ["id", "name", "slug", "is_active"]
        read_only_fields = fields


class EquipmentListSerializer(serializers.ModelSerializer):
    customer = CustomerSummarySerializer(read_only=True)
    equipment_type = EquipmentTypeSummarySerializer(read_only=True)

    class Meta:
        model = Equipment
        fields = [
            "id",
            "customer",
            "equipment_type",
            "manufacturer",
            "model",
            "serial_number",
            "asset_tag",
            "status",
        ]
        read_only_fields = fields


class EquipmentWriteSerializer(serializers.ModelSerializer):
    customer_id = serializers.PrimaryKeyRelatedField(source="customer", queryset=Customer.objects.all())
    equipment_type_id = serializers.PrimaryKeyRelatedField(
        source="equipment_type",
        queryset=EquipmentType.objects.all(),
    )

    class Meta:
        model = Equipment
        fields = [
            "id",
            "customer_id",
            "equipment_type_id",
            "manufacturer",
            "model",
            "serial_number",
            "asset_tag",
            "operating_system",
            "specifications",
            "acquired_at",
            "notes",
            "status",
            "deleted_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "deleted_at", "created_at", "updated_at"]
        validators = []
        extra_kwargs = {
            "manufacturer": {"required": False},
            "model": {"required": False},
            "serial_number": {"required": False},
            "asset_tag": {"required": False},
            "operating_system": {"required": False},
            "specifications": {"required": False},
            "acquired_at": {"required": False},
            "notes": {"required": False},
            "status": {"required": False},
        }

    def validate(self, attrs):
        validate_active(
            attrs.get("equipment_type", getattr(self.instance, "equipment_type", None)),
            "equipment_type_id",
        )
        customer = attrs.get("customer", getattr(self.instance, "customer", None))
        if customer and customer.deleted_at:
            raise serializers.ValidationError({"customer_id": "Deleted customers cannot be selected."})
        return attrs


class EquipmentComponentSerializer(serializers.ModelSerializer):
    component_type = ComponentTypeSummarySerializer(read_only=True)
    component_type_id = serializers.PrimaryKeyRelatedField(
        source="component_type",
        queryset=ComponentType.objects.all(),
        write_only=True,
    )

    class Meta:
        model = EquipmentComponent
        fields = [
            "id",
            "equipment",
            "component_type",
            "component_type_id",
            "manufacturer",
            "model",
            "serial_number",
            "capacity",
            "specifications",
            "installed_at",
            "removed_at",
            "source_work_order",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "equipment", "removed_at", "source_work_order", "created_at", "updated_at"]

    def validate(self, attrs):
        validate_active(
            attrs.get("component_type", getattr(self.instance, "component_type", None)),
            "component_type_id",
        )
        return attrs


class EquipmentDetailSerializer(EquipmentWriteSerializer):
    customer = CustomerSummarySerializer(read_only=True)
    equipment_type = EquipmentTypeSummarySerializer(read_only=True)
    current_components = EquipmentComponentSerializer(many=True, read_only=True)
    recent_work_orders = serializers.SerializerMethodField()

    class Meta(EquipmentWriteSerializer.Meta):
        fields = [
            "id",
            "customer",
            "customer_id",
            "equipment_type",
            "equipment_type_id",
            "manufacturer",
            "model",
            "serial_number",
            "asset_tag",
            "operating_system",
            "specifications",
            "acquired_at",
            "notes",
            "status",
            "current_components",
            "recent_work_orders",
            "deleted_at",
            "created_at",
            "updated_at",
        ]

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_recent_work_orders(self, obj):
        from workorders.api.serializers import WorkOrderListSerializer

        work_orders = getattr(obj, "recent_work_orders", [])
        return WorkOrderListSerializer(work_orders[:10], many=True).data


class ComponentRemovalSerializer(serializers.Serializer):
    removed_at = serializers.DateField(required=False)

    def validate_removed_at(self, value):
        component = self.context["component"]
        if component.installed_at and value < component.installed_at:
            raise serializers.ValidationError("Removal date cannot be before installation date.")
        return value

    def save(self, **kwargs):
        component = self.context["component"]
        component.removed_at = self.validated_data.get("removed_at") or timezone.localdate()
        component.full_clean()
        component.save(update_fields=["removed_at", "updated_at"])
        return component
