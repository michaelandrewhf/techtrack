from django.contrib import admin

from .models import BusinessProfile, Payment, Receivable, ServiceAgreement


@admin.register(ServiceAgreement)
class ServiceAgreementAdmin(admin.ModelAdmin):
    list_display = ("name", "customer", "status", "billing_frequency", "amount", "billing_day", "starts_on", "ends_on")
    list_filter = ("status", "billing_frequency")
    search_fields = ("name", "customer__name")
    autocomplete_fields = ("customer",)
    list_select_related = ("customer",)


@admin.register(Receivable)
class ReceivableAdmin(admin.ModelAdmin):
    list_display = ("description", "customer", "origin", "amount", "status", "due_date", "competence")
    list_filter = ("origin", "status", "due_date")
    search_fields = ("description", "reference", "customer__name")
    autocomplete_fields = ("customer", "work_order", "service_agreement")
    readonly_fields = ("created_by", "created_at", "updated_at")
    list_select_related = ("customer", "work_order", "service_agreement")


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("receivable", "amount", "payment_method", "paid_at", "voided_at")
    list_filter = ("payment_method", "paid_at", "voided_at")
    search_fields = ("reference", "receivable__description", "receivable__customer__name")
    autocomplete_fields = ("receivable", "payment_method")
    readonly_fields = ("created_by", "voided_at", "voided_by", "void_reason", "created_at", "updated_at")
    list_select_related = ("receivable", "payment_method")

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(BusinessProfile)
class BusinessProfileAdmin(admin.ModelAdmin):
    fieldsets = (("Prestador", {"fields": ("name", "document", "phone", "whatsapp", "email", "address")}),)

    def has_add_permission(self, request):
        return not BusinessProfile.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False
