from rest_framework import serializers

from catalog.models import Part, ServiceType
from customers.models import Customer
from inventory.models import Equipment
from workorders.models import WorkOrder

from ..models import GeneratedDocument, Quote, QuoteItem, QuoteItemType


class QuoteItemSerializer(serializers.ModelSerializer):
    service_type_name = serializers.CharField(source="service_type.name", read_only=True)
    part_name = serializers.CharField(source="part.name", read_only=True)
    total = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = QuoteItem
        fields = [
            "id",
            "item_type",
            "service_type",
            "service_type_name",
            "part",
            "part_name",
            "description",
            "quantity",
            "unit_price",
            "discount",
            "total",
            "sort_order",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class GeneratedDocumentSerializer(serializers.ModelSerializer):
    generated_by_username = serializers.CharField(source="generated_by.username", read_only=True)

    class Meta:
        model = GeneratedDocument
        fields = [
            "id",
            "document_type",
            "version",
            "checksum",
            "generated_at",
            "generated_by",
            "generated_by_username",
            "created_at",
        ]
        read_only_fields = fields


class QuoteSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    equipment_label = serializers.SerializerMethodField()
    work_order_number = serializers.IntegerField(source="work_order.number", read_only=True)
    display_number = serializers.CharField(read_only=True)
    items_total = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    total_amount = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    items = QuoteItemSerializer(many=True, read_only=True)
    documents = GeneratedDocumentSerializer(many=True, read_only=True)

    class Meta:
        model = Quote
        fields = [
            "id",
            "number",
            "display_number",
            "customer",
            "customer_name",
            "equipment",
            "equipment_label",
            "work_order",
            "work_order_number",
            "title",
            "description",
            "status",
            "valid_until",
            "discount",
            "notes",
            "sent_at",
            "approved_at",
            "approved_by",
            "created_by",
            "items_total",
            "total_amount",
            "items",
            "documents",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "number",
            "status",
            "sent_at",
            "approved_at",
            "approved_by",
            "created_by",
            "created_at",
            "updated_at",
        ]

    def get_equipment_label(self, obj):
        return str(obj.equipment) if obj.equipment_id else None

    def validate(self, attrs):
        instance = self.instance
        if instance is None:
            return attrs
        customer = attrs.get("customer", instance.customer)
        equipment = attrs.get("equipment", instance.equipment)
        work_order = attrs.get("work_order", instance.work_order)
        if customer.deleted_at:
            raise serializers.ValidationError({"customer": "Cliente excluido nao pode ser utilizado."})
        if equipment:
            if equipment.deleted_at:
                raise serializers.ValidationError({"equipment": "Equipamento excluido nao pode ser utilizado."})
            if equipment.customer_id != customer.id:
                raise serializers.ValidationError({"equipment": "O equipamento deve pertencer ao cliente."})
        if work_order:
            if work_order.customer_id != customer.id:
                raise serializers.ValidationError({"work_order": "A OS deve pertencer ao cliente."})
            if equipment and work_order.equipment_id != equipment.id:
                raise serializers.ValidationError({"work_order": "A OS deve pertencer ao equipamento selecionado."})
        return attrs


class QuoteCreateSerializer(serializers.Serializer):
    customer = serializers.PrimaryKeyRelatedField(queryset=Customer.objects.filter(deleted_at__isnull=True))
    equipment = serializers.PrimaryKeyRelatedField(
        queryset=Equipment.objects.filter(deleted_at__isnull=True), required=False, allow_null=True
    )
    work_order = serializers.PrimaryKeyRelatedField(queryset=WorkOrder.objects.all(), required=False, allow_null=True)
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True)
    valid_until = serializers.DateField(required=False, allow_null=True)
    discount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        customer = attrs["customer"]
        equipment = attrs.get("equipment")
        work_order = attrs.get("work_order")
        if equipment and equipment.customer_id != customer.id:
            raise serializers.ValidationError({"equipment": "O equipamento deve pertencer ao cliente."})
        if work_order and work_order.customer_id != customer.id:
            raise serializers.ValidationError({"work_order": "A OS deve pertencer ao cliente."})
        if work_order and equipment and work_order.equipment_id != equipment.id:
            raise serializers.ValidationError({"work_order": "A OS deve pertencer ao equipamento selecionado."})
        return attrs


class QuoteItemCreateSerializer(serializers.Serializer):
    item_type = serializers.ChoiceField(choices=QuoteItemType.choices)
    service_type = serializers.PrimaryKeyRelatedField(
        queryset=ServiceType.objects.filter(is_active=True), required=False, allow_null=True
    )
    part = serializers.PrimaryKeyRelatedField(
        queryset=Part.objects.filter(is_active=True), required=False, allow_null=True
    )
    description = serializers.CharField(max_length=255)
    quantity = serializers.DecimalField(max_digits=10, decimal_places=2)
    unit_price = serializers.DecimalField(max_digits=12, decimal_places=2)
    discount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    sort_order = serializers.IntegerField(required=False, min_value=0)

    def validate(self, attrs):
        item_type = attrs["item_type"]
        if item_type == QuoteItemType.SERVICE and not attrs.get("service_type"):
            raise serializers.ValidationError({"service_type": "Selecione o tipo de servico."})
        if item_type == QuoteItemType.PART and not attrs.get("part"):
            raise serializers.ValidationError({"part": "Selecione a peca."})
        subtotal = attrs["quantity"] * attrs["unit_price"]
        if attrs.get("discount", 0) > subtotal:
            raise serializers.ValidationError({"discount": "Desconto nao pode superar o subtotal do item."})
        return attrs


class QuoteTerminalSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True)
