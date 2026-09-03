from django.db import models

from config.models import SoftDeleteModel, TimeStampedUUIDModel


class CustomerStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    INACTIVE = "inactive", "Inactive"
    PROSPECT = "prospect", "Prospect"
    BLOCKED = "blocked", "Blocked"


class Customer(TimeStampedUUIDModel, SoftDeleteModel):
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=40, blank=True)
    whatsapp = models.CharField(max_length=40, blank=True)
    email = models.EmailField(blank=True)
    notes = models.TextField(blank=True)
    customer_since = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=CustomerStatus, default=CustomerStatus.ACTIVE)

    class Meta:
        indexes = [
            models.Index(fields=["name"], name="customer_name_idx"),
            models.Index(fields=["status"], name="customer_status_idx"),
            models.Index(fields=["email"], name="customer_email_idx"),
        ]
        ordering = ["name"]

    def __str__(self):
        return self.name
