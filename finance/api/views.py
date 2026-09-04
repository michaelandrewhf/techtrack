from decimal import Decimal

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import BusinessProfile, Payment, Receivable, ReceivableStatus, ServiceAgreement
from ..services import generate_service_agreement_receivable, register_payment, void_payment
from .serializers import (
    BusinessProfileSerializer,
    GenerateAgreementReceivableSerializer,
    PaymentSerializer,
    ReceivableSerializer,
    RegisterPaymentSerializer,
    ServiceAgreementSerializer,
    VoidPaymentSerializer,
)


def _raise_api_validation(exc):
    if hasattr(exc, "message_dict"):
        raise serializers.ValidationError(exc.message_dict) from exc
    raise serializers.ValidationError(exc.messages if hasattr(exc, "messages") else str(exc)) from exc


class ServiceAgreementViewSet(viewsets.ModelViewSet):
    queryset = ServiceAgreement.objects.with_customer_data()
    serializer_class = ServiceAgreementSerializer
    filterset_fields = ["customer", "status", "billing_frequency"]
    search_fields = ["name", "customer__name", "description"]
    ordering_fields = ["starts_on", "amount", "created_at", "name"]
    ordering = ["customer__name", "name"]

    @action(detail=True, methods=["post"], url_path="generate-receivable")
    def generate_receivable(self, request, pk=None):
        serializer = GenerateAgreementReceivableSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            receivable, created = generate_service_agreement_receivable(
                agreement=self.get_object(),
                competence=serializer.validated_data["competence"],
                created_by=request.user,
            )
        except DjangoValidationError as exc:
            _raise_api_validation(exc)
        queryset = Receivable.objects.with_list_data().prefetch_related("payments__payment_method")
        receivable = queryset.get(pk=receivable.pk)
        return Response(ReceivableSerializer(receivable).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class ReceivableViewSet(viewsets.ModelViewSet):
    serializer_class = ReceivableSerializer
    filterset_fields = ["customer", "status", "origin", "service_agreement", "work_order", "due_date"]
    search_fields = ["description", "reference", "customer__name"]
    ordering_fields = ["due_date", "issued_at", "amount", "created_at"]
    ordering = ["due_date", "created_at"]

    def get_queryset(self):
        return Receivable.objects.with_list_data().prefetch_related("payments__payment_method", "payments__created_by")

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_destroy(self, instance):
        if instance.payments.valid().exists():
            raise serializers.ValidationError("Cobrancas com pagamentos nao podem ser excluidas.")
        instance.status = ReceivableStatus.CANCELLED
        instance.save(update_fields=["status", "updated_at"])

    @action(detail=True, methods=["post"], url_path="payments")
    def add_payment(self, request, pk=None):
        serializer = RegisterPaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            payment = register_payment(receivable=self.get_object(), created_by=request.user, **serializer.validated_data)
        except DjangoValidationError as exc:
            _raise_api_validation(exc)
        return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)


class PaymentViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Payment.objects.with_list_data()
    serializer_class = PaymentSerializer
    filterset_fields = ["receivable", "payment_method", "paid_at"]
    search_fields = ["reference", "receivable__description", "receivable__customer__name"]
    ordering_fields = ["paid_at", "amount", "created_at"]

    @action(detail=True, methods=["post"], url_path="void")
    def void(self, request, pk=None):
        serializer = VoidPaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            payment = void_payment(
                payment=self.get_object(),
                voided_by=request.user,
                reason=serializer.validated_data["reason"],
            )
        except DjangoValidationError as exc:
            _raise_api_validation(exc)
        return Response(PaymentSerializer(payment).data)


class FinanceDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.localdate()
        month_start = today.replace(day=1)
        open_qs = Receivable.objects.with_amounts().exclude(status=ReceivableStatus.CANCELLED)
        pending_total = open_qs.exclude(status=ReceivableStatus.PAID).aggregate(total=Sum("balance"))["total"] or Decimal("0.00")
        overdue_total = open_qs.exclude(status=ReceivableStatus.PAID).filter(due_date__lt=today).aggregate(total=Sum("balance"))["total"] or Decimal("0.00")
        received_month = Payment.objects.valid().filter(paid_at__date__gte=month_start, paid_at__date__lte=today).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
        upcoming = (
            Receivable.objects.with_list_data()
            .exclude(status__in=[ReceivableStatus.PAID, ReceivableStatus.CANCELLED])
            .filter(Q(due_date__gte=today))
            .order_by("due_date")[:8]
        )
        recent_payments = Payment.objects.valid().with_list_data().order_by("-paid_at")[:8]
        return Response(
            {
                "pending_total": pending_total,
                "overdue_total": overdue_total,
                "received_this_month": received_month,
                "upcoming": ReceivableSerializer(upcoming, many=True).data,
                "recent_payments": PaymentSerializer(recent_payments, many=True).data,
            }
        )


class BusinessProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.request.method in {"PUT", "PATCH"}:
            return [IsAdminUser()]
        return [IsAuthenticated()]

    def get(self, request):
        profile, _ = BusinessProfile.objects.get_or_create(pk=1)
        return Response(BusinessProfileSerializer(profile).data)

    def put(self, request):
        profile, _ = BusinessProfile.objects.get_or_create(pk=1)
        serializer = BusinessProfileSerializer(profile, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def patch(self, request):
        profile, _ = BusinessProfile.objects.get_or_create(pk=1)
        serializer = BusinessProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
