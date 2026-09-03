import uuid

import django.db.models.deletion
from django.db import migrations, models

SERVICE_CATEGORIES = {
    "preventive": "Preventiva",
    "corrective": "Corretiva",
    "software": "Software",
    "hardware": "Hardware",
    "backup": "Backup",
}

PART_CATEGORIES = {
    "storage": "Armazenamento",
    "memory": "Memoria",
    "battery": "Bateria",
    "power_supply": "Fonte",
    "peripheral": "Periferico",
    "board": "Placa",
}

PAYMENT_METHODS = {
    "cash": "Dinheiro",
    "pix": "PIX",
    "credit_card": "Cartao de credito",
    "debit_card": "Cartao de debito",
    "bank_transfer": "Transferencia bancaria",
}


def _display_name(slug):
    return slug.replace("_", " ").replace("-", " ").title()


def create_and_assign_catalogs(apps, schema_editor):
    ServiceType = apps.get_model("catalog", "ServiceType")
    ServiceCategory = apps.get_model("catalog", "ServiceCategory")
    Part = apps.get_model("catalog", "Part")
    PartCategory = apps.get_model("catalog", "PartCategory")
    PaymentMethod = apps.get_model("catalog", "PaymentMethod")

    for slug, name in SERVICE_CATEGORIES.items():
        ServiceCategory.objects.update_or_create(slug=slug, defaults={"name": name, "is_active": True})

    for slug, name in PART_CATEGORIES.items():
        PartCategory.objects.update_or_create(slug=slug, defaults={"name": name, "is_active": True})

    for slug, name in PAYMENT_METHODS.items():
        PaymentMethod.objects.update_or_create(slug=slug, defaults={"name": name, "is_active": True})

    for service_type in ServiceType.objects.all():
        if not service_type.legacy_category:
            continue
        catalog = ServiceCategory.objects.filter(slug=service_type.legacy_category).first()
        if catalog is None:
            catalog = ServiceCategory.objects.create(
                slug=service_type.legacy_category,
                name=_display_name(service_type.legacy_category),
                is_active=True,
            )
        service_type.category = catalog
        service_type.save(update_fields=["category"])

    for part in Part.objects.all():
        if not part.legacy_category:
            continue
        catalog = PartCategory.objects.filter(slug=part.legacy_category).first()
        if catalog is None:
            catalog = PartCategory.objects.create(
                slug=part.legacy_category,
                name=_display_name(part.legacy_category),
                is_active=True,
            )
        part.category = catalog
        part.save(update_fields=["category"])


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="PartCategory",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=120)),
                ("slug", models.SlugField(max_length=120, unique=True)),
                ("description", models.TextField(blank=True)),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={
                "verbose_name_plural": "Part categories",
                "ordering": ["name"],
                "indexes": [
                    models.Index(fields=["slug"], name="part_category_slug_idx"),
                    models.Index(fields=["is_active"], name="part_category_active_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="PaymentMethod",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=120)),
                ("slug", models.SlugField(max_length=120, unique=True)),
                ("description", models.TextField(blank=True)),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={
                "ordering": ["name"],
                "indexes": [
                    models.Index(fields=["slug"], name="payment_method_slug_idx"),
                    models.Index(fields=["is_active"], name="payment_method_active_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="ServiceCategory",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=120)),
                ("slug", models.SlugField(max_length=120, unique=True)),
                ("description", models.TextField(blank=True)),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={
                "verbose_name_plural": "Service categories",
                "ordering": ["name"],
                "indexes": [
                    models.Index(fields=["slug"], name="service_category_slug_idx"),
                    models.Index(fields=["is_active"], name="service_category_active_idx"),
                ],
            },
        ),
        migrations.RenameField(model_name="part", old_name="category", new_name="legacy_category"),
        migrations.RenameField(model_name="servicetype", old_name="category", new_name="legacy_category"),
        migrations.AddField(
            model_name="part",
            name="category",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="parts",
                to="catalog.partcategory",
            ),
        ),
        migrations.AddField(
            model_name="servicetype",
            name="category",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="service_types",
                to="catalog.servicecategory",
            ),
        ),
        migrations.RunPython(create_and_assign_catalogs, migrations.RunPython.noop),
        migrations.RemoveIndex(model_name="part", name="part_category_idx"),
        migrations.RemoveField(model_name="part", name="legacy_category"),
        migrations.RemoveField(model_name="servicetype", name="legacy_category"),
        migrations.AddIndex(model_name="part", index=models.Index(fields=["category"], name="part_category_idx")),
    ]
