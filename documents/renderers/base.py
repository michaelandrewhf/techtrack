from __future__ import annotations

from config.pdf import CONTENT_BOTTOM, CONTENT_TOP, MARGIN_X, WHITE, PdfDocument

PRIMARY = (0.145, 0.388, 0.922)
PRIMARY_SOFT = (0.925, 0.953, 1.0)
NAVY = (0.055, 0.090, 0.165)
INK = (0.090, 0.125, 0.200)
MUTED = (0.390, 0.445, 0.535)
BORDER = (0.865, 0.890, 0.930)
TINT = (0.965, 0.975, 0.992)
WHITE_SOFT = (0.995, 0.997, 1.0)

CONTENT_WIDTH = 511


class ClientPdfDocument(PdfDocument):
    """Presentation-focused TechTrack document built on the low-level PDF engine."""

    def _draw_header(self, *, first_page: bool) -> None:
        if first_page:
            self._draw_rect(0, 836, 595, 6, fill=PRIMARY, stroke=PRIMARY)
            self._draw_text(self.brand, MARGIN_X, 800, size=12, bold=True, color=NAVY)
            self._draw_text(
                "GESTAO DE SERVICOS DE TI",
                MARGIN_X,
                786,
                size=6.5,
                bold=True,
                color=MUTED,
            )
            self._draw_text(
                self.document_label,
                MARGIN_X,
                755,
                size=21,
                bold=True,
                color=INK,
            )
            self._draw_text(
                "DOCUMENTO COMERCIAL",
                MARGIN_X,
                741,
                size=7,
                bold=True,
                color=PRIMARY,
            )

            self._draw_rect(398, 754, 155, 54, fill=NAVY, stroke=NAVY)
            self._draw_text("NUMERO", 410, 792, size=6.8, bold=True, color=(0.66, 0.73, 0.84))
            self._draw_cell_text(
                self.document_number,
                541,
                770,
                width=125,
                size=14,
                bold=True,
                color=WHITE,
                align="right",
            )
            if self.revision:
                self._draw_text(
                    self.revision.upper(),
                    410,
                    759,
                    size=6.5,
                    bold=True,
                    color=(0.66, 0.73, 0.84),
                )

            self._draw_line(MARGIN_X, 724, 553, 724, color=BORDER)
            self.y = 706
            return

        self._draw_text(self.brand, MARGIN_X, 807, size=10.5, bold=True, color=NAVY)
        self._draw_cell_text(
            f"{self.document_label} | {self.document_number}",
            553,
            807,
            width=260,
            size=8,
            color=MUTED,
            align="right",
        )
        self._draw_line(MARGIN_X, 797, 553, 797, color=BORDER)
        self.y = 780

    def metadata_row(self, items: list[tuple[str, str]]) -> None:
        if not items:
            return
        self._ensure_space(58)
        height = 46
        bottom = self.y - height
        self._draw_rect(MARGIN_X, bottom, CONTENT_WIDTH, height, fill=TINT, stroke=BORDER)
        self._draw_rect(MARGIN_X, bottom, 3, height, fill=PRIMARY, stroke=PRIMARY)

        count = len(items)
        width = CONTENT_WIDTH / count
        for index, (label, value) in enumerate(items):
            x = MARGIN_X + index * width + 12
            self._draw_text(label.upper(), x, self.y - 15, size=6.8, bold=True, color=MUTED)
            self._draw_text(value or "-", x, self.y - 32, size=9.2, bold=True, color=INK)
            if index:
                divider_x = MARGIN_X + index * width
                self._draw_line(divider_x, bottom + 10, divider_x, self.y - 10, color=BORDER)
        self.y = bottom - 16

    def section_title(self, title: str) -> None:
        self._ensure_space(34)
        self._draw_rect(MARGIN_X, self.y - 18, 3, 18, fill=PRIMARY, stroke=PRIMARY)
        self._draw_text(title.upper(), MARGIN_X + 11, self.y - 14, size=8.5, bold=True, color=INK)
        self._draw_line(MARGIN_X, self.y - 25, 553, self.y - 25, color=BORDER)
        self.y -= 36

    def info_box(self, fields: list[tuple[str, str]], *, columns: int = 2) -> None:
        if not fields:
            return
        columns = max(1, min(columns, 4))
        rows = (len(fields) + columns - 1) // columns
        row_height = 44
        height = rows * row_height + 12
        self._ensure_space(height + 8)
        bottom = self.y - height
        self._draw_rect(MARGIN_X, bottom, CONTENT_WIDTH, height, fill=WHITE_SOFT, stroke=BORDER)
        column_width = CONTENT_WIDTH / columns

        for index, (label, value) in enumerate(fields):
            row = index // columns
            column = index % columns
            x = MARGIN_X + column * column_width + 11
            y = self.y - 17 - row * row_height
            self._draw_text(label.upper(), x, y, size=6.5, bold=True, color=MUTED)
            lines = self._wrapped_lines(value or "-", column_width - 22, 8.8)[:2]
            line_y = y - 14
            for line in lines:
                self._draw_text(line, x, line_y, size=8.8, bold=True, color=INK)
                line_y -= 11

        self.y = bottom - 14

    def paired_cards(
        self,
        *,
        left_title: str,
        left_fields: list[tuple[str, str]],
        right_title: str,
        right_fields: list[tuple[str, str]],
    ) -> None:
        height = 124
        gap = 12
        card_width = (CONTENT_WIDTH - gap) / 2
        self._ensure_space(height + 10)
        bottom = self.y - height

        def draw_card(x: float, title: str, fields: list[tuple[str, str]]) -> None:
            self._draw_rect(x, bottom, card_width, height, fill=WHITE_SOFT, stroke=BORDER)
            self._draw_rect(x, self.y - 4, card_width, 4, fill=PRIMARY, stroke=PRIMARY)
            self._draw_text(title.upper(), x + 12, self.y - 22, size=7.5, bold=True, color=PRIMARY)
            cell_width = (card_width - 24) / 2
            for index, (label, value) in enumerate(fields[:4]):
                row = index // 2
                column = index % 2
                field_x = x + 12 + column * cell_width
                field_y = self.y - 47 - row * 43
                self._draw_text(label.upper(), field_x, field_y, size=6.2, bold=True, color=MUTED)
                lines = self._wrapped_lines(value or "-", cell_width - 10, 8.3)[:2]
                value_y = field_y - 13
                for line in lines:
                    self._draw_text(line, field_x, value_y, size=8.3, bold=True, color=INK)
                    value_y -= 10.5

        draw_card(MARGIN_X, left_title, left_fields)
        draw_card(MARGIN_X + card_width + gap, right_title, right_fields)
        self.y = bottom - 16

    def lead_block(self, title: str, text: str = "") -> None:
        title_lines = self._wrapped_lines(title or "-", 475, 12)[:3]
        body_lines = self._wrapped_lines(text, 475, 9) if text else []
        height = 24 + len(title_lines) * 15 + (12 + len(body_lines) * 12 if body_lines else 0) + 14
        self._ensure_space(height + 8)
        bottom = self.y - height
        self._draw_rect(MARGIN_X, bottom, CONTENT_WIDTH, height, fill=PRIMARY_SOFT, stroke=BORDER)
        self._draw_rect(MARGIN_X, bottom, 4, height, fill=PRIMARY, stroke=PRIMARY)
        y = self.y - 22
        for line in title_lines:
            self._draw_text(line, MARGIN_X + 14, y, size=12, bold=True, color=NAVY)
            y -= 15
        if body_lines:
            y -= 3
            for line in body_lines:
                self._draw_text(line, MARGIN_X + 14, y, size=9, color=INK)
                y -= 12
        self.y = bottom - 14

    def note_box(self, title: str, text: str) -> None:
        lines = self._wrapped_lines(text or "-", 475, 8.8)
        height = 32 + len(lines) * 12
        self._ensure_space(height + 8)
        bottom = self.y - height
        self._draw_rect(MARGIN_X, bottom, CONTENT_WIDTH, height, fill=TINT, stroke=BORDER)
        self._draw_text(title.upper(), MARGIN_X + 12, self.y - 18, size=7.2, bold=True, color=PRIMARY)
        y = self.y - 34
        for line in lines:
            self._draw_text(line, MARGIN_X + 12, y, size=8.8, color=INK)
            y -= 12
        self.y = bottom - 12

    def totals(self, rows: list[tuple[str, str]], *, highlight_last: bool = True) -> None:
        if not rows:
            return
        row_height = 26
        box_width = 240
        x = 553 - box_width
        height = len(rows) * row_height
        self._ensure_space(height + 10)
        bottom = self.y - height

        for index, (label, value) in enumerate(rows):
            row_top = self.y - index * row_height
            row_bottom = row_top - row_height
            is_last = highlight_last and index == len(rows) - 1
            fill = PRIMARY if is_last else (TINT if index % 2 == 0 else WHITE_SOFT)
            stroke = PRIMARY if is_last else BORDER
            text_color = WHITE if is_last else INK
            label_color = WHITE if is_last else MUTED
            self._draw_rect(x, row_bottom, box_width, row_height, fill=fill, stroke=stroke)
            self._draw_text(
                label,
                x + 12,
                row_bottom + 9,
                size=8.5 if not is_last else 9,
                bold=is_last,
                color=label_color,
            )
            self._draw_cell_text(
                value,
                x + box_width - 12,
                row_bottom + 8,
                width=112,
                size=9 if not is_last else 11.5,
                bold=True,
                color=text_color,
                align="right",
            )

        self.y = bottom - 15

    def signature_area(self, labels: list[str]) -> None:
        if not labels:
            return
        self._ensure_space(78)
        width = (CONTENT_WIDTH - 28 * (len(labels) - 1)) / len(labels)
        x = MARGIN_X
        line_y = self.y - 38
        for label in labels:
            self._draw_line(x, line_y, x + width, line_y, color=MUTED)
            self._draw_text(label, x, line_y - 14, size=7.2, color=MUTED)
            x += width + 28
        self.y -= 70

    def _ensure_space(self, height: float) -> None:
        if self.y - height >= CONTENT_BOTTOM:
            return
        self.pages.append([])
        self.y = CONTENT_TOP
        self._draw_header(first_page=False)
