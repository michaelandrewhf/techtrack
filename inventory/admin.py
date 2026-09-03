from django.contrib import admin

from .models import ComponentType, Equipment, EquipmentComponent, EquipmentType


class ActiveCatalogAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "is_active", "created_at")
    search_fields = ("name", "slug", "description")
    list_filter = ("is_active",)
    readonly_fields = ("id", "created_at", "updated_at")

    def has_delete_permission(self, request, obj=None):
        return False


class EquipmentComponentInline(admin.TabularInline):
    model = EquipmentComponent
    extra = 0
    autocomplete_fields = ("source_work_order",)
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(Equipment)
class EquipmentAdmin(admin.ModelAdmin):
    list_display = ("customer", "equipment_type", "manufacturer", "model", "serial_number", "asset_tag", "status")
    search_fields = ("customer__name", "manufacturer", "model", "serial_number", "asset_tag")
    list_filter = ("equipment_type", "status", "created_at")
    autocomplete_fields = ("customer", "equipment_type")
    readonly_fields = ("id", "created_at", "updated_at", "deleted_at")
    inlines = (EquipmentComponentInline,)


@admin.register(EquipmentComponent)
class EquipmentComponentAdmin(admin.ModelAdmin):
    list_display = ("equipment", "component_type", "manufacturer", "model", "capacity", "installed_at", "removed_at")
    search_fields = (
        "equipment__customer__name",
        "equipment__serial_number",
        "manufacturer",
        "model",
        "serial_number",
        "capacity",
    )
    list_filter = ("component_type", "installed_at", "removed_at")
    autocomplete_fields = ("equipment", "component_type", "source_work_order")
    readonly_fields = ("id", "created_at", "updated_at")


admin.site.register(EquipmentType, ActiveCatalogAdmin)
admin.site.register(ComponentType, ActiveCatalogAdmin)
