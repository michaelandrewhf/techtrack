import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Prefetch, Q

from catalog.models import Part, PaymentMethod, ServiceType
from config.models import TimeStampedUUIDModel
from customers.models import Customer
from inventory.models import Equipment


class WorkOrderStatusKind(models.TextChoices):
    ACTIVE = "active", "Active"
    COMPLETED = "completed", "Completed"
    CANCELLED = "cancelled", "Cancelled"


class WorkOrderStatus(TimeStampedUUIDModel):
    name = models.CharField(max_length=120)
    code = models.SlugField(max_length=120, unique=True)
    description = models.TextField(blank=True)
    kind = models.CharField(max_length=20, choices=WorkOrderStatusKind, default=WorkOrderStatusKind.ACTIVE)
    is_initial = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["is_initial"],
                condition=Q(is_initial=True),
                name="single_initial_work_order_status",
            ),
        ]
        indexes = [
            models.Index(fields=["kind"], name="wo_status_kind_idx"),
            models.Index(fields=["is_active"], name="wo_status_active_idx"),
            models.Index(fields=["is_initial"], name="wo_status_initial_idx"),
        ]
        ordering = ["sort_order", "name"]
        verbose_name_plural = "Work order statuses"

    @property
    def is_terminal(self):
        return self.kind in {WorkOrderStatusKind.COMPLETED, WorkOrderStatusKind.CANCELLED}

    @property
    def counts_as_completed(self):
        return self.kind == WorkOrderStatusKind.COMPLETED

    @property
    def counts_as_cancelled(self):
        return self.kind == WorkOrderStatusKind.CANCELLED

    def __str__(self):
        return self.name


class WorkOrderPriority(models.TextChoices):
    LOW = "low", "Low"
    NORMAL = "normal", "Normal"
    HIGH = "high", "High"
    URGENT = "urgent", "Urgent"


class PaymentStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    PAID = "paid", "Paid"
    PARTIAL = "partial", "Partial"
    CANCELLED = "cancelled", "Cancelled"
    REFUNDED = "refunded", "Refunded"


class WorkOrderNumberSequence(models.Model):
    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    current_number = models.PositiveBigIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Work order number sequence"
        verbose_name_plural = "Work order number sequences"

    def __str__(self):
        return str(self.current_number)


class WorkOrderStatusHistoryQuerySet(models.QuerySet):
    def with_list_data(self):
        return self.select_related("status", "changed_by")


class WorkOrderServiceQuerySet(models.QuerySet):
    def valid(self):
        return self.filter(voided_at__isnull=True)

    def with_list_data(self):
        return self.select_related("work_order", "service_type", "performed_by")

    def for_preventive_history(self):
        return self.valid().filter(work_order__status__kind=WorkOrderStatusKind.COMPLETED)

    def for_equipment(self, equipment):
        return self.filter(work_order__equipment=equipment)


class WorkOrderPartQuerySet(models.QuerySet):
    def valid(self):
        return self.filter(voided_at__isnull=True)

    def with_list_data(self):
        return self.select_related(
            "part",
            "part__category",
            "work_order_service",
            "work_order_service__service_type",
            "installed_component",
            "installed_component__component_type",
        )


class WorkOrderQuerySet(models.QuerySet):
    def with_list_data(self):
        return self.select_related(
            "customer",
            "equipment",
            "equipment__equipment_type",
            "status",
            "responsible_user",
        )

    def with_detail_data(self):
        return (
            self.with_list_data()
            .select_related("billing", "billing__payment_method")
            .prefetch_related(
                Prefetch(
                    "status_history",
                    queryset=WorkOrderStatusHistory.objects.with_list_data().order_by("changed_at", "created_at"),
                ),
                Prefetch(
                    "services",
                    queryset=WorkOrderService.objects.valid()
                    .select_related("service_type", "service_type__category", "performed_by")
                    .order_by("-performed_at", "-created_at"),
                ),
                Prefetch(
                    "parts",
                    queryset=WorkOrderPart.objects.valid().with_list_data().order_by("created_at"),
                ),
            )
        )

    def active(self):
        return self.filter(status__kind=WorkOrderStatusKind.ACTIVE)

    def completed(self):
        return self.filter(status__kind=WorkOrderStatusKind.COMPLETED)

    def cancelled(self):
        return self.filter(status__kind=WorkOrderStatusKind.CANCELLED)


class WorkOrder(TimeStampedUUIDModel):
    number = models.PositiveBigIntegerField(unique=True, editable=False)
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="work_orders")
    equipment = models.ForeignKey(Equipment, on_delete=models.PROTECT, related_name="work_orders")
    title = models.CharField(max_length=255)
    problem_description = models.TextField()
    status = models.ForeignKey(WorkOrderStatus, on_delete=models.PROTECT, related_name="work_orders")
    priority = models.CharField(max_length=20, choices=WorkOrderPriority, default=WorkOrderPriority.NORMAL)
    opened_at = models.DateTimeField()
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    diagnosis = models.TextField(blank=True)
    service_description = models.TextField(blank=True)
    solution = models.TextField(blank=True)
    internal_notes = models.TextField(blank=True)
    responsible_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="responsible_work_orders",
    )

    objects = WorkOrderQuerySet.as_manager()

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(started_at__isnull=True) | Q(started_at__gte=models.F("opened_at")),
                name="work_order_started_after_opened",
            ),
            models.CheckConstraint(
                condition=Q(completed_at__isnull=True) | Q(completed_at__gte=models.F("opened_at")),
                name="work_order_completed_after_opened",
            ),
            models.CheckConstraint(
                condition=Q(cancelled_at__isnull=True) | Q(cancelled_at__gte=models.F("opened_at")),
                name="work_order_cancelled_after_opened",
            ),
        ]
        indexes = [
            models.Index(fields=["opened_at"], name="work_order_opened_idx"),
            models.Index(fields=["completed_at"], name="work_order_completed_idx"),
            models.Index(fields=["status", "opened_at"], name="work_order_status_opened_idx"),
            models.Index(fields=["customer", "opened_at"], name="work_order_customer_opened_idx"),
            models.Index(fields=["equipment", "opened_at"], name="work_order_equip_opened_idx"),
        ]
        ordering = ["-opened_at", "-number"]

    def clean(self):
        super().clean()
        if self.equipment_id and self.customer_id and self.equipment.customer_id != self.customer_id:
            raise ValidationError({"equipment": "Work order equipment must belong to the selected customer."})

        if self.started_at and self.opened_at and self.started_at < self.opened_at:
            raise ValidationError({"started_at": "Start date cannot be before opening date."})
        if self.completed_at and self.opened_at and self.completed_at < self.opened_at:
            raise ValidationError({"completed_at": "Completion date cannot be before opening date."})
        if self.cancelled_at and self.opened_at and self.cancelled_at < self.opened_at:
            raise ValidationError({"cancelled_at": "Cancellation date cannot be before opening date."})
        if self.status_id and self.status.counts_as_completed and not self.completed_at:
            raise ValidationError({"completed_at": "Completed work orders require a completion date."})
        if self.status_id and self.status.counts_as_cancelled and not self.cancelled_at:
            raise ValidationError({"cancelled_at": "Cancelled work orders require a cancellation date."})
        if self.status_id and not self.status.counts_as_completed and self.completed_at:
            raise ValidationError({"completed_at": "Only completed work orders can have a completion date."})
        if self.status_id and not self.status.counts_as_cancelled and self.cancelled_at:
            raise ValidationError({"cancelled_at": "Only cancelled work orders can have a cancellation date."})

    @property
    def display_number(self):
        return f"OS #{self.number:06d}"

    @property
    def is_closed(self):
        return bool(self.status_id and self.status.is_terminal)

    def __str__(self):
        return f"{self.display_number} - {self.title}"


class WorkOrderStatusHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    work_order = models.ForeignKey(WorkOrder, on_delete=models.PROTECT, related_name="status_history")
    status = models.ForeignKey(WorkOrderStatus, on_delete=models.PROTECT, related_name="history_entries")
    changed_at = models.DateTimeField()
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="work_order_status_changes",
    )
    comment = models.TextField(blank=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = WorkOrderStatusHistoryQuerySet.as_manager()

    class Meta:
        indexes = [
            models.Index(fields=["work_order", "changed_at"], name="wo_history_work_order_time_idx"),
        ]
        ordering = ["changed_at", "created_at"]
        verbose_name_plural = "Work order status history"

    def __str__(self):
        return f"{self.work_order.display_number} - {self.status} at {self.changed_at}"


class WorkOrderService(TimeStampedUUIDModel):
    work_order = models.ForeignKey(WorkOrder, on_delete=models.PROTECT, related_name="services")
    service_type = models.ForeignKey(ServiceType, on_delete=models.PROTECT, related_name="work_order_services")
    performed_at = models.DateTimeField()
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="performed_work_order_services",
    )
    description = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    labor_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    voided_at = models.DateTimeField(null=True, blank=True)
    voided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="voided_work_order_services",
    )
    void_reason = models.TextField(blank=True)

    objects = WorkOrderServiceQuerySet.as_manager()

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(labor_price__isnull=True) | Q(labor_price__gte=0),
                name="work_order_service_labor_non_negative",
            ),
        ]
        indexes = [
            models.Index(fields=["work_order", "service_type", "performed_at"], name="wo_service_lookup_idx"),
            models.Index(
                fields=["service_type", "performed_at"],
                condition=Q(voided_at__isnull=True),
                name="wo_service_valid_type_time_idx",
            ),
            models.Index(
                fields=["work_order", "performed_at"],
                condition=Q(voided_at__isnull=True),
                name="wo_service_valid_wo_time_idx",
            ),
        ]
        ordering = ["-performed_at", "-created_at"]

    def clean(self):
        super().clean()
        if (
            self.performed_at
            and self.work_order_id
            and self.work_order.opened_at
            and self.performed_at < self.work_order.opened_at
        ):
            raise ValidationError({"performed_at": "Service date cannot be before work order opening date."})
        if self.voided_at and not self.void_reason:
            raise ValidationError({"void_reason": "Voided services require a reason."})

    def __str__(self):
        return f"{self.work_order.display_number} - {self.service_type}"


class WorkOrderPart(TimeStampedUUIDModel):
    work_order = models.ForeignKey(WorkOrder, on_delete=models.PROTECT, related_name="parts")
    work_order_service = models.ForeignKey(
        WorkOrderService,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="parts",
    )
    part = models.ForeignKey(Part, on_delete=models.SET_NULL, null=True, blank=True, related_name="work_order_usages")
    installed_component = models.ForeignKey(
        "inventory.EquipmentComponent",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="work_order_parts",
    )
    description = models.CharField(max_length=255)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    serial_number = models.CharField(max_length=120, blank=True)
    warranty_until = models.DateField(null=True, blank=True)
    voided_at = models.DateTimeField(null=True, blank=True)
    voided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="voided_work_order_parts",
    )
    void_reason = models.TextField(blank=True)

    objects = WorkOrderPartQuerySet.as_manager()

    class Meta:
        constraints = [
            models.CheckConstraint(condition=Q(quantity__gt=0), name="work_order_part_quantity_positive"),
            models.CheckConstraint(
                condition=Q(unit_cost__isnull=True) | Q(unit_cost__gte=0), name="work_order_part_cost_non_negative"
            ),
            models.CheckConstraint(
                condition=Q(unit_price__isnull=True) | Q(unit_price__gte=0), name="work_order_part_price_non_negative"
            ),
        ]
        indexes = [
            models.Index(
                fields=["work_order", "created_at"],
                condition=Q(voided_at__isnull=True),
                name="wo_part_valid_wo_created_idx",
            ),
        ]
        ordering = ["created_at"]

    def clean(self):
        super().clean()
        if (
            self.work_order_service_id
            and self.work_order_id
            and self.work_order_service.work_order_id != self.work_order_id
        ):
            raise ValidationError({"work_order_service": "Part service must belong to the same work order."})
        if (
            self.installed_component_id
            and self.work_order_id
            and self.installed_component.equipment_id != self.work_order.equipment_id
        ):
            raise ValidationError(
                {"installed_component": "Installed component must belong to the work order equipment."}
            )
        if self.voided_at and not self.void_reason:
            raise ValidationError({"void_reason": "Voided parts require a reason."})

    def __str__(self):
        return f"{self.work_order.display_number} - {self.description}"


class WorkOrderBilling(TimeStampedUUIDModel):
    work_order = models.OneToOneField(WorkOrder, on_delete=models.PROTECT, related_name="billing")
    labor_total = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    parts_total = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    discount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    payment_status = models.CharField(max_length=20, choices=PaymentStatus, blank=True)
    payment_method = models.ForeignKey(
        PaymentMethod,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="billings",
    )
    paid_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(labor_total__isnull=True) | Q(labor_total__gte=0), name="wo_billing_labor_non_negative"
            ),
            models.CheckConstraint(
                condition=Q(parts_total__isnull=True) | Q(parts_total__gte=0), name="wo_billing_parts_non_negative"
            ),
            models.CheckConstraint(
                condition=Q(discount__isnull=True) | Q(discount__gte=0), name="wo_billing_discount_non_negative"
            ),
            models.CheckConstraint(
                condition=Q(total_amount__isnull=True) | Q(total_amount__gte=0), name="wo_billing_total_non_negative"
            ),
        ]

    def __str__(self):
        return f"Billing for {self.work_order.display_number}"
