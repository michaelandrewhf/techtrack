from __future__ import annotations

from decimal import Decimal

from .base import ClientPdfDocument
from .common import business_footer, equipment_model, money, pt_date


def render_work_order_pdf(snapshot: dict, revision: str = "") -> bytes:
    business = snapshot["business"]
    work_order = snapshot["work_order"]
    customer = snapshot["customer"]
    equipment = snapshot["equipment"]
    financial = snapshot.get("financial") or {}

    document = ClientPdfDocument(
        brand=business.get("name") or "TechTrack",
        document_label="Ordem de Serviço",
        document_number=work_order["display_number"],
        footer_left=business_footer(business),
        revision=revision,
    )
    document.metadata_row(
        [
            ("Abertura", pt_date(work_order.get("opened_at"))),
            ("Conclusão", pt_date(work_order.get("completed_at"))),
            ("Status", work_order.get("status") or "-"),
            ("Responsável", work_order.get("responsible") or "-"),
        ]
    )
    document.paired_cards(
        left_title="Prestador",
        left_fields=[
            ("Empresa", business.get("name") or "TechTrack"),
            ("Documento", business.get("document") or "-"),
            ("Contato", business.get("phone") or business.get("whatsapp") or "-"),
            ("E-mail", business.get("email") or "-"),
        ],
        right_title="Cliente",
        right_fields=[
            ("Nome", customer.get("name") or "-"),
            ("Contato", customer.get("whatsapp") or customer.get("phone") or "-"),
            ("E-mail", customer.get("email") or "-"),
        ],
    )

    document.section_title("Equipamento", keep_with=70)
    document.info_box(
        [
            ("Tipo", equipment.get("type") or "-"),
            ("Marca / modelo", equipment_model(equipment)),
            ("Patrimônio", equipment.get("asset_tag") or "-"),
            ("Serial", equipment.get("serial_number") or "-"),
        ],
        columns=4,
    )

    document.section_title("Atendimento técnico", keep_with=80)
    document.lead_block(
        work_order.get("title") or "Atendimento técnico",
        work_order.get("problem_description") or "-",
    )
    document.note_box("Diagnóstico", work_order.get("diagnosis") or "-")
    if work_order.get("service_description"):
        document.note_box("Execução", work_order["service_description"])
    document.note_box("Solução", work_order.get("solution") or "-")

    if snapshot.get("services"):
        document.section_title("Serviços realizados", keep_with=70)
        document.table(
            headers=["Serviço", "Descrição", "Data", "Valor"],
            rows=[
                [
                    service.get("name") or "-",
                    service.get("description") or "-",
                    pt_date(service.get("performed_at")),
                    money(service.get("labor_price")),
                ]
                for service in snapshot["services"]
            ],
            widths=[150, 220, 70, 71],
            aligns=["left", "left", "left", "right"],
        )

    if snapshot.get("parts"):
        document.section_title("Peças utilizadas", keep_with=70)
        part_rows = []
        for part in snapshot["parts"]:
            total = Decimal(str(part.get("quantity") or 0)) * Decimal(str(part.get("unit_price") or 0))
            part_rows.append(
                [
                    part.get("description") or "-",
                    part.get("quantity") or "0",
                    money(part.get("unit_price")),
                    money(total),
                ]
            )
        document.table(
            headers=["Descrição", "Qtd.", "Unitário", "Total"],
            rows=part_rows,
            widths=[280, 61, 85, 85],
            aligns=["left", "right", "right", "right"],
        )

    total_amount = Decimal(str(financial.get("total_amount") or 0))
    labor_total = Decimal(str(financial.get("labor_total") or 0))
    parts_total = Decimal(str(financial.get("parts_total") or 0))
    discount = Decimal(str(financial.get("discount") or 0))
    if any(value != 0 for value in [total_amount, labor_total, parts_total, discount]):
        document.section_title("Resumo financeiro", keep_with=120)
        document.totals(
            [
                ("Mão de obra", money(labor_total)),
                ("Peças", money(parts_total)),
                ("Desconto", money(discount)),
                ("Total do atendimento", money(total_amount)),
            ]
        )

    document.section_title("Confirmação do atendimento", keep_with=80)
    document.signature_area(["Responsável pelo cliente", "Responsável técnico"])
    return document.build()
