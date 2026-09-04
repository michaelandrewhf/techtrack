from calendar import monthrange
from datetime import date
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from .models import (
    AgreementStatus,
    BillingFrequency,
    Payment,
    Receivable,
    ReceivableOrigin,
    ReceivableStatus,
    ServiceAgreement,
)


def _frequency_months(frequency):
    return {
        BillingFrequency.MONTHLY: 1,
        BillingFrequency.QUARTERLY: 3,
        BillingFrequency.SEMIANNUAL: 6,
        BillingFrequency.ANNUAL: 12,
    }[frequency]


def _normalize_competence(value):
    if isinstance(value, date):
        return value.replace(day=1)
    raise ValidationError("Competencia invalida.")


def _due_date_for_competence(competence, billing_day):
    last_day = monthrange(competence.year, competence.month)[1]
    return date(competence.year, competence.month, min(billing_day, last_day))


def _next_month_competence(value):
    if value.month == 12:
        return date(value.year + 1, 1, 1)
    return date(value.year, value.month + 1, 1)


def _valid_paid_amount(receivable):
    return Payment.objects.valid().filter(receivable=receivable).aggregate(total=Sum("amount"))["total"] or Decimal(
        "0.00"
    )


def refresh_receivable_status(receivable):
    receivable = Receivable.objects.select_for_update().get(pk=receivable.pk)
    if receivable.status == ReceivableStatus.CANCELLED:
        return receivable
    paid = _valid_paid_amount(receivable)
    if paid <= 0:
        new_status = ReceivableStatus.PENDING
    elif paid < receivable.amount:
        new_status = ReceivableStatus.PARTIAL
    else:
        new_status = ReceivableStatus.PAID
    if receivable.status != new_status:
        receivable.status = new_status
        receivable.save(update_fields=["status", "updated_at"])
    return receivable


@transaction.atomic
def create_service_agreement(
    *,
    attrs,
    first_billing_mode=None,
    first_payment_method=None,
    created_by=None,
):
    starts_on = attrs["starts_on"]
    start_competence = starts_on.replace(day=1)
    if first_billing_mode == "receive_now":
        first_billing_competence = start_competence
    elif first_billing_mode == "next_month":
        first_billing_competence = _next_month_competence(start_competence)
    elif first_billing_mode is None:
        # Backward-compatible API behavior for callers that do not opt into the new flow.
        first_billing_competence = start_competence
    else:
        raise ValidationError("Opcao de primeira mensalidade invalida.")

    if first_billing_mode == "receive_now" and first_payment_method is None:
        raise ValidationError("Informe o metodo de pagamento da primeira mensalidade.")

    agreement = ServiceAgreement(
        **attrs,
        first_billing_competence=first_billing_competence,
    )
    agreement.full_clean()
    agreement.save()

    if first_billing_mode == "receive_now":
        today = timezone.localdate()
        receivable = Receivable(
            customer=agreement.customer,
            service_agreement=agreement,
            origin=ReceivableOrigin.AGREEMENT,
            description=f"{agreement.name} - primeira mensalidade",
            reference=f"AGR-{str(agreement.pk)[:8]}-{start_competence:%Y%m}",
            competence=start_competence,
            issued_at=today,
            due_date=today,
            amount=agreement.amount,
            created_by=created_by,
        )
        receivable.full_clean()
        receivable.save()
        register_payment(
            receivable=receivable,
            amount=agreement.amount,
            payment_method=first_payment_method,
            paid_at=timezone.now(),
            reference="Primeira mensalidade recebida no cadastro",
            created_by=created_by,
        )

    return agreement


@transaction.atomic
def generate_service_agreement_receivable(*, agreement, competence, created_by=None):
    agreement = agreement.__class__.objects.select_for_update().get(pk=agreement.pk)
    competence = _normalize_competence(competence)
    if agreement.status != AgreementStatus.ACTIVE:
        raise ValidationError("Somente acordos ativos podem gerar cobrancas.")
    billing_start = agreement.first_billing_competence or agreement.starts_on.replace(day=1)
    if competence < billing_start:
        raise ValidationError("A competencia e anterior ao primeiro ciclo de cobranca do acordo.")
    if agreement.ends_on and competence > agreement.ends_on.replace(day=1):
        raise ValidationError("A competencia e posterior ao encerramento do acordo.")

    months_from_start = (competence.year - billing_start.year) * 12 + competence.month - billing_start.month
    if months_from_start % _frequency_months(agreement.billing_frequency) != 0:
        raise ValidationError("A competencia nao corresponde a frequencia de cobranca do acordo.")

    receivable, created = Receivable.objects.get_or_create(
        service_agreement=agreement,
        competence=competence,
        defaults={
            "customer": agreement.customer,
            "origin": ReceivableOrigin.AGREEMENT,
            "description": f"{agreement.name} - {competence:%m/%Y}",
            "reference": f"AGR-{str(agreement.pk)[:8]}-{competence:%Y%m}",
            "issued_at": competence,
            "due_date": _due_date_for_competence(competence, agreement.billing_day),
            "amount": agreement.amount,
            "created_by": created_by,
        },
    )
    if created:
        receivable.full_clean()
        receivable.save()
    return receivable, created


@transaction.atomic
def create_work_order_receivable(*, work_order, amount, due_date, description="", created_by=None, notes=""):
    amount = Decimal(str(amount))
    if amount < 0:
        raise ValidationError("Valor da cobranca nao pode ser negativo.")
    work_order = work_order.__class__.objects.select_related("customer").select_for_update().get(pk=work_order.pk)
    receivable = Receivable(
        customer=work_order.customer,
        work_order=work_order,
        origin=ReceivableOrigin.WORK_ORDER,
        description=description or f"Cobranca {work_order.display_number}",
        reference=work_order.display_number,
        issued_at=timezone.localdate(),
        due_date=due_date,
        amount=amount,
        notes=notes,
        created_by=created_by,
    )
    receivable.full_clean()
    receivable.save()
    return receivable


@transaction.atomic
def register_payment(*, receivable, amount, payment_method, paid_at=None, reference="", notes="", created_by=None):
    receivable = Receivable.objects.select_for_update().get(pk=receivable.pk)
    if receivable.status == ReceivableStatus.CANCELLED:
        raise ValidationError("Nao e possivel registrar pagamento em cobranca cancelada.")
    if not payment_method.is_active:
        raise ValidationError("Metodo de pagamento inativo nao pode ser utilizado.")

    amount = Decimal(str(amount))
    if amount <= 0:
        raise ValidationError("O valor do pagamento deve ser maior que zero.")
    paid = _valid_paid_amount(receivable)
    balance = receivable.amount - paid
    if amount > balance:
        raise ValidationError("Pagamento maior que o saldo pendente nao e permitido.")

    payment = Payment(
        receivable=receivable,
        amount=amount,
        payment_method=payment_method,
        paid_at=paid_at or timezone.now(),
        reference=reference,
        notes=notes,
        created_by=created_by,
    )
    payment.full_clean()
    payment.save()
    refresh_receivable_status(receivable)
    return payment


@transaction.atomic
def void_payment(*, payment, voided_by=None, reason=""):
    payment = Payment.objects.select_for_update().get(pk=payment.pk)
    if payment.voided_at:
        raise ValidationError("Pagamento ja esta invalidado.")
    if not reason.strip():
        raise ValidationError("Informe o motivo da invalidacao.")
    payment.voided_at = timezone.now()
    payment.voided_by = voided_by
    payment.void_reason = reason.strip()
    payment.full_clean()
    payment.save(update_fields=["voided_at", "voided_by", "void_reason", "updated_at"])
    refresh_receivable_status(payment.receivable)
    return payment
