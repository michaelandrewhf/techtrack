import hashlib
import json
from datetime import date, datetime
from decimal import Decimal

from django.core.exceptions import ObjectDoesNotExist, ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Max
from django.utils import timezone

from config.pdf import PdfDocument
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


def _money(value):
    value = Decimal(str(value or 0))
    return f"R$ {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _pt_date(value):
    if not value:
        return "-"
    if isinstance(value, (date, datetime)):
        parsed = value
    else:
        try:
            parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except ValueError:
            try:
                parsed = date.fromisoformat(str(value))
            except ValueError:
                return str(value)
    return parsed.strftime("%d/%m/%Y")


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
            "type": quote.equipment.equipment_type.name if quote.equipment.equipment_type_id else "",
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
            "warranty_until": part.warranty_until.isoformat() if part.warranty_until else None,
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
            "completed_at": work_order.completed_at.isoformat() if work_order.completed_at else None,
            "status": work_order.status.name,
            "responsible": work_order.responsible_user.get_username() if work_order.responsible_user else "",
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
        problem_description=quote.description or f"Servico aprovado no {quote.display_number}",
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


def _business_footer(business):
    values = [
        business.get("document"),
        business.get("phone") or business.get("whatsapp"),
        business.get("email"),
    ]
    return " · ".join(value for value in values if value)


def _quote_status_label(status):
    return {
        "draft": "Rascunho",
        "sent": "Enviado",
        "approved": "Aprovado",
        "rejected": "Rejeitado",
        "cancelled": "Cancelado",
    }.get(status, status or "-")


def quote_pdf_from_snapshot(snapshot, revision=""):
    business = snapshot["business"]
    quote = snapshot["quote"]
    customer = snapshot["customer"]
    equipment = snapshot.get("equipment")
    document = PdfDocument(
        brand=business.get("name") or "TechTrack",
        document_label="Orcamento",
        document_number=quote["display_number"],
        footer_left=_business_footer(business),
        revision=revision,
    )
    document.metadata_row(
        [
            ("Data", _pt_date(quote.get("created_at"))),
            ("Validade", _pt_date(quote.get("valid_until"))),
            ("Status", _quote_status_label(quote.get("status"))),
        ]
    )
    document.section_title("Prestador")
    document.info_box(
        [
            ("Nome", business.get("name") or "TechTrack"),
            ("Documento", business.get("document") or "-"),
            ("Contato", business.get("phone") or business.get("whatsapp") or "-"),
            ("E-mail", business.get("email") or "-"),
            ("Endereco", business.get("address") or "-"),
        ]
    )
    document.section_title("Cliente")
    document.info_box(
        [
            ("Nome", customer.get("name") or "-"),
            ("Contato", customer.get("whatsapp") or customer.get("phone") or "-"),
            ("E-mail", customer.get("email") or "-"),
        ]
    )
    if equipment:
        document.section_title("Equipamento")
        document.info_box(
            [
                ("Tipo", equipment.get("type") or "-"),
                ("Marca / modelo", " ".join(filter(None, [equipment.get("manufacturer"), equipment.get("model")])) or "-"),
                ("Identificacao", equipment.get("asset_tag") or "-"),
                ("Serial", equipment.get("serial_number") or "-"),
            ]
        )
    document.section_title("Solicitacao / escopo")
    document.paragraph("Titulo", quote.get("title") or "Orcamento")
    if quote.get("description"):
        document.paragraph("Descricao", quote["description"])
    document.section_title("Itens")
    document.table(
        headers=["Descricao", "Qtd.", "Unitario", "Desconto", "Total"],
        rows=[
            [
                item.get("description") or "-",
                item.get("quantity") or "0",
                _money(item.get("unit_price")),
                _money(item.get("discount")),
                _money(item.get("total")),
            ]
            for item in snapshot.get("items", [])
        ],
        widths=[251, 50, 75, 65, 70],
        aligns=["left", "right", "right", "right", "right"],
    )
    document.totals(
        [
            ("Subtotal", _money(quote.get("items_total"))),
            ("Desconto", _money(quote.get("discount"))),
            ("Total final", _money(quote.get("total_amount"))),
        ]
    )
    if quote.get("notes"):
        document.section_title("Observacoes")
        document.note_box("Observacoes da proposta", quote["notes"])
    return document.build()


def work_order_pdf_from_snapshot(snapshot, revision=""):
    business = snapshot["business"]
    work_order = snapshot["work_order"]
    customer = snapshot["customer"]
    equipment = snapshot["equipment"]
    financial = snapshot.get("financial") or {}
    document = PdfDocument(
        brand=business.get("name") or "TechTrack",
        document_label="Ordem de Servico",
        document_number=work_order["display_number"],
        footer_left=_business_footer(business),
        revision=revision,
    )
    document.metadata_row(
        [
            ("Abertura", _pt_date(work_order.get("opened_at"))),
            ("Conclusao", _pt_date(work_order.get("completed_at"))),
            ("Status", work_order.get("status") or "-"),
            ("Responsavel", work_order.get("responsible") or "-"),
        ]
    )
    document.section_title("Prestador")
    document.info_box(
        [
            ("Nome", business.get("name") or "TechTrack"),
            ("Documento", business.get("document") or "-"),
            ("Contato", business.get("phone") or business.get("whatsapp") or "-"),
            ("E-mail", business.get("email") or "-"),
            ("Endereco", business.get("address") or "-"),
        ]
    )
    document.section_title("Cliente")
    document.info_box(
        [
            ("Nome", customer.get("name") or "-"),
            ("Contato", customer.get("whatsapp") or customer.get("phone") or "-"),
            ("E-mail", customer.get("email") or "-"),
        ]
    )
    document.section_title("Equipamento")
    document.info_box(
        [
            ("Tipo", equipment.get("type") or "-"),
            ("Marca / modelo", " ".join(filter(None, [equipment.get("manufacturer"), equipment.get("model")])) or "-"),
            ("Identificacao", equipment.get("asset_tag") or "-"),
            ("Serial", equipment.get("serial_number") or "-"),
        ]
    )
    document.section_title("Conteudo tecnico")
    document.paragraph("Problema relatado", work_order.get("problem_description") or "-")
    document.paragraph("Diagnostico", work_order.get("diagnosis") or "-")
    if work_order.get("service_description"):
        document.paragraph("Execucao", work_order["service_description"])
    document.paragraph("Solucao", work_order.get("solution") or "-")

    if snapshot.get("services"):
        document.section_title("Servicos realizados")
        document.table(
            headers=["Servico", "Descricao", "Data", "Valor"],
            rows=[
                [
                    service.get("name") or "-",
                    service.get("description") or "-",
                    _pt_date(service.get("performed_at")),
                    _money(service.get("labor_price")),
                ]
                for service in snapshot["services"]
            ],
            widths=[150, 220, 70, 71],
            aligns=["left", "left", "left", "right"],
        )

    if snapshot.get("parts"):
        document.section_title("Pecas utilizadas")
        part_rows = []
        for part in snapshot["parts"]:
            total = Decimal(str(part.get("quantity") or 0)) * Decimal(str(part.get("unit_price") or 0))
            part_rows.append(
                [
                    part.get("description") or "-",
                    part.get("quantity") or "0",
                    _money(part.get("unit_price")),
                    _money(total),
                ]
            )
        document.table(
            headers=["Descricao", "Qtd.", "Unitario", "Total"],
            rows=part_rows,
            widths=[280, 61, 85, 85],
            aligns=["left", "right", "right", "right"],
        )

    total_amount = Decimal(str(financial.get("total_amount") or 0))
    labor_total = Decimal(str(financial.get("labor_total") or 0))
    parts_total = Decimal(str(financial.get("parts_total") or 0))
    discount = Decimal(str(financial.get("discount") or 0))
    if any(value != 0 for value in [total_amount, labor_total, parts_total, discount]):
        document.section_title("Resumo financeiro")
        document.totals(
            [
                ("Mao de obra", _money(labor_total)),
                ("Pecas", _money(parts_total)),
                ("Desconto", _money(discount)),
                ("Total", _money(total_amount)),
            ]
        )
    return document.build()
