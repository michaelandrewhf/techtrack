import uuid

import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("catalog", "0003_remove_part_part_category_idx_and_more"),
        ("customers", "0001_initial"),
        ("workorders", "0005_remove_workorder_work_order_customer_idx_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="BusinessProfile",
            fields=[
                ("id", models.PositiveSmallIntegerField(default=1, editable=False, primary_key=True, serialize=False)),
                ("name", models.CharField(default="TechTrack", max_length=160)),
                ("document", models.CharField(blank=True, max_length=40)),
                ("phone", models.CharField(blank=True, max_length=40)),
                ("whatsapp", models.CharField(blank=True, max_length=40)),
                ("email", models.EmailField(blank=True, max_length=254)),
                ("address", models.TextField(blank=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"verbose_name": "Business profile", "verbose_name_plural": "Business profile"},
        ),
        migrations.CreateModel(
            name="ServiceAgreement",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=160)),
                ("description", models.TextField(blank=True)),
                ("status", models.CharField(choices=[("active", "Ativo"), ("paused", "Pausado"), ("ended", "Encerrado"), ("cancelled", "Cancelado")], default="active", max_length=20)),
                ("starts_on", models.DateField()),
                ("ends_on", models.DateField(blank=True, null=True)),
                ("billing_frequency", models.CharField(choices=[("monthly", "Mensal"), ("quarterly", "Trimestral"), ("semiannual", "Semestral"), ("annual", "Anual")], default="monthly", max_length=20)),
                ("amount", models.DecimalField(decimal_places=2, max_digits=12)),
                ("billing_day", models.PositiveSmallIntegerField(default=10)),
                ("notes", models.TextField(blank=True)),
                ("customer", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="service_agreements", to="customers.customer")),
            ],
            options={
                "ordering": ["customer__name", "name"],
                "indexes": [
                    models.Index(fields=["customer", "status"], name="agreement_customer_status_idx"),
                    models.Index(fields=["status", "starts_on"], name="agreement_status_start_idx"),
                ],
                "constraints": [
                    models.CheckConstraint(condition=models.Q(("amount__gte", 0)), name="agreement_amount_non_negative"),
                    models.CheckConstraint(condition=models.Q(("billing_day__gte", 1), ("billing_day__lte", 31)), name="agreement_billing_day_valid"),
                    models.CheckConstraint(condition=models.Q(("ends_on__isnull", True), ("ends_on__gte", models.F("starts_on")), _connector="OR"), name="agreement_end_after_start"),
                ],
            },
        ),
        migrations.CreateModel(
            name="Receivable",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("origin", models.CharField(choices=[("work_order", "Ordem de servico"), ("agreement", "Mensalidade/contrato"), ("manual", "Lancamento manual")], max_length=20)),
                ("description", models.CharField(max_length=255)),
                ("reference", models.CharField(blank=True, max_length=120)),
                ("competence", models.DateField(blank=True, help_text="Primeiro dia do mes de competencia.", null=True)),
                ("issued_at", models.DateField(default=django.utils.timezone.localdate)),
                ("due_date", models.DateField()),
                ("amount", models.DecimalField(decimal_places=2, max_digits=12)),
                ("status", models.CharField(choices=[("pending", "Pendente"), ("partial", "Parcial"), ("paid", "Pago"), ("cancelled", "Cancelado")], default="pending", max_length=20)),
                ("notes", models.TextField(blank=True)),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="created_receivables", to=settings.AUTH_USER_MODEL)),
                ("customer", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="receivables", to="customers.customer")),
                ("service_agreement", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="receivables", to="finance.serviceagreement")),
                ("work_order", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="receivables", to="workorders.workorder")),
            ],
            options={
                "ordering": ["due_date", "created_at"],
                "indexes": [
                    models.Index(fields=["customer", "due_date"], name="receivable_customer_due_idx"),
                    models.Index(fields=["status", "due_date"], name="receivable_status_due_idx"),
                    models.Index(fields=["origin", "due_date"], name="receivable_origin_due_idx"),
                ],
                "constraints": [
                    models.CheckConstraint(condition=models.Q(("amount__gte", 0)), name="receivable_amount_non_negative"),
                    models.CheckConstraint(condition=models.Q(("due_date__gte", models.F("issued_at"))), name="receivable_due_after_issue"),
                    models.UniqueConstraint(condition=models.Q(("competence__isnull", False), ("service_agreement__isnull", False)), fields=("service_agreement", "competence"), name="unique_agreement_competence_receivable"),
                ],
            },
        ),
        migrations.CreateModel(
            name="Payment",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("amount", models.DecimalField(decimal_places=2, max_digits=12)),
                ("paid_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("reference", models.CharField(blank=True, max_length=120)),
                ("notes", models.TextField(blank=True)),
                ("voided_at", models.DateTimeField(blank=True, null=True)),
                ("void_reason", models.TextField(blank=True)),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="created_payments", to=settings.AUTH_USER_MODEL)),
                ("payment_method", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="payments", to="catalog.paymentmethod")),
                ("receivable", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="payments", to="finance.receivable")),
                ("voided_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="voided_payments", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-paid_at", "-created_at"],
                "indexes": [models.Index(fields=["receivable", "paid_at"], name="payment_receivable_paid_idx")],
                "constraints": [models.CheckConstraint(condition=models.Q(("amount__gt", 0)), name="payment_amount_positive")],
            },
        ),
    ]
