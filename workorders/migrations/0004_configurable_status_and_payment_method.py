import uuid

import django.db.models.deletion
from django.db import migrations, models

WORK_ORDER_STATUSES = {
    "open": {"name": "Aberta", "kind": "active", "is_initial": True, "sort_order": 10},
    "awaiting_diagnosis": {"name": "Aguardando diagnostico", "kind": "active", "is_initial": False, "sort_order": 20},
    "awaiting_customer": {"name": "Aguardando cliente", "kind": "active", "is_initial": False, "sort_order": 30},
    "awaiting_parts": {"name": "Aguardando peca", "kind": "active", "is_initial": False, "sort_order": 40},
    "in_progress": {"name": "Em andamento", "kind": "active", "is_initial": False, "sort_order": 50},
    "completed": {"name": "Concluida", "kind": "completed", "is_initial": False, "sort_order": 90},
    "cancelled": {"name": "Cancelada", "kind": "cancelled", "is_initial": False, "sort_order": 100},
}


def create_and_assign_statuses(apps, schema_editor):
    WorkOrder = apps.get_model("workorders", "WorkOrder")
    WorkOrderStatus = apps.get_model("workorders", "WorkOrderStatus")
    WorkOrderStatusHistory = apps.get_model("workorders", "WorkOrderStatusHistory")
    WorkOrderBilling = apps.get_model("workorders", "WorkOrderBilling")
    PaymentMethod = apps.get_model("catalog", "PaymentMethod")

    for code, values in WORK_ORDER_STATUSES.items():
        WorkOrderStatus.objects.update_or_create(code=code, defaults={**values, "is_active": True})

    for work_order in WorkOrder.objects.all():
        code = work_order.legacy_status or "open"
        status = WorkOrderStatus.objects.filter(code=code).first()
        if status is None:
            status = WorkOrderStatus.objects.create(name=code.replace("_", " ").title(), code=code, kind="active")
        work_order.status = status
        work_order.save(update_fields=["status"])

    for history in WorkOrderStatusHistory.objects.all():
        code = history.legacy_status or "open"
        status = WorkOrderStatus.objects.filter(code=code).first()
        if status is None:
            status = WorkOrderStatus.objects.create(name=code.replace("_", " ").title(), code=code, kind="active")
        history.status = status
        history.save(update_fields=["status"])

    for billing in WorkOrderBilling.objects.all():
        if not billing.legacy_payment_method:
            continue
        payment_method = PaymentMethod.objects.filter(slug=billing.legacy_payment_method).first()
        if payment_method is None:
            payment_method = PaymentMethod.objects.create(
                slug=billing.legacy_payment_method,
                name=billing.legacy_payment_method.replace("_", " ").title(),
                is_active=True,
            )
        billing.payment_method = payment_method
        billing.save(update_fields=["payment_method"])


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0002_configurable_catalog_categories"),
        ("workorders", "0003_work_order_customer_equipment_trigger"),
    ]

    operations = [
        migrations.CreateModel(
            name="WorkOrderStatus",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=120)),
                ("code", models.SlugField(max_length=120, unique=True)),
                ("description", models.TextField(blank=True)),
                (
                    "kind",
                    models.CharField(
                        choices=[("active", "Active"), ("completed", "Completed"), ("cancelled", "Cancelled")],
                        default="active",
                        max_length=20,
                    ),
                ),
                ("is_initial", models.BooleanField(default=False)),
                ("is_active", models.BooleanField(default=True)),
                ("sort_order", models.PositiveIntegerField(default=0)),
            ],
            options={
                "verbose_name_plural": "Work order statuses",
                "ordering": ["sort_order", "name"],
                "indexes": [
                    models.Index(fields=["code"], name="wo_status_code_idx"),
                    models.Index(fields=["kind"], name="wo_status_kind_idx"),
                    models.Index(fields=["is_active"], name="wo_status_active_idx"),
                    models.Index(fields=["is_initial"], name="wo_status_initial_idx"),
                ],
            },
        ),
        migrations.RemoveConstraint(model_name="workorder", name="work_order_completed_requires_completed_at"),
        migrations.RemoveConstraint(model_name="workorder", name="work_order_cancelled_requires_cancelled_at"),
        migrations.RemoveConstraint(model_name="workorder", name="work_order_completed_at_only_when_completed"),
        migrations.RemoveConstraint(model_name="workorder", name="work_order_cancelled_at_only_when_cancelled"),
        migrations.RemoveIndex(model_name="workorder", name="work_order_status_idx"),
        migrations.RenameField(model_name="workorder", old_name="status", new_name="legacy_status"),
        migrations.RenameField(model_name="workorderstatushistory", old_name="status", new_name="legacy_status"),
        migrations.RenameField(
            model_name="workorderbilling", old_name="payment_method", new_name="legacy_payment_method"
        ),
        migrations.AddField(
            model_name="workorder",
            name="status",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="work_orders",
                to="workorders.workorderstatus",
            ),
        ),
        migrations.AddField(
            model_name="workorderstatushistory",
            name="status",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="history_entries",
                to="workorders.workorderstatus",
            ),
        ),
        migrations.AddField(
            model_name="workorderbilling",
            name="payment_method",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="billings",
                to="catalog.paymentmethod",
            ),
        ),
        migrations.RunPython(create_and_assign_statuses, migrations.RunPython.noop),
        migrations.RemoveField(model_name="workorder", name="legacy_status"),
        migrations.RemoveField(model_name="workorderstatushistory", name="legacy_status"),
        migrations.RemoveField(model_name="workorderbilling", name="legacy_payment_method"),
        migrations.AlterField(
            model_name="workorder",
            name="status",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="work_orders",
                to="workorders.workorderstatus",
            ),
        ),
        migrations.AlterField(
            model_name="workorderstatushistory",
            name="status",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="history_entries",
                to="workorders.workorderstatus",
            ),
        ),
        migrations.AddIndex(
            model_name="workorder", index=models.Index(fields=["status"], name="work_order_status_idx")
        ),
        migrations.AddConstraint(
            model_name="workorderstatus",
            constraint=models.UniqueConstraint(
                condition=models.Q(("is_initial", True)),
                fields=("is_initial",),
                name="single_initial_work_order_status",
            ),
        ),
    ]
