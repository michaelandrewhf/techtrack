from __future__ import annotations

from .base import ClientPdfDocument
from .common import business_footer, equipment_model, money, pt_date, quote_status_label


def render_quote_pdf(snapshot: dict, revision: str = "") -> bytes:
    business = snapshot["business"]
    quote = snapshot["quote"]
    customer = snapshot["customer"]
    equipment = snapshot.get("equipment")

    document = ClientPdfDocument(
        brand=business.get("name") or "TechTrack",
        document_label="Orçamento",
        document_number=quote["display_number"],
        footer_left=business_footer(business),
        revision=revision,
    )
    document.metadata_row(
        [
            ("Emissão", pt_date(quote.get("created_at"))),
            ("Validade", pt_date(quote.get("valid_until"))),
            ("Situação", quote_status_label(quote.get("status"))),
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

    if equipment:
        document.section_title("Equipamento")
        document.info_box(
            [
                ("Tipo", equipment.get("type") or "-"),
                ("Marca / modelo", equipment_model(equipment)),
                ("Patrimônio", equipment.get("asset_tag") or "-"),
                ("Serial", equipment.get("serial_number") or "-"),
            ],
            columns=4,
        )

    document.section_title("Escopo da proposta")
    document.lead_block(quote.get("title") or "Proposta de serviço", quote.get("description") or "")

    document.section_title("Itens e valores")
    document.table(
        headers=["Descrição", "Qtd.", "Unitário", "Desconto", "Total"],
        rows=[
            [
                item.get("description") or "-",
                item.get("quantity") or "0",
                money(item.get("unit_price")),
                money(item.get("discount")),
                money(item.get("total")),
            ]
            for item in snapshot.get("items", [])
        ],
        widths=[251, 50, 75, 65, 70],
        aligns=["left", "right", "right", "right", "right"],
    )
    document.totals(
        [
            ("Subtotal", money(quote.get("items_total"))),
            ("Desconto", money(quote.get("discount"))),
            ("Total da proposta", money(quote.get("total_amount"))),
        ]
    )

    if quote.get("notes"):
        document.section_title("Condições e observações")
        document.note_box("Observações da proposta", quote["notes"])

    document.section_title("Aceite")
    document.signature_area(["Aprovação do cliente", "Data"])
    return document.build()
