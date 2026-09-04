from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import DecimalField, ExpressionWrapper, F, Q, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone

from catalog.models import PaymentMethod
from config.models import TimeStampedUUIDModel
from customers.models import Customer


class AgreementStatus(models.TextChoices):
    ACTIVE = "active", "Ativo"
    PAUSED = "paused", "Pausado"
    ENDED = "ended", "Encerrado"
    CANCELLED = "cancelled", "Cancelado"


class BillingFrequency(models.TextChoices):
    MONTHLY = "monthly", "Mensal"
    QUARTERLY = "quarterly", "Trimestral"
    SEMIANNUAL = "semiannual", "Semestral"
    ANNUAL = "annual", "Anual"


class ReceivableStatus(models.TextChoices):
    PENDING = "pending", "Pendente"
    PARTIAL = "partial", "Parcial"
    PAID = "paid", "Pago"
    CANCELLED = "cancelled", "Cancelado"


class ReceivableOrigin(models.TextChoices):
    WORK_ORDER = "work_order", "Ordem de servico"
    AGREEMENT = "agreement", "Mensalidade/contrato"
    MANUAL = "manual", "Lancamento manual"


class ServiceAgreementQuerySet(models.QuerySet):
    def with_customer_data(self):
        return self.select_related("customer")

    def active(self):
        today = timezone.localdate()
        return self.filter(status=AgreementStatus.ACTIVE, starts_on__lte=today).filter(
            Q(ends_on__isnull=True) | Q(ends_on__gte=today)
        )


class ServiceAgreement(TimeStampedUUIDModel):
    customer = models.ForeignKey(
        Customer,
        on_delete=models.PROTECT,
        related_name="service_agreements",
    )
    name = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=AgreementStatus,
        default=AgreementStatus.ACTIVE,
    )
    starts_on = models.DateField()
    ends_on = models.DateField(null=True, blank=True)
    billing_frequency = models.CharField(
        max_length=20,
        choices=BillingFrequency,
        default=BillingFrequency.MONTHLY,
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    billing_day = models.PositiveSmallIntegerField(default=10)
    notes = models.TextField(blank=True)

    objects = ServiceAgreementQuerySet.as_manager()

    class Meta:
        ordering = ["customer__name", "name"]
        indexes = [
            models.Index(
                fields=["customer", "status"],
                name="agreement_customer_status_idx",
            ),
            models.Index(
                fields=["status", "starts_on"],
                name="agreement_status_start_idx",
            ),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(amount__gte=0),
                name="agreement_amount_non_negative",
            ),
            models.CheckConstraint(
                condition=Q(billing_day__gte=1) & Q(billing_day__lte=31),
                name="agreement_billing_day_valid",
            ),
            models.CheckConstraint(
                condition=Q(ends_on__isnull=True) | Q(ends_on__gte=F("starts_on")),
                name="agreement_end_after_start",
            ),
        ]

    def clean(self):
        super().clean()
        if self.customer_id and self.customer.deleted_at:
            raise ValidationError({"customer": "Acordos nao podem ser criados para clientes excluidos."})

    def __str__(self):
        return f"{self.customer} - {self.name}"


class ReceivableQuerySet(models.QuerySet):
    def with_amounts(self):
        paid = Sum("payments__amount", filter=Q(payments__voided_at__isnull=True))
        money_field = DecimalField(max_digits=12, decimal_places=2)
        return self.annotate(
            paid_amount=Coalesce(
                paid,
                Value(Decimal("0.00")),
                output_field=money_field,
            )
        ).annotate(
            balance=ExpressionWrapper(
                F("amount") - F("paid_amount"),
                output_field=money_field,
            )
        )

    def with_list_data(self):
        return self.select_related(
            "customer",
            "work_order",
            "service_agreement",
        ).with_amounts()

    def open(self):
        return self.exclude(status__in=[ReceivableStatus.PAID, ReceivableStatus.CANCELLED])


class Receivable(TimeStampedUUIDModel):
    customer = models.ForeignKey(
        Customer,
        on_delete=models.PROTECT,
        related_name="receivables",
    )
    work_order = models.ForeignKey(
        "workorders.WorkOrder",
        on_delete=models.PROTECT,
        related_name="receivables",
        null=True,
        blank=True,
    )
    service_agreement = models.ForeignKey(
        ServiceAgreement,
        on_delete=models.PROTECT,
        related_name="receivables",
        null=True,
        blank=True,
    )
    origin = models.CharField(max_length=20, choices=ReceivableOrigin)
    description = models.CharField(max_length=255)
    reference = models.CharField(max_length=120, blank=True)
    competence = models.DateField(
        null=True,
        blank=True,
        help_text="Primeiro dia do mes de competencia.",
    )
    issued_at = models.DateField(default=timezone.localdate)
    due_date = models.DateField()
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(
        max_length=20,
        choices=ReceivableStatus,
        default=ReceivableStatus.PENDING,
    )
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_receivables",
    )

    objects = ReceivableQuerySet.as_manager()

    class Meta:
        ordering = ["due_date", "created_at"]
        indexes = [
            models.Index(
                fields=["customer", "due_date"],
                name="receivable_customer_due_idx",
            ),
            models.Index(
                fields=["status", "due_date"],
                name="receivable_status_due_idx",
            ),
            models.Index(
                fields=["origin", "due_date"],
                name="receivable_origin_due_idx",
            ),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(amount__gte=0),
                name="receivable_amount_non_negative",
            ),
            models.CheckConstraint(
                condition=Q(due_date__gte=F("issued_at")),
                name="receivable_due_after_issue",
            ),
            models.UniqueConstraint(
                fields=["service_agreement", "competence"],
                condition=Q(
                    service_agreement__isnull=False,
                    competence__isnull=False,
                ),
                name="unique_agreement_competence_receivable",
            ),
        ]

    @property
    def is_overdue(self):
        if self.status in {ReceivableStatus.PAID, ReceivableStatus.CANCELLED}:
            return False
        return self.due_date < timezone.localdate()

    def clean(self):
        super().clean()
        if self.work_order_id and self.work_order.customer_id != self.customer_id:
            raise ValidationError({"work_order": "A OS deve pertencer ao mesmo cliente da cobranca."})
        if self.service_agreement_id and self.service_agreement.customer_id != self.customer_id:
            raise ValidationError({"service_agreement": "O acordo deve pertencer ao mesmo cliente da cobranca."})
        if self.origin == ReceivableOrigin.WORK_ORDER and not self.work_order_id:
            raise ValidationError({"work_order": "Cobrancas de OS exigem uma ordem de servico."})
        if self.origin == ReceivableOrigin.AGREEMENT and not self.service_agreement_id:
            raise ValidationError({"service_agreement": "Cobrancas recorrentes exigem um acordo."})
        if self.competence and self.competence.day != 1:
            raise ValidationError({"competence": "A competencia deve usar o primeiro dia do mes."})

    def __str__(self):
        return f"{self.customer} - {self.description} - R$ {self.amount}"


class PaymentQuerySet(models.QuerySet):
    def valid(self):
        return self.filter(voided_at__isnull=True)

    def with_list_data(self):
        return self.select_related(
            "receivable",
            "receivable__customer",
            "payment_method",
            "created_by",
            "voided_by",
        )


class Payment(TimeStampedUUIDModel):
    receivable = models.ForeignKey(
        Receivable,
        on_delete=models.PROTECT,
        related_name="payments",
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.ForeignKey(
        PaymentMethod,
        on_delete=models.PROTECT,
        related_name="payments",
    )
    paid_at = models.DateTimeField(default=timezone.now)
    reference = models.CharField(max_length=120, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_payments",
    )
    voided_at = models.DateTimeField(null=True, blank=True)
    voided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="voided_payments",
    )
    void_reason = models.TextField(blank=True)

    objects = PaymentQuerySet.as_manager()

    class Meta:
        ordering = ["-paid_at", "-created_at"]
        indexes = [
            models.Index(
                fields=["receivable", "paid_at"],
                name="payment_receivable_paid_idx",
            )
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(amount__gt=0),
                name="payment_amount_positive",
            )
        ]

    def clean(self):
        super().clean()
        if self.voided_at and not self.void_reason:
            raise ValidationError({"void_reason": "Pagamentos invalidados exigem motivo."})
        if self.payment_method_id and not self.payment_method.is_active:
            raise ValidationError({"payment_method": "Metodo de pagamento inativo nao pode ser utilizado."})

    def __str__(self):
        return f"R$ {self.amount} - {self.receivable}"


class BusinessProfile(models.Model):
    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    name = models.CharField(max_length=160, default="TechTrack")
    document = models.CharField(max_length=40, blank=True)
    phone = models.CharField(max_length=40, blank=True)
    whatsapp = models.CharField(max_length=40, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Business profile"
        verbose_name_plural = "Business profile"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name
