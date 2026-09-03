from django.db import models
from django.db.models import Count, Max, Q

from config.models import SoftDeleteModel, TimeStampedUUIDModel


class CustomerStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    INACTIVE = "inactive", "Inactive"
    PROSPECT = "prospect", "Prospect"
    BLOCKED = "blocked", "Blocked"


class CustomerQuerySet(models.QuerySet):
    def with_dashboard_data(self):
        return self.annotate(
            equipment_count=Count("equipments", distinct=True),
            active_work_order_count=Count(
                "work_orders",
                filter=Q(work_orders__status__kind="active"),
                distinct=True,
            ),
            latest_work_order_at=Max("work_orders__opened_at"),
        )

    def with_detail_data(self):
        from django.db.models import Prefetch

        from inventory.models import Equipment
        from workorders.models import WorkOrder

        return self.prefetch_related(
            Prefetch("equipments", queryset=Equipment.objects.with_list_data()),
            Prefetch("work_orders", queryset=WorkOrder.objects.with_list_data().order_by("-opened_at", "-number")),
        )


class Customer(TimeStampedUUIDModel, SoftDeleteModel):
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=40, blank=True)
    whatsapp = models.CharField(max_length=40, blank=True)
    email = models.EmailField(blank=True)
    notes = models.TextField(blank=True)
    customer_since = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=CustomerStatus, default=CustomerStatus.ACTIVE)

    objects = CustomerQuerySet.as_manager()

    class Meta:
        indexes = [
            models.Index(fields=["name"], name="customer_name_idx"),
            models.Index(fields=["status"], name="customer_status_idx"),
            models.Index(fields=["email"], name="customer_email_idx"),
        ]
        ordering = ["name"]

    def __str__(self):
        return self.name
