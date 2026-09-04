from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.permissions import AllowAny
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView, TokenVerifyView

from accounts.api.views import MeView
from catalog.api.views import (
    PartCategoryViewSet,
    PartViewSet,
    PaymentMethodViewSet,
    ServiceCategoryViewSet,
    ServiceTypeViewSet,
)
from customers.api.views import CustomerViewSet
from finance.api.views import (
    BusinessProfileView,
    FinanceDashboardView,
    PaymentViewSet,
    ReceivableViewSet,
    ServiceAgreementViewSet,
)
from inventory.api.views import ComponentTypeViewSet, EquipmentTypeViewSet, EquipmentViewSet
from quotes.api.documents import WorkOrderIssuePdfView, WorkOrderPdfView
from quotes.api.views import QuoteViewSet
from workorders.api.dashboard import DashboardView
from workorders.api.views import WorkOrderStatusViewSet, WorkOrderViewSet


def health_check(request):
    return JsonResponse({"status": "ok"})


class PublicSpectacularAPIView(SpectacularAPIView):
    permission_classes = [AllowAny]


class PublicSpectacularSwaggerView(SpectacularSwaggerView):
    permission_classes = [AllowAny]


router = DefaultRouter()
router.register("customers", CustomerViewSet, basename="customer")
router.register("equipment-types", EquipmentTypeViewSet, basename="equipment-type")
router.register("component-types", ComponentTypeViewSet, basename="component-type")
router.register("equipment", EquipmentViewSet, basename="equipment")
router.register("service-categories", ServiceCategoryViewSet, basename="service-category")
router.register("service-types", ServiceTypeViewSet, basename="service-type")
router.register("part-categories", PartCategoryViewSet, basename="part-category")
router.register("parts", PartViewSet, basename="part")
router.register("payment-methods", PaymentMethodViewSet, basename="payment-method")
router.register("work-order-statuses", WorkOrderStatusViewSet, basename="work-order-status")
router.register("work-orders", WorkOrderViewSet, basename="work-order")
router.register("quotes", QuoteViewSet, basename="quote")
router.register("service-agreements", ServiceAgreementViewSet, basename="service-agreement")
router.register("receivables", ReceivableViewSet, basename="receivable")
router.register("payments", PaymentViewSet, basename="payment")

urlpatterns = [
    path("health/", health_check, name="api-health"),
    path("token/", TokenObtainPairView.as_view(), name="token-obtain-pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("token/verify/", TokenVerifyView.as_view(), name="token-verify"),
    path("schema/", PublicSpectacularAPIView.as_view(), name="api-schema"),
    path("docs/", PublicSpectacularSwaggerView.as_view(url_name="api-schema"), name="api-docs"),
    path("v1/me/", MeView.as_view(), name="api-me"),
    path("v1/dashboard/", DashboardView.as_view(), name="api-dashboard"),
    path("v1/finance/dashboard/", FinanceDashboardView.as_view(), name="api-finance-dashboard"),
    path("v1/business-profile/", BusinessProfileView.as_view(), name="api-business-profile"),
    path("v1/work-orders/<uuid:pk>/pdf/", WorkOrderPdfView.as_view(), name="api-work-order-pdf"),
    path("v1/work-orders/<uuid:pk>/issue-pdf/", WorkOrderIssuePdfView.as_view(), name="api-work-order-issue-pdf"),
    path("v1/", include(router.urls)),
]
