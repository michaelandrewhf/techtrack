from rest_framework import serializers

from catalog.models import PaymentMethod

from ..models import BusinessProfile, Payment, Receivable, ServiceAgreement
from ..services import create_service_agreement


class ServiceAgreementSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    first_billing_mode = serializers.ChoiceField(
        choices=[("receive_now", "Receber agora"), ("next_month", "Proximo mes")],
        required=False,
        write_only=True,
    )
    first_payment_method = serializers.PrimaryKeyRelatedField(
        queryset=PaymentMethod.objects.filter(is_active=True),
        required=False,
        write_only=True,
    )

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
            "first_billing_competence",
            "first_billing_mode",
            "first_payment_method",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["first_billing_competence", "created_at", "updated_at"]

    def validate(self, attrs):
        first_billing_mode = attrs.get("first_billing_mode")
        first_payment_method = attrs.get("first_payment_method")
        if self.instance is not None and (first_billing_mode or first_payment_method):
            raise serializers.ValidationError(
                "A opcao da primeira mensalidade so pode ser definida na criacao do contrato."
            )
        if first_billing_mode == "receive_now" and first_payment_method is None:
            raise serializers.ValidationError(
                {"first_payment_method": "Informe o metodo de pagamento para receber agora."}
            )
        if first_billing_mode == "next_month" and first_payment_method is not None:
            raise serializers.ValidationError(
                {"first_payment_method": "Nao informe pagamento quando a cobranca comecar no proximo mes."}
            )

        instance = self.instance or ServiceAgreement()
        for key, value in attrs.items():
            if hasattr(instance, key):
                setattr(instance, key, value)
        instance.full_clean()
        return attrs

    def create(self, validated_data):
        first_billing_mode = validated_data.pop("first_billing_mode", None)
        first_payment_method = validated_data.pop("first_payment_method", None)
        request = self.context.get("request")
        created_by = request.user if request and request.user.is_authenticated else None
        return create_service_agreement(
            attrs=validated_data,
            first_billing_mode=first_billing_mode,
            first_payment_method=first_payment_method,
            created_by=created_by,
        )


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
