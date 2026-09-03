from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q

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
            models.Index(fields=["slug"], name="equipment_type_slug_idx"),
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
            models.Index(fields=["slug"], name="component_type_slug_idx"),
            models.Index(fields=["is_active"], name="component_type_active_idx"),
        ]
        ordering = ["name"]

    def __str__(self):
        return self.name


class Equipment(TimeStampedUUIDModel, SoftDeleteModel):
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="equipment")
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

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["customer", "asset_tag"],
                condition=~Q(asset_tag=""),
                name="equipment_asset_tag_unique_per_customer",
            ),
        ]
        indexes = [
            models.Index(fields=["customer"], name="equipment_customer_idx"),
            models.Index(fields=["equipment_type"], name="equipment_type_idx"),
            models.Index(fields=["status"], name="equipment_status_idx"),
            models.Index(fields=["serial_number"], name="equipment_serial_idx"),
            models.Index(fields=["asset_tag"], name="equipment_asset_tag_idx"),
        ]
        ordering = ["customer__name", "equipment_type__name", "manufacturer", "model"]

    def __str__(self):
        label = " ".join(part for part in [self.manufacturer, self.model, self.asset_tag] if part)
        return label or f"{self.equipment_type} - {self.customer}"


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
            models.Index(fields=["equipment"], name="component_equipment_idx"),
            models.Index(fields=["component_type"], name="component_type_idx"),
            models.Index(fields=["equipment", "component_type", "removed_at"], name="component_current_idx"),
        ]
        ordering = ["equipment", "component_type", "installed_at"]

    def clean(self):
        super().clean()
        if self.installed_at and self.removed_at and self.removed_at < self.installed_at:
            raise ValidationError({"removed_at": "Removal date cannot be before installation date."})
        if self.source_work_order_id and self.equipment_id and self.source_work_order.equipment_id != self.equipment_id:
            raise ValidationError({"source_work_order": "Source work order must belong to the same equipment."})

    def __str__(self):
        parts = [self.get_component_type_display(), self.manufacturer, self.model, self.capacity]
        return " ".join(part for part in parts if part)
