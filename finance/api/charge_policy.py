from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from workorders.models import WorkOrder

from ..models import (
    ReceivableStatus,
    ServiceAgreement,
    WorkOrderChargeMode,
    WorkOrderChargePolicy,
)


class WorkOrderChargePolicyInputSerializer(serializers.Serializer):
    mode = serializers.ChoiceField(choices=WorkOrderChargeMode.choices)
    service_agreement_id = serializers.PrimaryKeyRelatedField(
        source="service_agreement",
        queryset=ServiceAgreement.objects.all(),
        required=False,
        allow_null=True,
    )
    notes = serializers.CharField(required=False, allow_blank=True)


def _agreement_data(agreement):
    return {
        "id": str(agreement.id),
        "name": agreement.name,
        "amount": str(agreement.amount),
        "billing_frequency": agreement.billing_frequency,
    }


def _policy_data(policy):
    if policy is None:
        return None
    return {
        "id": str(policy.id),
        "mode": policy.mode,
        "mode_label": policy.get_mode_display(),
        "service_agreement": str(policy.service_agreement_id),
        "agreement_name": policy.service_agreement.name,
        "notes": policy.notes,
    }


def _state(work_order):
    agreements = list(
        ServiceAgreement.objects.active()
        .filter(customer_id=work_order.customer_id)
        .order_by("starts_on", "name")
    )
    policy = (
        WorkOrderChargePolicy.objects.select_related("service_agreement")
        .filter(work_order=work_order)
        .first()
    )
    return {
        "has_active_agreement": bool(agreements),
        "active_agreements": [_agreement_data(agreement) for agreement in agreements],
        "policy": _policy_data(policy),
    }


class WorkOrderChargePolicyView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        work_order = get_object_or_404(WorkOrder.objects.select_related("customer"), pk=pk)
        return Response(_state(work_order))

    def put(self, request, pk):
        work_order = get_object_or_404(WorkOrder.objects.select_related("customer"), pk=pk)
        serializer = WorkOrderChargePolicyInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        active_agreements = list(
            ServiceAgreement.objects.active()
            .filter(customer_id=work_order.customer_id)
            .order_by("starts_on", "name")
        )
        if not active_agreements:
            raise serializers.ValidationError(
                {"service_agreement_id": "Este cliente nao possui contrato mensal ativo."}
            )

        agreement = data.get("service_agreement")
        if agreement is None:
            if len(active_agreements) != 1:
                raise serializers.ValidationError(
                    {"service_agreement_id": "Selecione o contrato que cobre esta OS."}
                )
            agreement = active_agreements[0]
        elif agreement not in active_agreements:
            raise serializers.ValidationError(
                {"service_agreement_id": "Selecione um contrato ativo deste cliente."}
            )

        mode = data["mode"]
        if mode == WorkOrderChargeMode.AGREEMENT_INCLUDED:
            has_charge = work_order.receivables.exclude(status=ReceivableStatus.CANCELLED).exists()
            if has_charge:
                raise serializers.ValidationError(
                    {"mode": "Esta OS ja possui cobranca ativa ou paga e nao pode ser marcada como inclusa no plano."}
                )

        policy, _ = WorkOrderChargePolicy.objects.update_or_create(
            work_order=work_order,
            defaults={
                "service_agreement": agreement,
                "mode": mode,
                "notes": data.get("notes", ""),
            },
        )
        try:
            policy.full_clean()
        except DjangoValidationError as exc:
            if hasattr(exc, "message_dict"):
                raise serializers.ValidationError(exc.message_dict) from exc
            raise serializers.ValidationError(exc.messages) from exc
        policy.save()
        return Response(_state(work_order))
