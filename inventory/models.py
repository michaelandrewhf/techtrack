from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import OuterRef, Prefetch, Q, Subquery

from config.models import SoftDeleteModel, TimeStampedUUIDModel
from customers.models import Customer


class EquipmentStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    INACTIVE = "inactive", "Inactive"
    UNDER_MAINTENANCE = "under_maintenance", "Under maintenance"
    RETIRED = "retired", "Retired"
    LOST = "lost", "Lost"
    SOLD = "sold", "Sold"


class EquipmentType(TimeStampedUUIDModel):
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=120, unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        indexes = [
            models.Index(fields=["is_active"], name="equipment_type_active_idx"),
        ]
        ordering = ["name"]

    def __str__(self):
        return self.name


class ComponentType(TimeStampedUUIDModel):
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=120, unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        indexes = [
            models.Index(fields=["is_active"], name="component_type_active_idx"),
        ]
        ordering = ["name"]

    def __str__(self):
        return self.name


class EquipmentComponentQuerySet(models.QuerySet):
    def current(self):
        return self.filter(removed_at__isnull=True)

    def with_list_data(self):
        return self.select_related("component_type")


class EquipmentQuerySet(models.QuerySet):
    def with_list_data(self):
        return self.select_related("customer", "equipment_type")

    def with_detail_data(self):
        from workorders.models import WorkOrder

        return self.with_list_data().prefetch_related(
            Prefetch(
                "components",
                queryset=EquipmentComponent.objects.current()
                .with_list_data()
                .order_by("component_type__name", "installed_at"),
                to_attr="current_components",
            ),
            Prefetch(
                "work_orders",
                queryset=WorkOrder.objects.with_list_data().order_by("-opened_at", "-number"),
                to_attr="recent_work_orders",
            ),
        )

    def with_latest_service_at(self, service_type):
        from workorders.models import WorkOrderService, WorkOrderStatusKind

        latest_service = (
            WorkOrderService.objects.filter(
                work_order__equipment=OuterRef("pk"),
                work_order__status__kind=WorkOrderStatusKind.COMPLETED,
                service_type=service_type,
                voided_at__isnull=True,
            )
            .order_by("-performed_at", "-created_at")
            .values("performed_at")[:1]
        )
        return self.annotate(latest_service_at=Subquery(latest_service))


class Equipment(TimeStampedUUIDModel, SoftDeleteModel):
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="equipments")
    equipment_type = models.ForeignKey(EquipmentType, on_delete=models.PROTECT, related_name="equipment")
    manufacturer = models.CharField(max_length=120, blank=True)
    model = models.CharField(max_length=120, blank=True)
    serial_number = models.CharField(max_length=120, blank=True)
    asset_tag = models.CharField(max_length=120, blank=True)
    operating_system = models.CharField(max_length=120, blank=True)
    specifications = models.JSONField(default=dict, blank=True)
    acquired_at = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=30, choices=EquipmentStatus, default=EquipmentStatus.ACTIVE)

    objects = EquipmentQuerySet.as_manager()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["customer", "asset_tag"],
                condition=~Q(asset_tag=""),
                name="equipment_asset_tag_unique_per_customer",
            ),
        ]
        indexes = [
            models.Index(fields=["status"], name="equipment_status_idx"),
            models.Index(fields=["serial_number"], name="equipment_serial_idx"),
            models.Index(fields=["asset_tag"], name="equipment_asset_tag_idx"),
            models.Index(fields=["customer", "status"], name="equipment_customer_status_idx"),
        ]
        ordering = ["manufacturer", "model", "asset_tag"]

    def __str__(self):
        label = " ".join(part for part in [self.manufacturer, self.model, self.asset_tag] if part)
        return label or str(self.id)


class EquipmentComponent(TimeStampedUUIDModel):
    equipment = models.ForeignKey(Equipment, on_delete=models.PROTECT, related_name="components")
    source_work_order = models.ForeignKey(
        "workorders.WorkOrder",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="installed_components",
    )
    component_type = models.ForeignKey(ComponentType, on_delete=models.PROTECT, related_name="components")
    manufacturer = models.CharField(max_length=120, blank=True)
    model = models.CharField(max_length=120, blank=True)
    serial_number = models.CharField(max_length=120, blank=True)
    capacity = models.CharField(max_length=120, blank=True)
    specifications = models.JSONField(default=dict, blank=True)
    installed_at = models.DateField(null=True, blank=True)
    removed_at = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)

    objects = EquipmentComponentQuerySet.as_manager()

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(installed_at__isnull=True)
                | Q(removed_at__isnull=True)
                | Q(removed_at__gte=models.F("installed_at")),
                name="equipment_component_removed_after_installed",
            ),
        ]
        indexes = [
            models.Index(fields=["equipment", "component_type", "removed_at"], name="component_current_idx"),
            models.Index(
                fields=["equipment", "installed_at"],
                condition=Q(removed_at__isnull=True),
                name="component_cur_installed_idx",
            ),
        ]
        ordering = ["equipment_id", "component_type_id", "installed_at"]

    def clean(self):
        super().clean()
        if self.installed_at and self.removed_at and self.removed_at < self.installed_at:
            raise ValidationError({"removed_at": "Removal date cannot be before installation date."})
        if self.source_work_order_id and self.equipment_id and self.source_work_order.equipment_id != self.equipment_id:
            raise ValidationError({"source_work_order": "Source work order must belong to the same equipment."})

    def __str__(self):
        parts = [self.component_type.name, self.manufacturer, self.model, self.capacity]
        return " ".join(part for part in parts if part)
