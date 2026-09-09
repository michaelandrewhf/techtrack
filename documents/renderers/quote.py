from __future__ import annotations

from config.pdf import MARGIN_X

from .base import BORDER, INK, MUTED, NAVY, PRIMARY, ClientPdfDocument
from .common import business_footer, equipment_model, money, pt_date, quote_status_label


class QuotePdfDocument(ClientPdfDocument):
    """Quote-specific presentation with a compact commercial header."""

    def _draw_header(self, *, first_page: bool) -> None:
        if not first_page:
            super()._draw_header(first_page=False)
            return

        self._draw_rect(0, 838, 595, 4, fill=PRIMARY, stroke=PRIMARY)
        self._draw_text(self.brand, MARGIN_X, 805, size=13, bold=True, color=NAVY)
        self._draw_text(
            "GESTAO DE SERVICOS DE TI",
            MARGIN_X,
            791,
            size=6.5,
            bold=True,
            color=MUTED,
        )

        self._draw_cell_text(
            "ORCAMENTO",
            553,
            805,
            width=185,
            size=7.2,
            bold=True,
            color=PRIMARY,
            align="right",
        )
        self._draw_cell_text(
            self.document_number,
            553,
            783,
            width=205,
            size=14.5,
            bold=True,
            color=INK,
            align="right",
        )
        if self.revision:
            self._draw_cell_text(
                self.revision.upper(),
                553,
                768,
                width=205,
                size=6.5,
                bold=True,
                color=MUTED,
                align="right",
            )

        self._draw_line(MARGIN_X, 750, 553, 750, color=BORDER)
        self._draw_text("PROPOSTA COMERCIAL", MARGIN_X, 731, size=7.2, bold=True, color=PRIMARY)
        self.y = 712


def _contact(*values: str | None) -> str:
    values = [value for value in values if value]
    return " | ".join(values) or "-"


def render_quote_pdf(snapshot: dict, revision: str = "") -> bytes:
    business = snapshot["business"]
    quote = snapshot["quote"]
    customer = snapshot["customer"]
    equipment = snapshot.get("equipment")

    document = QuotePdfDocument(
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

    document.info_box(
        [
            (
                "Cliente",
                _contact(
                    customer.get("name"),
                    customer.get("whatsapp") or customer.get("phone"),
                    customer.get("email"),
                ),
            ),
            (
                "Prestador",
                _contact(
                    business.get("name") or "TechTrack",
                    business.get("phone") or business.get("whatsapp"),
                    business.get("email"),
                ),
            ),
        ],
        columns=2,
    )

    if equipment:
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

    document.lead_block(
        quote.get("title") or "Proposta de serviço",
        quote.get("description") or "",
    )

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
        document.section_title("Condições e observações", keep_with=60)
        document.note_box("Observações da proposta", quote["notes"])

    return document.build()
