import uuid

import django.db.models.deletion
from django.db import migrations, models

EQUIPMENT_TYPES = {
    "desktop": "Desktop",
    "notebook": "Notebook",
    "printer": "Impressora",
    "server": "Servidor",
    "router": "Roteador",
}

COMPONENT_TYPES = {
    "cpu": "Processador",
    "ram": "Memoria RAM",
    "storage": "SSD",
    "motherboard": "Placa-mae",
    "gpu": "Placa de video",
    "power_supply": "Fonte",
    "battery": "Bateria",
}

EXTRA_COMPONENT_TYPES = {
    "hd": "HD",
}


def _display_name(slug):
    return slug.replace("_", " ").replace("-", " ").title()


def create_and_assign_catalogs(apps, schema_editor):
    Equipment = apps.get_model("inventory", "Equipment")
    EquipmentType = apps.get_model("inventory", "EquipmentType")
    EquipmentComponent = apps.get_model("inventory", "EquipmentComponent")
    ComponentType = apps.get_model("inventory", "ComponentType")

    for slug, name in EQUIPMENT_TYPES.items():
        EquipmentType.objects.update_or_create(slug=slug, defaults={"name": name, "is_active": True})

    for slug, name in {**COMPONENT_TYPES, **EXTRA_COMPONENT_TYPES}.items():
        ComponentType.objects.update_or_create(slug=slug, defaults={"name": name, "is_active": True})

    for equipment in Equipment.objects.order_by():
        slug = equipment.legacy_type or "desktop"
        catalog = EquipmentType.objects.filter(slug=slug).first()
        if catalog is None:
            catalog = EquipmentType.objects.create(slug=slug, name=_display_name(slug), is_active=True)
        equipment.equipment_type = catalog
        equipment.save(update_fields=["equipment_type"])

    for component in EquipmentComponent.objects.order_by():
        slug = component.legacy_component_type or "storage"
        catalog = ComponentType.objects.filter(slug=slug).first()
        if catalog is None:
            catalog = ComponentType.objects.create(slug=slug, name=_display_name(slug), is_active=True)
        component.component_type = catalog
        component.save(update_fields=["component_type"])


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0002_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="ComponentType",
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
                    models.Index(fields=["slug"], name="component_type_slug_idx"),
                    models.Index(fields=["is_active"], name="component_type_active_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="EquipmentType",
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
                    models.Index(fields=["slug"], name="equipment_type_slug_idx"),
                    models.Index(fields=["is_active"], name="equipment_type_active_idx"),
                ],
            },
        ),
        migrations.RenameField(model_name="equipment", old_name="type", new_name="legacy_type"),
        migrations.RenameField(
            model_name="equipmentcomponent", old_name="component_type", new_name="legacy_component_type"
        ),
        migrations.AddField(
            model_name="equipment",
            name="equipment_type",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="equipment",
                to="inventory.equipmenttype",
            ),
        ),
        migrations.AddField(
            model_name="equipmentcomponent",
            name="component_type",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="components",
                to="inventory.componenttype",
            ),
        ),
        migrations.RunPython(create_and_assign_catalogs, migrations.RunPython.noop),
        migrations.RemoveIndex(model_name="equipment", name="equipment_type_idx"),
        migrations.RemoveIndex(model_name="equipmentcomponent", name="component_type_idx"),
        migrations.RemoveIndex(model_name="equipmentcomponent", name="component_current_idx"),
        migrations.RemoveField(model_name="equipment", name="legacy_type"),
        migrations.RemoveField(model_name="equipmentcomponent", name="legacy_component_type"),
        migrations.AlterField(
            model_name="equipment",
            name="equipment_type",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="equipment",
                to="inventory.equipmenttype",
            ),
        ),
        migrations.AlterField(
            model_name="equipmentcomponent",
            name="component_type",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="components",
                to="inventory.componenttype",
            ),
        ),
        migrations.AddIndex(
            model_name="equipment",
            index=models.Index(fields=["equipment_type"], name="equipment_type_idx"),
        ),
        migrations.AddIndex(
            model_name="equipmentcomponent",
            index=models.Index(fields=["component_type"], name="component_type_idx"),
        ),
        migrations.AddIndex(
            model_name="equipmentcomponent",
            index=models.Index(fields=["equipment", "component_type", "removed_at"], name="component_current_idx"),
        ),
        migrations.AlterModelOptions(
            name="equipment",
            options={"ordering": ["customer__name", "equipment_type__name", "manufacturer", "model"]},
        ),
    ]
