from config.pdf import CONTENT_BOTTOM
from documents.renderers import render_quote_pdf, render_work_order_pdf
from documents.renderers.base import ClientPdfDocument

BUSINESS = {
    "name": "TechTrack",
    "document": "12.345.678/0001-90",
    "phone": "(19) 99999-0000",
    "whatsapp": "",
    "email": "contato@techtrack.test",
    "address": "Rua Exemplo, 100",
}

CUSTOMER = {
    "id": "customer-1",
    "name": "Cliente de Teste",
    "phone": "",
    "whatsapp": "(19) 98888-0000",
    "email": "cliente@example.com",
}

EQUIPMENT = {
    "id": "equipment-1",
    "type": "Notebook",
    "manufacturer": "Dell",
    "model": "Latitude 5420",
    "serial_number": "ABC123",
    "asset_tag": "TI-001",
}

LONG_TEXT = (
    "Procedimento técnico detalhado com validação de componentes, testes de estabilidade, "
    "registro das evidências encontradas e confirmação das condições operacionais do equipamento. "
) * 180


def pdf_page_count(pdf: bytes) -> int:
    return pdf.count(b"/Type /Page ")


def assert_multi_page_pdf(pdf: bytes, *, minimum_pages: int) -> None:
    assert pdf.startswith(b"%PDF-1.4")
    assert pdf.endswith(b"%%EOF\n")
    page_count = pdf_page_count(pdf)
    assert page_count >= minimum_pages
    assert pdf.count(b"Pagina ") == page_count
    assert f"Pagina 1/{page_count}".encode() in pdf
    assert f"Pagina {page_count}/{page_count}".encode() in pdf


def quote_snapshot() -> dict:
    return {
        "business": BUSINESS,
        "quote": {
            "display_number": "ORC #000001",
            "title": "Manutenção preventiva completa",
            "description": "Limpeza interna, revisão térmica e testes de estabilidade.",
            "status": "approved",
            "created_at": "2026-09-05T12:00:00Z",
            "valid_until": "2026-09-20",
            "discount": "20.00",
            "items_total": "320.00",
            "total_amount": "300.00",
            "notes": "Prazo estimado de até dois dias úteis após a aprovação.",
        },
        "customer": CUSTOMER,
        "equipment": EQUIPMENT,
        "items": [
            {
                "description": "Limpeza interna e troca de pasta térmica",
                "quantity": "1.00",
                "unit_price": "220.00",
                "discount": "0.00",
                "total": "220.00",
            },
            {
                "description": "SSD 480 GB",
                "quantity": "1.00",
                "unit_price": "100.00",
                "discount": "0.00",
                "total": "100.00",
            },
        ],
    }


def work_order_snapshot() -> dict:
    return {
        "business": BUSINESS,
        "work_order": {
            "display_number": "OS #000001",
            "title": "Notebook aquecendo e desligando",
            "problem_description": "Equipamento desliga durante uso intenso.",
            "diagnosis": "Sistema térmico obstruído e pasta térmica ressecada.",
            "service_description": "Limpeza técnica, troca da pasta térmica e testes de carga.",
            "solution": "Temperaturas normalizadas após manutenção e testes.",
            "opened_at": "2026-09-01T10:00:00Z",
            "completed_at": "2026-09-05T14:00:00Z",
            "status": "Concluída",
            "responsible": "michael",
        },
        "customer": CUSTOMER,
        "equipment": EQUIPMENT,
        "services": [
            {
                "name": "Manutenção preventiva",
                "description": "Limpeza e revisão térmica",
                "performed_at": "2026-09-05T11:00:00Z",
                "labor_price": "220.00",
            }
        ],
        "parts": [
            {
                "description": "Pasta térmica",
                "quantity": "1.00",
                "unit_price": "30.00",
                "serial_number": "",
                "warranty_until": None,
            }
        ],
        "financial": {
            "labor_total": "220.00",
            "parts_total": "30.00",
            "discount": "0.00",
            "total_amount": "250.00",
        },
    }


def test_quote_renderer_builds_versioned_pdf():
    pdf = render_quote_pdf(quote_snapshot(), revision="v1")

    assert pdf.startswith(b"%PDF-1.4")
    assert pdf.endswith(b"%%EOF\n")
    assert len(pdf) > 1_500


def test_work_order_renderer_builds_pdf_with_technical_sections():
    pdf = render_work_order_pdf(work_order_snapshot(), revision="PREVIA")

    assert pdf.startswith(b"%PDF-1.4")
    assert pdf.endswith(b"%%EOF\n")
    assert len(pdf) > 1_500


def test_note_box_continues_on_new_pages_without_crossing_content_boundary():
    document = ClientPdfDocument(
        brand="TechTrack",
        document_label="Teste",
        document_number="DOC #1",
    )

    document.note_box("Diagnóstico", LONG_TEXT)

    assert len(document.pages) >= 2
    assert document.y >= CONTENT_BOTTOM
    assert_multi_page_pdf(document.build(), minimum_pages=2)


def test_table_splits_a_single_oversized_row_across_pages():
    document = ClientPdfDocument(
        brand="TechTrack",
        document_label="Teste",
        document_number="DOC #2",
    )
    oversized_description = "Descrição técnica extensa para validar quebra segura de linha e página. " * 500

    document.table(
        headers=["Descrição", "Qtd."],
        rows=[[oversized_description, "1"]],
        widths=[450, 61],
        aligns=["left", "right"],
    )

    assert len(document.pages) >= 2
    assert document.y >= CONTENT_BOTTOM
    assert_multi_page_pdf(document.build(), minimum_pages=2)


def test_quote_renderer_handles_long_scope_items_and_notes_across_pages():
    snapshot = quote_snapshot()
    snapshot["quote"] = {
        **snapshot["quote"],
        "description": LONG_TEXT,
        "notes": LONG_TEXT,
        "items_total": "6000.00",
        "discount": "0.00",
        "total_amount": "6000.00",
    }
    snapshot["items"] = [
        {
            "description": f"Item {index + 1}: " + ("descrição detalhada do serviço e critérios de aceite. " * 6),
            "quantity": "1.00",
            "unit_price": "150.00",
            "discount": "0.00",
            "total": "150.00",
        }
        for index in range(40)
    ]

    pdf = render_quote_pdf(snapshot, revision="v9")

    assert_multi_page_pdf(pdf, minimum_pages=5)


def test_work_order_renderer_handles_long_technical_history_and_large_tables():
    snapshot = work_order_snapshot()
    snapshot["work_order"] = {
        **snapshot["work_order"],
        "problem_description": LONG_TEXT,
        "diagnosis": LONG_TEXT,
        "service_description": LONG_TEXT,
        "solution": LONG_TEXT,
    }
    snapshot["services"] = [
        {
            "name": f"Serviço técnico {index + 1}",
            "description": "Execução validada com testes funcionais e registro técnico. " * 5,
            "performed_at": "2026-09-05T11:00:00Z",
            "labor_price": "100.00",
        }
        for index in range(25)
    ]
    snapshot["parts"] = [
        {
            "description": f"Peça de reposição {index + 1} com especificação técnica completa",
            "quantity": "1.00",
            "unit_price": "25.00",
            "serial_number": "",
            "warranty_until": None,
        }
        for index in range(25)
    ]
    snapshot["financial"] = {
        "labor_total": "2500.00",
        "parts_total": "625.00",
        "discount": "125.00",
        "total_amount": "3000.00",
    }

    pdf = render_work_order_pdf(snapshot, revision="PREVIA")

    assert_multi_page_pdf(pdf, minimum_pages=8)
