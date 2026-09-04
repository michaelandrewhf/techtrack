from rest_framework import serializers

from catalog.models import PaymentMethod

from ..models import BusinessProfile, Payment, Receivable, ServiceAgreement


class ServiceAgreementSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.name", read_only=True)

    class Meta:
        model = ServiceAgreement
        fields = [
            "id",
            "customer",
            "customer_name",
            "name",
            "description",
            "status",
            "starts_on",
            "ends_on",
            "billing_frequency",
            "amount",
            "billing_day",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def validate(self, attrs):
        instance = self.instance or ServiceAgreement()
        for key, value in attrs.items():
            setattr(instance, key, value)
        instance.full_clean()
        return attrs


class PaymentSerializer(serializers.ModelSerializer):
    payment_method_name = serializers.CharField(source="payment_method.name", read_only=True)
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)
    voided_by_username = serializers.CharField(source="voided_by.username", read_only=True)

    class Meta:
        model = Payment
        fields = [
            "id",
            "receivable",
            "amount",
            "payment_method",
            "payment_method_name",
            "paid_at",
            "reference",
            "notes",
            "created_by",
            "created_by_username",
            "voided_at",
            "voided_by",
            "voided_by_username",
            "void_reason",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "receivable",
            "created_by",
            "voided_at",
            "voided_by",
            "void_reason",
            "created_at",
            "updated_at",
        ]


class ReceivableSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    work_order_number = serializers.IntegerField(source="work_order.number", read_only=True)
    agreement_name = serializers.CharField(source="service_agreement.name", read_only=True)
    paid_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    balance = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)

    class Meta:
        model = Receivable
        fields = [
            "id",
            "customer",
            "customer_name",
            "work_order",
            "work_order_number",
            "service_agreement",
            "agreement_name",
            "origin",
            "description",
            "reference",
            "competence",
            "issued_at",
            "due_date",
            "amount",
            "paid_amount",
            "balance",
            "status",
            "is_overdue",
            "notes",
            "created_by",
            "payments",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_by", "status", "created_at", "updated_at"]

    def validate(self, attrs):
        instance = self.instance or Receivable()
        for key, value in attrs.items():
            setattr(instance, key, value)
        instance.full_clean()
        return attrs


class RegisterPaymentSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    payment_method = serializers.PrimaryKeyRelatedField(queryset=PaymentMethod.objects.filter(is_active=True))
    paid_at = serializers.DateTimeField(required=False)
    reference = serializers.CharField(required=False, allow_blank=True, max_length=120)
    notes = serializers.CharField(required=False, allow_blank=True)


class VoidPaymentSerializer(serializers.Serializer):
    reason = serializers.CharField(min_length=1)


class GenerateAgreementReceivableSerializer(serializers.Serializer):
    competence = serializers.DateField()


class BusinessProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusinessProfile
        fields = ["name", "document", "phone", "whatsapp", "email", "address", "updated_at"]
        read_only_fields = ["updated_at"]
