from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from rest_framework.test import APIClient

from catalog.models import ServiceType
from customers.models import Customer
from documents.renderers.quote import render_quote_pdf
from inventory.models import Equipment, EquipmentType
from quotes.models import DocumentType, GeneratedDocument, QuoteStatus
from quotes.services import (
    add_quote_item,
    approve_quote,
    create_quote,
    create_work_order_from_quote,
    issue_document,
    mark_quote_sent,
)


@pytest.fixture
def user(db):
    return get_user_model().objects.create_user(username="quote-user", password="secret123")


@pytest.fixture
def customer(db):
    return Customer.objects.create(name="Cliente Orcamento")


@pytest.fixture
def equipment(customer):
    return Equipment.objects.create(
        customer=customer,
        equipment_type=EquipmentType.objects.get(slug="notebook"),
        manufacturer="Dell",
        model="Latitude",
        serial_number="ABC123",
    )


@pytest.fixture
def service_type(db):
    return ServiceType.objects.create(name="Diagnostico tecnico", slug="quote-diagnostic")


def test_quote_number_is_sequential(customer, equipment):
    first = create_quote(customer=customer, equipment=equipment, title="Primeiro")
    second = create_quote(customer=customer, equipment=equipment, title="Segundo")
    assert first.number == 1
    assert second.number == 2


def test_quote_rejects_equipment_from_other_customer(db, customer):
    other = Customer.objects.create(name="Outro")
    equipment = Equipment.objects.create(
        customer=other,
        equipment_type=EquipmentType.objects.get(slug="notebook"),
    )
    with pytest.raises(ValidationError):
        create_quote(customer=customer, equipment=equipment, title="Invalido")


def test_quote_approval_requires_items(customer, equipment):
    quote = create_quote(customer=customer, equipment=equipment, title="Sem itens")
    with pytest.raises(ValidationError):
        approve_quote(quote=quote)


def test_quote_workflow_and_create_work_order(customer, equipment, service_type, user):
    quote = create_quote(
        customer=customer,
        equipment=equipment,
        title="Manutencao preventiva",
        description="Limpeza e revisao",
        valid_until=date(2026, 9, 30),
        created_by=user,
    )
    add_quote_item(
        quote=quote,
        item_type="service",
        service_type=service_type,
        description="Limpeza interna",
        quantity=Decimal("1.00"),
        unit_price=Decimal("250.00"),
    )
    quote = mark_quote_sent(quote=quote)
    assert quote.status == QuoteStatus.SENT
    quote = approve_quote(quote=quote, approved_by=user)
    assert quote.status == QuoteStatus.APPROVED

    work_order = create_work_order_from_quote(quote=quote, responsible_user=user)
    quote.refresh_from_db()
    assert quote.work_order == work_order
    assert work_order.customer == customer
    assert work_order.equipment == equipment


def test_issued_quote_document_is_snapshot(customer, equipment, service_type, user):
    quote = create_quote(
        customer=customer,
        equipment=equipment,
        title="Orcamento original",
        created_by=user,
    )
    add_quote_item(
        quote=quote,
        item_type="service",
        service_type=service_type,
        description="Servico",
        quantity=1,
        unit_price="100.00",
    )
    document = issue_document(
        document_type=DocumentType.QUOTE,
        quote=quote,
        generated_by=user,
    )
    assert document.version == 1
    assert document.snapshot["quote"]["title"] == "Orcamento original"

    quote.title = "Titulo alterado"
    quote.save(update_fields=["title", "updated_at"])
    document.refresh_from_db()
    assert document.snapshot["quote"]["title"] == "Orcamento original"
    assert GeneratedDocument.objects.filter(quote=quote).count() == 1


def test_quote_pdf_is_valid_pdf(customer, equipment, service_type):
    quote = create_quote(customer=customer, equipment=equipment, title="PDF")
    add_quote_item(
        quote=quote,
        item_type="service",
        service_type=service_type,
        description="Servico PDF",
        quantity=1,
        unit_price="120.00",
    )
    document = issue_document(document_type=DocumentType.QUOTE, quote=quote)
    pdf = render_quote_pdf(document.snapshot)
    assert pdf.startswith(b"%PDF-1.4")
    assert len(pdf) > 300


def test_quote_api_pdf_download(user, customer, equipment, service_type):
    quote = create_quote(
        customer=customer,
        equipment=equipment,
        title="API PDF",
        created_by=user,
    )
    add_quote_item(
        quote=quote,
        item_type="service",
        service_type=service_type,
        description="Servico API",
        quantity=1,
        unit_price="99.90",
    )
    client = APIClient()
    client.force_authenticate(user=user)
    response = client.get(f"/api/v1/quotes/{quote.id}/pdf/")
    assert response.status_code == 200
    assert response["Content-Type"] == "application/pdf"
    assert response.content.startswith(b"%PDF-1.4")
