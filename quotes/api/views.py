from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import HttpResponse
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from documents.renderers.quote import render_quote_pdf
from workorders.api.serializers import WorkOrderDetailSerializer

from ..models import DocumentType, GeneratedDocument, Quote, QuoteStatus
from ..services import (
    add_quote_item,
    approve_quote,
    create_quote,
    create_work_order_from_quote,
    issue_document,
    mark_quote_sent,
    quote_snapshot,
    set_quote_terminal_status,
)
from .serializers import QuoteCreateSerializer, QuoteItemCreateSerializer, QuoteItemSerializer, QuoteSerializer


def _raise_validation(exc):
    if hasattr(exc, "message_dict"):
        raise serializers.ValidationError(exc.message_dict) from exc
    raise serializers.ValidationError(exc.messages if hasattr(exc, "messages") else str(exc)) from exc


class QuoteViewSet(viewsets.ModelViewSet):
    filterset_fields = ["customer", "equipment", "work_order", "status", "valid_until"]
    search_fields = ["title", "description", "customer__name", "number"]
    ordering_fields = ["number", "created_at", "valid_until", "status"]
    ordering = ["-created_at", "-number"]

    def get_queryset(self):
        if self.action == "list":
            return Quote.objects.with_list_data()
        return Quote.objects.with_detail_data()

    def get_serializer_class(self):
        if self.action == "create":
            return QuoteCreateSerializer
        return QuoteSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            quote = create_quote(created_by=request.user, **serializer.validated_data)
        except DjangoValidationError as exc:
            _raise_validation(exc)
        quote = Quote.objects.with_detail_data().get(pk=quote.pk)
        return Response(QuoteSerializer(quote).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        quote = self.get_object()
        if not quote.is_editable:
            raise serializers.ValidationError("Orcamento fechado nao pode ser alterado.")
        protected = {"status", "number", "sent_at", "approved_at", "approved_by", "created_by"}
        if protected.intersection(request.data.keys()):
            raise serializers.ValidationError("Campos de workflow/auditoria nao podem ser alterados diretamente.")
        response = super().update(request, *args, **kwargs)
        updated = Quote.objects.with_detail_data().get(pk=quote.pk)
        updated.full_clean()
        return Response(QuoteSerializer(updated).data, status=response.status_code)

    def destroy(self, request, *args, **kwargs):
        quote = self.get_object()
        try:
            set_quote_terminal_status(quote=quote, status=QuoteStatus.CANCELLED)
        except DjangoValidationError as exc:
            _raise_validation(exc)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="items")
    def add_item(self, request, pk=None):
        serializer = QuoteItemCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            item = add_quote_item(quote=self.get_object(), **serializer.validated_data)
        except DjangoValidationError as exc:
            _raise_validation(exc)
        return Response(QuoteItemSerializer(item).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="mark-sent")
    def mark_sent(self, request, pk=None):
        try:
            quote = mark_quote_sent(quote=self.get_object())
        except DjangoValidationError as exc:
            _raise_validation(exc)
        return Response(QuoteSerializer(Quote.objects.with_detail_data().get(pk=quote.pk)).data)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        try:
            quote = approve_quote(quote=self.get_object(), approved_by=request.user)
        except DjangoValidationError as exc:
            _raise_validation(exc)
        return Response(QuoteSerializer(Quote.objects.with_detail_data().get(pk=quote.pk)).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        try:
            quote = set_quote_terminal_status(quote=self.get_object(), status=QuoteStatus.REJECTED)
        except DjangoValidationError as exc:
            _raise_validation(exc)
        return Response(QuoteSerializer(Quote.objects.with_detail_data().get(pk=quote.pk)).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        try:
            quote = set_quote_terminal_status(quote=self.get_object(), status=QuoteStatus.CANCELLED)
        except DjangoValidationError as exc:
            _raise_validation(exc)
        return Response(QuoteSerializer(Quote.objects.with_detail_data().get(pk=quote.pk)).data)

    @action(detail=True, methods=["post"], url_path="create-work-order")
    def create_work_order(self, request, pk=None):
        try:
            work_order = create_work_order_from_quote(quote=self.get_object(), responsible_user=request.user)
        except DjangoValidationError as exc:
            _raise_validation(exc)
        return Response(WorkOrderDetailSerializer(work_order).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="pdf")
    def preview_pdf(self, request, pk=None):
        quote = self.get_object()
        version = request.query_params.get("version")
        if version:
            try:
                document = GeneratedDocument.objects.get(
                    quote=quote,
                    document_type=DocumentType.QUOTE,
                    version=int(version),
                )
            except (GeneratedDocument.DoesNotExist, ValueError) as exc:
                raise serializers.ValidationError("Revisao de documento inexistente.") from exc
            snapshot = document.snapshot
            suffix = f"-v{document.version}"
            revision = f"v{document.version}"
        else:
            snapshot = quote_snapshot(quote)
            suffix = "-preview"
            revision = "PREVIA"
        response = HttpResponse(
            render_quote_pdf(snapshot, revision=revision),
            content_type="application/pdf",
        )
        response["Content-Disposition"] = f'attachment; filename="orcamento-{quote.number:06d}{suffix}.pdf"'
        return response

    @action(detail=True, methods=["post"], url_path="issue-pdf")
    def issue_pdf(self, request, pk=None):
        try:
            document = issue_document(
                document_type=DocumentType.QUOTE,
                quote=self.get_object(),
                generated_by=request.user,
            )
        except DjangoValidationError as exc:
            _raise_validation(exc)
        response = HttpResponse(
            render_quote_pdf(document.snapshot, revision=f"v{document.version}"),
            content_type="application/pdf",
        )
        response["Content-Disposition"] = (
            f'attachment; filename="orcamento-{document.quote.number:06d}-v{document.version}.pdf"'
        )
        response["X-Document-Id"] = str(document.id)
        response["X-Document-Version"] = str(document.version)
        return response
