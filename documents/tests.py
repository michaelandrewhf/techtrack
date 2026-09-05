from documents.renderers import render_quote_pdf, render_work_order_pdf

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


def test_quote_renderer_builds_versioned_pdf():
    snapshot = {
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

    pdf = render_quote_pdf(snapshot, revision="v1")

    assert pdf.startswith(b"%PDF-1.4")
    assert pdf.endswith(b"%%EOF\n")
    assert len(pdf) > 1_500


def test_work_order_renderer_builds_pdf_with_technical_sections():
    snapshot = {
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

    pdf = render_work_order_pdf(snapshot, revision="PREVIA")

    assert pdf.startswith(b"%PDF-1.4")
    assert pdf.endswith(b"%%EOF\n")
    assert len(pdf) > 1_500
