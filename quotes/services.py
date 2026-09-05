import hashlib
import json
from decimal import Decimal

from django.core.exceptions import ObjectDoesNotExist, ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Max
from django.utils import timezone

from finance.models import BusinessProfile
from workorders.services import create_work_order

from .models import (
    DocumentType,
    GeneratedDocument,
    Quote,
    QuoteItem,
    QuoteNumberSequence,
    QuoteStatus,
)


def _next_quote_number():
    with transaction.atomic():
        try:
            sequence = QuoteNumberSequence.objects.select_for_update().get(pk=1)
        except QuoteNumberSequence.DoesNotExist:
            try:
                sequence = QuoteNumberSequence.objects.create(pk=1, current_number=0)
            except IntegrityError:
                sequence = QuoteNumberSequence.objects.select_for_update().get(pk=1)
        sequence.current_number += 1
        sequence.save(update_fields=["current_number", "updated_at"])
        return sequence.current_number


def _profile_snapshot():
    profile, _ = BusinessProfile.objects.get_or_create(pk=1)
    return {
        "name": profile.name,
        "document": profile.document,
        "phone": profile.phone,
        "whatsapp": profile.whatsapp,
        "email": profile.email,
        "address": profile.address,
    }


def _quote_amounts(quote):
    items = list(quote.items.all())
    items_total = sum((item.total for item in items), Decimal("0.00"))
    total_amount = items_total - quote.discount
    if total_amount < 0:
        raise ValidationError({"discount": "O desconto do orcamento nao pode superar o total dos itens."})
    return items, items_total, total_amount


def quote_snapshot(quote):
    quote = Quote.objects.with_detail_data().get(pk=quote.pk)
    quote_items, items_total, total_amount = _quote_amounts(quote)
    items = [
        {
            "type": item.item_type,
            "description": item.description,
            "quantity": str(item.quantity),
            "unit_price": str(item.unit_price),
            "discount": str(item.discount),
            "total": str(item.total),
        }
        for item in quote_items
    ]
    equipment = None
    if quote.equipment_id:
        equipment = {
            "id": str(quote.equipment_id),
            "type": (quote.equipment.equipment_type.name if quote.equipment.equipment_type_id else ""),
            "manufacturer": quote.equipment.manufacturer,
            "model": quote.equipment.model,
            "serial_number": quote.equipment.serial_number,
            "asset_tag": quote.equipment.asset_tag,
        }
    return {
        "business": _profile_snapshot(),
        "quote": {
            "id": str(quote.id),
            "number": quote.number,
            "display_number": quote.display_number,
            "title": quote.title,
            "description": quote.description,
            "status": quote.status,
            "created_at": quote.created_at.isoformat(),
            "valid_until": quote.valid_until.isoformat() if quote.valid_until else None,
            "discount": str(quote.discount),
            "items_total": str(items_total),
            "total_amount": str(total_amount),
            "notes": quote.notes,
        },
        "customer": {
            "id": str(quote.customer_id),
            "name": quote.customer.name,
            "phone": quote.customer.phone,
            "whatsapp": quote.customer.whatsapp,
            "email": quote.customer.email,
        },
        "equipment": equipment,
        "items": items,
    }


def work_order_snapshot(work_order):
    from workorders.models import WorkOrder

    work_order = WorkOrder.objects.with_detail_data().get(pk=work_order.pk)
    services = [
        {
            "name": service.service_type.name,
            "description": service.description,
            "performed_at": service.performed_at.isoformat(),
            "labor_price": str(service.labor_price or Decimal("0.00")),
        }
        for service in work_order.services.filter(voided_at__isnull=True)
    ]
    parts = [
        {
            "description": part.description,
            "quantity": str(part.quantity),
            "unit_price": str(part.unit_price or Decimal("0.00")),
            "serial_number": part.serial_number,
            "warranty_until": (part.warranty_until.isoformat() if part.warranty_until else None),
        }
        for part in work_order.parts.filter(voided_at__isnull=True)
    ]
    labor_total = sum((Decimal(item["labor_price"]) for item in services), Decimal("0.00"))
    parts_total = sum(
        (Decimal(item["quantity"]) * Decimal(item["unit_price"]) for item in parts),
        Decimal("0.00"),
    )
    financial = {
        "labor_total": str(labor_total),
        "parts_total": str(parts_total),
        "discount": "0.00",
        "total_amount": str(labor_total + parts_total),
    }
    try:
        billing = work_order.billing
    except ObjectDoesNotExist:
        billing = None
    if billing:
        billing_total = billing.total_amount
        if billing_total is None:
            billing_total = labor_total + parts_total
        financial = {
            "labor_total": str(billing.labor_total if billing.labor_total is not None else labor_total),
            "parts_total": str(billing.parts_total if billing.parts_total is not None else parts_total),
            "discount": str(billing.discount or Decimal("0.00")),
            "total_amount": str(billing_total),
        }
    return {
        "business": _profile_snapshot(),
        "work_order": {
            "id": str(work_order.id),
            "number": work_order.number,
            "display_number": work_order.display_number,
            "title": work_order.title,
            "problem_description": work_order.problem_description,
            "diagnosis": work_order.diagnosis,
            "service_description": work_order.service_description,
            "solution": work_order.solution,
            "opened_at": work_order.opened_at.isoformat(),
            "completed_at": (work_order.completed_at.isoformat() if work_order.completed_at else None),
            "status": work_order.status.name,
            "responsible": (work_order.responsible_user.get_username() if work_order.responsible_user else ""),
        },
        "customer": {
            "id": str(work_order.customer_id),
            "name": work_order.customer.name,
            "phone": work_order.customer.phone,
            "whatsapp": work_order.customer.whatsapp,
            "email": work_order.customer.email,
        },
        "equipment": {
            "id": str(work_order.equipment_id),
            "type": work_order.equipment.equipment_type.name,
            "manufacturer": work_order.equipment.manufacturer,
            "model": work_order.equipment.model,
            "serial_number": work_order.equipment.serial_number,
            "asset_tag": work_order.equipment.asset_tag,
        },
        "services": services,
        "parts": parts,
        "financial": financial,
    }


def _checksum(snapshot):
    payload = json.dumps(
        snapshot,
        sort_keys=True,
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


@transaction.atomic
def create_quote(
    *,
    customer,
    title,
    equipment=None,
    work_order=None,
    description="",
    valid_until=None,
    discount=0,
    notes="",
    created_by=None,
):
    quote = Quote(
        number=_next_quote_number(),
        customer=customer,
        equipment=equipment,
        work_order=work_order,
        title=title,
        description=description,
        valid_until=valid_until,
        discount=discount or Decimal("0.00"),
        notes=notes,
        created_by=created_by,
    )
    quote.full_clean()
    quote.save()
    return quote


@transaction.atomic
def add_quote_item(
    *,
    quote,
    item_type,
    description,
    quantity,
    unit_price,
    discount=0,
    service_type=None,
    part=None,
    sort_order=0,
):
    quote = Quote.objects.select_for_update().get(pk=quote.pk)
    if not quote.is_editable:
        raise ValidationError("Orcamento fechado nao pode receber novos itens.")
    item = QuoteItem(
        quote=quote,
        item_type=item_type,
        service_type=service_type,
        part=part,
        description=description,
        quantity=quantity,
        unit_price=unit_price,
        discount=discount or Decimal("0.00"),
        sort_order=sort_order,
    )
    item.full_clean()
    item.save()
    return item


@transaction.atomic
def mark_quote_sent(*, quote):
    quote = Quote.objects.select_for_update().get(pk=quote.pk)
    if quote.status != QuoteStatus.DRAFT:
        raise ValidationError("Somente rascunhos podem ser marcados como enviados.")
    if not quote.items.exists():
        raise ValidationError("Nao e possivel enviar um orcamento sem itens.")
    _quote_amounts(quote)
    quote.status = QuoteStatus.SENT
    quote.sent_at = timezone.now()
    quote.save(update_fields=["status", "sent_at", "updated_at"])
    return quote


@transaction.atomic
def approve_quote(*, quote, approved_by=None):
    quote = Quote.objects.select_for_update().get(pk=quote.pk)
    if quote.status not in {QuoteStatus.DRAFT, QuoteStatus.SENT}:
        raise ValidationError("Este orcamento nao pode ser aprovado no estado atual.")
    if not quote.items.exists():
        raise ValidationError("Nao e possivel aprovar um orcamento sem itens.")
    _quote_amounts(quote)
    quote.status = QuoteStatus.APPROVED
    quote.approved_at = timezone.now()
    quote.approved_by = approved_by
    quote.full_clean()
    quote.save(update_fields=["status", "approved_at", "approved_by", "updated_at"])
    return quote


@transaction.atomic
def set_quote_terminal_status(*, quote, status):
    if status not in {QuoteStatus.REJECTED, QuoteStatus.CANCELLED}:
        raise ValidationError("Status terminal de orcamento invalido.")
    quote = Quote.objects.select_for_update().get(pk=quote.pk)
    if quote.status == QuoteStatus.APPROVED:
        raise ValidationError("Orcamento aprovado nao pode ser rejeitado/cancelado pelo fluxo basico.")
    if quote.status in {QuoteStatus.REJECTED, QuoteStatus.CANCELLED}:
        return quote
    quote.status = status
    quote.save(update_fields=["status", "updated_at"])
    return quote


@transaction.atomic
def create_work_order_from_quote(*, quote, responsible_user=None):
    # Lock only the quote row. PostgreSQL rejects FOR UPDATE when select_related()
    # introduces nullable OUTER JOINs for equipment/work_order.
    quote = Quote.objects.select_for_update().get(pk=quote.pk)
    if quote.status != QuoteStatus.APPROVED:
        raise ValidationError("Somente orcamentos aprovados podem gerar OS.")
    if quote.work_order_id:
        return quote.work_order
    if not quote.equipment_id:
        raise ValidationError("O orcamento precisa de equipamento para gerar uma OS.")
    work_order = create_work_order(
        customer=quote.customer,
        equipment=quote.equipment,
        title=quote.title,
        problem_description=(quote.description or f"Servico aprovado no {quote.display_number}"),
        responsible_user=responsible_user,
    )
    quote.work_order = work_order
    quote.save(update_fields=["work_order", "updated_at"])
    return work_order


@transaction.atomic
def issue_document(*, document_type, generated_by=None, quote=None, work_order=None):
    if document_type == DocumentType.QUOTE:
        if not quote:
            raise ValidationError("Informe o orcamento.")
        quote = Quote.objects.select_for_update().get(pk=quote.pk)
        snapshot = quote_snapshot(quote)
        filter_kwargs = {"document_type": document_type, "quote": quote}
    elif document_type == DocumentType.WORK_ORDER:
        if not work_order:
            raise ValidationError("Informe a OS.")
        work_order = work_order.__class__.objects.select_for_update().get(pk=work_order.pk)
        snapshot = work_order_snapshot(work_order)
        filter_kwargs = {"document_type": document_type, "work_order": work_order}
    else:
        raise ValidationError("Tipo de documento ainda nao suportado para emissao.")

    current = (
        GeneratedDocument.objects.filter(**filter_kwargs).aggregate(max_version=Max("version"))["max_version"] or 0
    )
    document = GeneratedDocument(
        document_type=document_type,
        quote=quote,
        work_order=work_order,
        version=current + 1,
        snapshot=snapshot,
        checksum=_checksum(snapshot),
        generated_at=timezone.now(),
        generated_by=generated_by,
    )
    document.full_clean()
    document.save()
    return document
