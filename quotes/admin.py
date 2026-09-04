from django.contrib import admin

from .models import GeneratedDocument, Quote, QuoteItem, QuoteNumberSequence


class QuoteItemInline(admin.TabularInline):
    model = QuoteItem
    extra = 0
    readonly_fields = ("created_at", "updated_at")
    autocomplete_fields = ("service_type", "part")


@admin.register(Quote)
class QuoteAdmin(admin.ModelAdmin):
    list_display = ("number", "customer", "title", "status", "valid_until", "created_at")
    list_filter = ("status", "valid_until")
    search_fields = ("number", "title", "customer__name", "description")
    autocomplete_fields = ("customer", "equipment", "work_order")
    readonly_fields = ("number", "sent_at", "approved_at", "approved_by", "created_by", "created_at", "updated_at")
    list_select_related = ("customer", "equipment", "work_order")
    inlines = (QuoteItemInline,)


@admin.register(GeneratedDocument)
class GeneratedDocumentAdmin(admin.ModelAdmin):
    list_display = ("document_type", "quote", "work_order", "version", "generated_at", "generated_by")
    list_filter = ("document_type", "generated_at")
    readonly_fields = ("document_type", "quote", "work_order", "version", "snapshot", "checksum", "generated_at", "generated_by", "created_at", "updated_at")
    list_select_related = ("quote", "work_order", "generated_by")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(QuoteNumberSequence)
class QuoteNumberSequenceAdmin(admin.ModelAdmin):
    readonly_fields = ("current_number", "updated_at")
