from rest_framework import serializers

from customers.models import Customer


class CustomerSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ["id", "name", "phone", "whatsapp", "email", "status"]
        read_only_fields = fields


class CustomerListSerializer(serializers.ModelSerializer):
    equipment_count = serializers.IntegerField(read_only=True)
    active_work_order_count = serializers.IntegerField(read_only=True)
    latest_work_order_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = Customer
        fields = [
            "id",
            "name",
            "phone",
            "whatsapp",
            "email",
            "status",
            "equipment_count",
            "active_work_order_count",
            "latest_work_order_at",
        ]
        read_only_fields = fields


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = [
            "id",
            "name",
            "phone",
            "whatsapp",
            "email",
            "notes",
            "customer_since",
            "status",
            "deleted_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "deleted_at", "created_at", "updated_at"]
