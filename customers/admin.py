from django.contrib import admin

from .models import Customer


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ("name", "phone", "whatsapp", "email", "status", "customer_since", "created_at")
    search_fields = ("name", "phone", "whatsapp", "email")
    list_filter = ("status", "created_at")
    readonly_fields = ("id", "created_at", "updated_at", "deleted_at")
