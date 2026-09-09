import django.db.models.deletion
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("finance", "0002_serviceagreement_first_billing_competence"),
        ("workorders", "0005_remove_workorder_work_order_customer_idx_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="WorkOrderChargePolicy",
            fields=[
                (
                    "id",
                    models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "mode",
                    models.CharField(
                        choices=[
                            ("agreement_included", "Incluso no plano mensal"),
                            ("agreement_extra", "Cobrado a parte"),
                        ],
                        max_length=30,
                    ),
                ),
                ("notes", models.TextField(blank=True)),
                (
                    "service_agreement",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="work_order_charge_policies",
                        to="finance.serviceagreement",
                    ),
                ),
                (
                    "work_order",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="charge_policy",
                        to="workorders.workorder",
                    ),
                ),
            ],
            options={
                "verbose_name": "Work order charge policy",
                "verbose_name_plural": "Work order charge policies",
                "indexes": [models.Index(fields=["mode"], name="wo_charge_policy_mode_idx")],
            },
        ),
    ]
