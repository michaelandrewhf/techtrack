from django.contrib import admin
from django.core.exceptions import ValidationError

from .models import (
    WorkOrder,
    WorkOrderBilling,
    WorkOrderNumberSequence,
    WorkOrderPart,
    WorkOrderService,
    WorkOrderStatus,
    WorkOrderStatusHistory,
)


class WorkOrderStatusHistoryInline(admin.TabularInline):
    model = WorkOrderStatusHistory
    extra = 0
    can_delete = False
    readonly_fields = ("id", "status", "changed_at", "changed_by", "comment", "description", "created_at")

    def has_add_permission(self, request, obj=None):
        return False


class WorkOrderServiceInline(admin.TabularInline):
    model = WorkOrderService
    extra = 0
    autocomplete_fields = ("service_type", "performed_by", "voided_by")
    readonly_fields = ("id", "created_at", "updated_at")

    def has_add_permission(self, request, obj=None):
        if obj and obj.is_closed:
            return False
        return super().has_add_permission(request, obj)

    def has_change_permission(self, request, obj=None):
        if obj and obj.is_closed:
            return False
        return super().has_change_permission(request, obj)


class WorkOrderPartInline(admin.TabularInline):
    model = WorkOrderPart
    extra = 0
    autocomplete_fields = ("work_order_service", "part", "installed_component", "voided_by")
    readonly_fields = ("id", "created_at", "updated_at")

    def has_add_permission(self, request, obj=None):
        if obj and obj.is_closed:
            return False
        return super().has_add_permission(request, obj)

    def has_change_permission(self, request, obj=None):
        if obj and obj.is_closed:
            return False
        return super().has_change_permission(request, obj)


@admin.register(WorkOrder)
class WorkOrderAdmin(admin.ModelAdmin):
    list_display = (
        "display_number",
        "customer",
        "equipment",
        "title",
        "status",
        "priority",
        "opened_at",
        "completed_at",
    )
    search_fields = ("number", "title", "customer__name", "equipment__serial_number", "equipment__asset_tag")
    list_filter = ("status", "priority", "opened_at", "completed_at")
    autocomplete_fields = ("customer", "equipment", "status", "responsible_user")
    readonly_fields = ("id", "number", "created_at", "updated_at")
    inlines = (WorkOrderStatusHistoryInline, WorkOrderServiceInline, WorkOrderPartInline)

    def get_readonly_fields(self, request, obj=None):
        readonly_fields = list(super().get_readonly_fields(request, obj))
        if obj and obj.is_closed:
            readonly_fields.extend(
                [
                    "customer",
                    "equipment",
                    "title",
                    "problem_description",
                    "status",
                    "priority",
                    "opened_at",
                    "started_at",
                    "completed_at",
                    "cancelled_at",
                    "diagnosis",
                    "service_description",
                    "solution",
                    "internal_notes",
                    "responsible_user",
                ]
            )
        return readonly_fields


@admin.register(WorkOrderStatusHistory)
class WorkOrderStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ("work_order", "status", "changed_at", "changed_by", "created_at")
    search_fields = ("work_order__number", "work_order__title", "comment", "description")
    list_filter = ("status", "changed_at")
    autocomplete_fields = ("work_order", "changed_by")
    readonly_fields = ("id", "work_order", "status", "changed_at", "changed_by", "comment", "description", "created_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False if obj else super().has_change_permission(request, obj)

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(WorkOrderService)
class WorkOrderServiceAdmin(admin.ModelAdmin):
    list_display = ("work_order", "service_type", "performed_at", "performed_by", "labor_price", "voided_at")
    search_fields = ("work_order__number", "work_order__title", "service_type__name", "description", "notes")
    list_filter = ("service_type", "performed_at", "voided_at")
    autocomplete_fields = ("work_order", "service_type", "performed_by", "voided_by")
    readonly_fields = ("id", "created_at", "updated_at")

    def save_model(self, request, obj, form, change):
        if obj.work_order.is_closed:
            raise ValidationError("Closed work orders cannot be changed from the admin.")
        super().save_model(request, obj, form, change)


@admin.register(WorkOrderPart)
class WorkOrderPartAdmin(admin.ModelAdmin):
    list_display = (
        "work_order",
        "description",
        "quantity",
        "unit_cost",
        "unit_price",
        "serial_number",
        "warranty_until",
        "voided_at",
    )
    search_fields = ("work_order__number", "description", "serial_number", "part__name")
    list_filter = ("warranty_until", "voided_at")
    autocomplete_fields = ("work_order", "work_order_service", "part", "installed_component", "voided_by")
    readonly_fields = ("id", "created_at", "updated_at")

    def save_model(self, request, obj, form, change):
        if obj.work_order.is_closed:
            raise ValidationError("Closed work orders cannot be changed from the admin.")
        super().save_model(request, obj, form, change)


@admin.register(WorkOrderBilling)
class WorkOrderBillingAdmin(admin.ModelAdmin):
    list_display = (
        "work_order",
        "labor_total",
        "parts_total",
        "discount",
        "total_amount",
        "payment_status",
        "payment_method",
        "paid_at",
    )
    search_fields = ("work_order__number", "work_order__title", "notes")
    list_filter = ("payment_status", "payment_method", "paid_at")
    autocomplete_fields = ("work_order",)
    readonly_fields = ("id", "created_at", "updated_at")

    def save_model(self, request, obj, form, change):
        if obj.work_order.is_closed:
            raise ValidationError("Closed work orders cannot be changed from the admin.")
        super().save_model(request, obj, form, change)


@admin.register(WorkOrderNumberSequence)
class WorkOrderNumberSequenceAdmin(admin.ModelAdmin):
    list_display = ("id", "current_number", "updated_at")
    readonly_fields = ("id", "current_number", "updated_at")


@admin.register(WorkOrderStatus)
class WorkOrderStatusAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "kind", "is_initial", "is_active", "sort_order")
    search_fields = ("name", "code", "description")
    list_filter = ("kind", "is_initial", "is_active")
    readonly_fields = ("id", "created_at", "updated_at")

    def has_delete_permission(self, request, obj=None):
        return False
