from rest_framework import serializers

from catalog.models import IntervalUnit, Part, PartCategory, PaymentMethod, ServiceCategory, ServiceType
from config.api_utils import validate_active


class ServiceCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceCategory
        fields = ["id", "name", "slug", "description", "is_active", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class PartCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = PartCategory
        fields = ["id", "name", "slug", "description", "is_active", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class PaymentMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentMethod
        fields = ["id", "name", "slug", "description", "is_active", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class ServiceCategorySummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceCategory
        fields = ["id", "name", "slug", "is_active"]
        read_only_fields = fields


class PartCategorySummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = PartCategory
        fields = ["id", "name", "slug", "is_active"]
        read_only_fields = fields


class PaymentMethodSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentMethod
        fields = ["id", "name", "slug", "is_active"]
        read_only_fields = fields


class ServiceTypeSerializer(serializers.ModelSerializer):
    category = ServiceCategorySummarySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        source="category",
        queryset=ServiceCategory.objects.all(),
        required=False,
        allow_null=True,
        write_only=True,
    )

    class Meta:
        model = ServiceType
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "category",
            "category_id",
            "is_recurring",
            "recommended_interval_value",
            "recommended_interval_unit",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        category = attrs.get("category", getattr(self.instance, "category", None))
        validate_active(category, "category_id")

        is_recurring = attrs.get("is_recurring", getattr(self.instance, "is_recurring", False))
        value = attrs.get("recommended_interval_value", getattr(self.instance, "recommended_interval_value", None))
        unit = attrs.get("recommended_interval_unit", getattr(self.instance, "recommended_interval_unit", ""))
        if is_recurring and (not value or value <= 0):
            raise serializers.ValidationError(
                {"recommended_interval_value": "Recurring services require a positive interval value."}
            )
        if is_recurring and unit not in IntervalUnit.values:
            raise serializers.ValidationError(
                {"recommended_interval_unit": "Recurring services require an interval unit."}
            )
        return attrs


class PartSerializer(serializers.ModelSerializer):
    category = PartCategorySummarySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        source="category",
        queryset=PartCategory.objects.all(),
        required=False,
        allow_null=True,
        write_only=True,
    )

    class Meta:
        model = Part
        fields = [
            "id",
            "name",
            "brand",
            "model",
            "category",
            "category_id",
            "default_cost",
            "default_price",
            "is_active",
            "deleted_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "deleted_at", "created_at", "updated_at"]

    def validate(self, attrs):
        validate_active(attrs.get("category", getattr(self.instance, "category", None)), "category_id")
        return attrs
