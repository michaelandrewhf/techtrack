from django.db import models
from django.db.models import Q

from config.models import SoftDeleteModel, TimeStampedUUIDModel


class IntervalUnit(models.TextChoices):
    DAYS = "days", "Days"
    MONTHS = "months", "Months"
    YEARS = "years", "Years"


class ServiceCategory(TimeStampedUUIDModel):
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=120, unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        indexes = [
            models.Index(fields=["is_active"], name="service_category_active_idx"),
        ]
        ordering = ["name"]
        verbose_name_plural = "Service categories"

    def __str__(self):
        return self.name


class PartCategory(TimeStampedUUIDModel):
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=120, unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        indexes = [
            models.Index(fields=["is_active"], name="part_category_active_idx"),
        ]
        ordering = ["name"]
        verbose_name_plural = "Part categories"

    def __str__(self):
        return self.name


class PaymentMethod(TimeStampedUUIDModel):
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=120, unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        indexes = [
            models.Index(fields=["is_active"], name="payment_method_active_idx"),
        ]
        ordering = ["name"]

    def __str__(self):
        return self.name


class ServiceType(TimeStampedUUIDModel):
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    description = models.TextField(blank=True)
    category = models.ForeignKey(
        ServiceCategory,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="service_types",
    )
    is_recurring = models.BooleanField(default=False)
    recommended_interval_value = models.PositiveIntegerField(null=True, blank=True)
    recommended_interval_unit = models.CharField(max_length=10, choices=IntervalUnit, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(is_recurring=True, recommended_interval_value__isnull=False, recommended_interval_value__gt=0)
                    & ~Q(recommended_interval_unit="")
                )
                | Q(is_recurring=False),
                name="service_type_recurring_interval_valid",
            ),
        ]
        indexes = [
            models.Index(fields=["is_recurring"], name="service_type_recurring_idx"),
        ]
        ordering = ["name"]

    def clean(self):
        super().clean()
        if self.is_recurring:
            if not self.recommended_interval_value or self.recommended_interval_value <= 0:
                from django.core.exceptions import ValidationError

                raise ValidationError(
                    {"recommended_interval_value": "Recurring services require a positive interval value."}
                )
            if not self.recommended_interval_unit:
                from django.core.exceptions import ValidationError

                raise ValidationError({"recommended_interval_unit": "Recurring services require an interval unit."})

    def __str__(self):
        return self.name


class Part(TimeStampedUUIDModel, SoftDeleteModel):
    name = models.CharField(max_length=255)
    brand = models.CharField(max_length=120, blank=True)
    model = models.CharField(max_length=120, blank=True)
    category = models.ForeignKey(
        PartCategory,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="parts",
    )
    default_cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    default_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(default_cost__isnull=True) | Q(default_cost__gte=0),
                name="part_default_cost_non_negative",
            ),
            models.CheckConstraint(
                condition=Q(default_price__isnull=True) | Q(default_price__gte=0),
                name="part_default_price_non_negative",
            ),
        ]
        indexes = [
            models.Index(fields=["name"], name="part_name_idx"),
        ]
        ordering = ["name"]

    def __str__(self):
        return self.name
