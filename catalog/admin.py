from django.contrib import admin

from .models import Part, PartCategory, PaymentMethod, ServiceCategory, ServiceType


class ActiveCatalogAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "is_active", "created_at")
    search_fields = ("name", "slug", "description")
    list_filter = ("is_active",)
    readonly_fields = ("id", "created_at", "updated_at")

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(ServiceType)
class ServiceTypeAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "slug",
        "category",
        "is_recurring",
        "recommended_interval_value",
        "recommended_interval_unit",
        "is_active",
    )
    search_fields = ("name", "slug", "description")
    list_filter = ("category", "is_recurring", "is_active")
    list_select_related = ("category",)
    autocomplete_fields = ("category",)
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(Part)
class PartAdmin(admin.ModelAdmin):
    list_display = ("name", "brand", "model", "category", "default_cost", "default_price", "is_active")
    search_fields = ("name", "brand", "model")
    list_filter = ("category", "is_active")
    list_select_related = ("category",)
    autocomplete_fields = ("category",)
    readonly_fields = ("id", "created_at", "updated_at", "deleted_at")


admin.site.register(ServiceCategory, ActiveCatalogAdmin)
admin.site.register(PartCategory, ActiveCatalogAdmin)
admin.site.register(PaymentMethod, ActiveCatalogAdmin)
