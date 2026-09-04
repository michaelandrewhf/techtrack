from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import DecimalField, ExpressionWrapper, F, Prefetch, Q, Sum, Value
from django.db.models.functions import Coalesce

from catalog.models import Part, ServiceType
from config.models import TimeStampedUUIDModel
from customers.models import Customer
from inventory.models import Equipment


class QuoteStatus(models.TextChoices):
    DRAFT = "draft", "Rascunho"
    SENT = "sent", "Enviado"
    APPROVED = "approved", "Aprovado"
    REJECTED = "rejected", "Rejeitado"
    CANCELLED = "cancelled", "Cancelado"


class QuoteItemType(models.TextChoices):
    SERVICE = "service", "Servico"
    PART = "part", "Peca"
    FREE = "free", "Item livre"


class DocumentType(models.TextChoices):
    QUOTE = "quote", "Orcamento"
    WORK_ORDER = "work_order", "Ordem de servico"
    PAYMENT_RECEIPT = "payment_receipt", "Comprovante de pagamento"


class QuoteNumberSequence(models.Model):
    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    current_number = models.PositiveBigIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return str(self.current_number)


class QuoteItemQuerySet(models.QuerySet):
    def with_list_data(self):
        return self.select_related("service_type", "part")


class QuoteQuerySet(models.QuerySet):
    def with_totals(self):
        item_total = Sum(
            ExpressionWrapper(
                F("items__quantity") * F("items__unit_price") - F("items__discount"),
                output_field=DecimalField(max_digits=14, decimal_places=2),
            )
        )
        return self.annotate(
            items_total=Coalesce(item_total, Value(Decimal("0.00")), output_field=DecimalField(max_digits=14, decimal_places=2))
        ).annotate(
            total_amount=ExpressionWrapper(
                F("items_total") - F("discount"), output_field=DecimalField(max_digits=14, decimal_places=2)
            )
        )

    def with_list_data(self):
        return self.select_related("customer", "equipment", "work_order", "created_by", "approved_by").with_totals()

    def with_detail_data(self):
        return self.with_list_data().prefetch_related(
            Prefetch("items", queryset=QuoteItem.objects.with_list_data().order_by("sort_order", "created_at")),
            Prefetch("documents", queryset=GeneratedDocument.objects.order_by("-version", "-generated_at")),
        )


class Quote(TimeStampedUUIDModel):
    number = models.PositiveBigIntegerField(unique=True, editable=False)
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="quotes")
    equipment = models.ForeignKey(Equipment, on_delete=models.PROTECT, null=True, blank=True, related_name="quotes")
    work_order = models.ForeignKey(
        "workorders.WorkOrder", on_delete=models.PROTECT, null=True, blank=True, related_name="quotes"
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=QuoteStatus, default=QuoteStatus.DRAFT)
    valid_until = models.DateField(null=True, blank=True)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    notes = models.TextField(blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_quotes",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_quotes",
    )

    objects = QuoteQuerySet.as_manager()

    class Meta:
        ordering = ["-created_at", "-number"]
        indexes = [
            models.Index(fields=["customer", "created_at"], name="quote_customer_created_idx"),
            models.Index(fields=["status", "created_at"], name="quote_status_created_idx"),
            models.Index(fields=["valid_until"], name="quote_valid_until_idx"),
        ]
        constraints = [models.CheckConstraint(condition=Q(discount__gte=0), name="quote_discount_non_negative")]

    @property
    def display_number(self):
        return f"ORC #{self.number:06d}"

    @property
    def is_editable(self):
        return self.status in {QuoteStatus.DRAFT, QuoteStatus.SENT}

    def clean(self):
        super().clean()
        if self.equipment_id and self.equipment.customer_id != self.customer_id:
            raise ValidationError({"equipment": "O equipamento deve pertencer ao cliente do orcamento."})
        if self.work_order_id:
            if self.work_order.customer_id != self.customer_id:
                raise ValidationError({"work_order": "A OS deve pertencer ao cliente do orcamento."})
            if self.equipment_id and self.work_order.equipment_id != self.equipment_id:
                raise ValidationError({"work_order": "A OS deve pertencer ao mesmo equipamento do orcamento."})
        if self.status == QuoteStatus.APPROVED and not self.approved_at:
            raise ValidationError({"approved_at": "Orcamentos aprovados exigem data de aprovacao."})

    def __str__(self):
        return f"{self.display_number} - {self.customer}"


class QuoteItem(TimeStampedUUIDModel):
    quote = models.ForeignKey(Quote, on_delete=models.PROTECT, related_name="items")
    item_type = models.CharField(max_length=20, choices=QuoteItemType)
    service_type = models.ForeignKey(ServiceType, on_delete=models.PROTECT, null=True, blank=True, related_name="quote_items")
    part = models.ForeignKey(Part, on_delete=models.SET_NULL, null=True, blank=True, related_name="quote_items")
    description = models.CharField(max_length=255)
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("1.00"))
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    sort_order = models.PositiveIntegerField(default=0)

    objects = QuoteItemQuerySet.as_manager()

    class Meta:
        ordering = ["sort_order", "created_at"]
        constraints = [
            models.CheckConstraint(condition=Q(quantity__gt=0), name="quote_item_quantity_positive"),
            models.CheckConstraint(condition=Q(unit_price__gte=0), name="quote_item_price_non_negative"),
            models.CheckConstraint(condition=Q(discount__gte=0), name="quote_item_discount_non_negative"),
        ]

    @property
    def total(self):
        return self.quantity * self.unit_price - self.discount

    def clean(self):
        super().clean()
        if self.item_type == QuoteItemType.SERVICE and not self.service_type_id:
            raise ValidationError({"service_type": "Itens de servico exigem tipo de servico."})
        if self.item_type == QuoteItemType.PART and not self.part_id:
            raise ValidationError({"part": "Itens de peca exigem uma peca do catalogo."})
        if self.discount > self.quantity * self.unit_price:
            raise ValidationError({"discount": "Desconto do item nao pode superar seu subtotal."})

    def __str__(self):
        return f"{self.quote.display_number} - {self.description}"


class GeneratedDocument(TimeStampedUUIDModel):
    document_type = models.CharField(max_length=30, choices=DocumentType)
    quote = models.ForeignKey(Quote, on_delete=models.PROTECT, null=True, blank=True, related_name="documents")
    work_order = models.ForeignKey(
        "workorders.WorkOrder", on_delete=models.PROTECT, null=True, blank=True, related_name="documents"
    )
    version = models.PositiveIntegerField()
    snapshot = models.JSONField(default=dict)
    checksum = models.CharField(max_length=64)
    generated_at = models.DateTimeField()
    generated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="generated_documents",
    )

    class Meta:
        ordering = ["-generated_at", "-version"]
        constraints = [
            models.UniqueConstraint(
                fields=["document_type", "quote", "version"],
                condition=Q(quote__isnull=False),
                name="unique_quote_document_version",
            ),
            models.UniqueConstraint(
                fields=["document_type", "work_order", "version"],
                condition=Q(work_order__isnull=False),
                name="unique_work_order_document_version",
            ),
        ]

    def clean(self):
        super().clean()
        if bool(self.quote_id) == bool(self.work_order_id):
            raise ValidationError("Documento deve pertencer exatamente a um orcamento ou uma OS.")
        if self.document_type == DocumentType.QUOTE and not self.quote_id:
            raise ValidationError({"quote": "Documento de orcamento exige orcamento."})
        if self.document_type == DocumentType.WORK_ORDER and not self.work_order_id:
            raise ValidationError({"work_order": "Documento de OS exige ordem de servico."})

    def __str__(self):
        return f"{self.document_type} v{self.version}"
