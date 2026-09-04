import decimal
import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("catalog", "0003_remove_part_part_category_idx_and_more"),
        ("customers", "0001_initial"),
        ("inventory", "0005_alter_equipment_options_and_more"),
        ("workorders", "0005_remove_workorder_work_order_customer_idx_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="QuoteNumberSequence",
            fields=[
                (
                    "id",
                    models.PositiveSmallIntegerField(
                        default=1,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("current_number", models.PositiveBigIntegerField(default=0)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name="Quote",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("number", models.PositiveBigIntegerField(editable=False, unique=True)),
                ("title", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("draft", "Rascunho"),
                            ("sent", "Enviado"),
                            ("approved", "Aprovado"),
                            ("rejected", "Rejeitado"),
                            ("cancelled", "Cancelado"),
                        ],
                        default="draft",
                        max_length=20,
                    ),
                ),
                ("valid_until", models.DateField(blank=True, null=True)),
                (
                    "discount",
                    models.DecimalField(
                        decimal_places=2,
                        default=decimal.Decimal("0.00"),
                        max_digits=12,
                    ),
                ),
                ("notes", models.TextField(blank=True)),
                ("sent_at", models.DateTimeField(blank=True, null=True)),
                ("approved_at", models.DateTimeField(blank=True, null=True)),
                (
                    "approved_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="approved_quotes",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="created_quotes",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "customer",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="quotes",
                        to="customers.customer",
                    ),
                ),
                (
                    "equipment",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="quotes",
                        to="inventory.equipment",
                    ),
                ),
                (
                    "work_order",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="quotes",
                        to="workorders.workorder",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at", "-number"],
                "indexes": [
                    models.Index(
                        fields=["customer", "created_at"],
                        name="quote_customer_created_idx",
                    ),
                    models.Index(
                        fields=["status", "created_at"],
                        name="quote_status_created_idx",
                    ),
                    models.Index(fields=["valid_until"], name="quote_valid_until_idx"),
                ],
                "constraints": [
                    models.CheckConstraint(
                        condition=models.Q(("discount__gte", 0)),
                        name="quote_discount_non_negative",
                    )
                ],
            },
        ),
        migrations.CreateModel(
            name="QuoteItem",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "item_type",
                    models.CharField(
                        choices=[
                            ("service", "Servico"),
                            ("part", "Peca"),
                            ("free", "Item livre"),
                        ],
                        max_length=20,
                    ),
                ),
                ("description", models.CharField(max_length=255)),
                (
                    "quantity",
                    models.DecimalField(
                        decimal_places=2,
                        default=decimal.Decimal("1.00"),
                        max_digits=10,
                    ),
                ),
                ("unit_price", models.DecimalField(decimal_places=2, max_digits=12)),
                (
                    "discount",
                    models.DecimalField(
                        decimal_places=2,
                        default=decimal.Decimal("0.00"),
                        max_digits=12,
                    ),
                ),
                ("sort_order", models.PositiveIntegerField(default=0)),
                (
                    "part",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="quote_items",
                        to="catalog.part",
                    ),
                ),
                (
                    "quote",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="items",
                        to="quotes.quote",
                    ),
                ),
                (
                    "service_type",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="quote_items",
                        to="catalog.servicetype",
                    ),
                ),
            ],
            options={
                "ordering": ["sort_order", "created_at"],
                "constraints": [
                    models.CheckConstraint(
                        condition=models.Q(("quantity__gt", 0)),
                        name="quote_item_quantity_positive",
                    ),
                    models.CheckConstraint(
                        condition=models.Q(("unit_price__gte", 0)),
                        name="quote_item_price_non_negative",
                    ),
                    models.CheckConstraint(
                        condition=models.Q(("discount__gte", 0)),
                        name="quote_item_discount_non_negative",
                    ),
                ],
            },
        ),
        migrations.CreateModel(
            name="GeneratedDocument",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "document_type",
                    models.CharField(
                        choices=[
                            ("quote", "Orcamento"),
                            ("work_order", "Ordem de servico"),
                        ],
                        max_length=30,
                    ),
                ),
                ("version", models.PositiveIntegerField()),
                ("snapshot", models.JSONField(default=dict)),
                ("checksum", models.CharField(max_length=64)),
                ("generated_at", models.DateTimeField()),
                (
                    "generated_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="generated_documents",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "quote",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="documents",
                        to="quotes.quote",
                    ),
                ),
                (
                    "work_order",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="documents",
                        to="workorders.workorder",
                    ),
                ),
            ],
            options={
                "ordering": ["-generated_at", "-version"],
                "constraints": [
                    models.UniqueConstraint(
                        condition=models.Q(("quote__isnull", False)),
                        fields=("document_type", "quote", "version"),
                        name="unique_quote_document_version",
                    ),
                    models.UniqueConstraint(
                        condition=models.Q(("work_order__isnull", False)),
                        fields=("document_type", "work_order", "version"),
                        name="unique_work_order_document_version",
                    ),
                ],
            },
        ),
    ]
