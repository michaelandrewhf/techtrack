from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import HttpResponse
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from workorders.models import WorkOrder

from ..models import DocumentType, GeneratedDocument
from ..services import issue_document, work_order_pdf_from_snapshot, work_order_snapshot


class WorkOrderPdfView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            work_order = WorkOrder.objects.get(pk=pk)
        except WorkOrder.DoesNotExist as exc:
            raise serializers.ValidationError("Ordem de servico inexistente.") from exc

        version = request.query_params.get("version")
        if version:
            try:
                document = GeneratedDocument.objects.get(
                    work_order=work_order,
                    document_type=DocumentType.WORK_ORDER,
                    version=int(version),
                )
            except (GeneratedDocument.DoesNotExist, ValueError) as exc:
                raise serializers.ValidationError("Revisao de documento inexistente.") from exc
            snapshot = document.snapshot
            suffix = f"-v{document.version}"
        else:
            snapshot = work_order_snapshot(work_order)
            suffix = "-preview"

        response = HttpResponse(work_order_pdf_from_snapshot(snapshot), content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="os-{work_order.number:06d}{suffix}.pdf"'
        return response


class WorkOrderIssuePdfView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            work_order = WorkOrder.objects.get(pk=pk)
        except WorkOrder.DoesNotExist as exc:
            raise serializers.ValidationError("Ordem de servico inexistente.") from exc
        try:
            document = issue_document(
                document_type=DocumentType.WORK_ORDER,
                work_order=work_order,
                generated_by=request.user,
            )
        except DjangoValidationError as exc:
            if hasattr(exc, "message_dict"):
                raise serializers.ValidationError(exc.message_dict) from exc
            raise serializers.ValidationError(exc.messages if hasattr(exc, "messages") else str(exc)) from exc

        response = HttpResponse(work_order_pdf_from_snapshot(document.snapshot), content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="os-{work_order.number:06d}-v{document.version}.pdf"'
        response["X-Document-Id"] = str(document.id)
        response["X-Document-Version"] = str(document.version)
        return response
