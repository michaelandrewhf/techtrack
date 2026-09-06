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
        height = 46
        after_gap = 16
        self._ensure_space(height + after_gap)
        bottom = self.y - height
        self._draw_rect(MARGIN_X, bottom, CONTENT_WIDTH, height, fill=TINT, stroke=BORDER)
        self._draw_rect(MARGIN_X, bottom, 3, height, fill=PRIMARY, stroke=PRIMARY)

        count = len(items)
        width = CONTENT_WIDTH / count
        for index, (label, value) in enumerate(items):
            x = MARGIN_X + index * width + 12
            self._draw_text(label.upper(), x, self.y - 15, size=6.8, bold=True, color=MUTED)
            value_lines = self._wrapped_lines(value or "-", width - 24, 9.2)[:2]
            value_y = self.y - 32
            for line in value_lines:
                self._draw_text(line, x, value_y, size=9.2, bold=True, color=INK)
                value_y -= 10
            if index:
                divider_x = MARGIN_X + index * width
                self._draw_line(divider_x, bottom + 10, divider_x, self.y - 10, color=BORDER)
        self.y = bottom - after_gap

    def section_title(self, title: str, *, keep_with: float = 0) -> None:
        height = 36
        self._ensure_space(height + max(0, keep_with))
        self._draw_rect(MARGIN_X, self.y - 18, 3, 18, fill=PRIMARY, stroke=PRIMARY)
        self._draw_text(title.upper(), MARGIN_X + 11, self.y - 14, size=8.5, bold=True, color=INK)
        self._draw_line(MARGIN_X, self.y - 25, 553, self.y - 25, color=BORDER)
        self.y -= height

    def info_box(self, fields: list[tuple[str, str]], *, columns: int = 2) -> None:
        if not fields:
            return
        columns = max(1, min(columns, 4))
        rows = (len(fields) + columns - 1) // columns
        row_height = 44
        height = rows * row_height + 12
        after_gap = 14
        self._ensure_space(height + after_gap)
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

        self.y = bottom - after_gap

    def paired_cards(
        self,
        *,
        left_title: str,
        left_fields: list[tuple[str, str]],
        right_title: str,
        right_fields: list[tuple[str, str]],
    ) -> None:
        height = 124
        after_gap = 16
        gap = 12
        card_width = (CONTENT_WIDTH - gap) / 2
        self._ensure_space(height + after_gap)
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
        self.y = bottom - after_gap

    def lead_block(self, title: str, text: str = "") -> None:
        body_lines = self._wrapped_lines(text, 475, 9) if text else []
        remaining = body_lines[:]
        continuation = False

        while True:
            display_title = f"{title} · continuação" if continuation else title
            title_lines = self._wrapped_lines(display_title or "-", 475, 12)[:3]
            body_overhead = 12 if remaining else 0
            base_height = 24 + len(title_lines) * 15 + body_overhead + 14
            after_gap = 14

            if remaining:
                max_lines = self._lines_that_fit(
                    base_height=base_height,
                    line_height=12,
                    after_gap=after_gap,
                )
                chunk = remaining[:max_lines]
            else:
                self._ensure_space(base_height + after_gap)
                chunk = []

            height = base_height + len(chunk) * 12
            bottom = self.y - height
            self._draw_rect(MARGIN_X, bottom, CONTENT_WIDTH, height, fill=PRIMARY_SOFT, stroke=BORDER)
            self._draw_rect(MARGIN_X, bottom, 4, height, fill=PRIMARY, stroke=PRIMARY)
            y = self.y - 22
            for line in title_lines:
                self._draw_text(line, MARGIN_X + 14, y, size=12, bold=True, color=NAVY)
                y -= 15
            if chunk:
                y -= 3
                for line in chunk:
                    self._draw_text(line, MARGIN_X + 14, y, size=9, color=INK)
                    y -= 12
            self.y = bottom - after_gap

            if not remaining:
                return
            remaining = remaining[len(chunk) :]
            if not remaining:
                return
            continuation = True
            self._start_new_page()

    def note_box(self, title: str, text: str) -> None:
        remaining = self._wrapped_lines(text or "-", 475, 8.8)
        continuation = False

        while remaining:
            display_title = f"{title} · continuação" if continuation else title
            base_height = 32
            after_gap = 12
            max_lines = self._lines_that_fit(
                base_height=base_height,
                line_height=12,
                after_gap=after_gap,
            )
            chunk = remaining[:max_lines]
            height = base_height + len(chunk) * 12
            bottom = self.y - height
            self._draw_rect(MARGIN_X, bottom, CONTENT_WIDTH, height, fill=TINT, stroke=BORDER)
            self._draw_text(
                display_title.upper(),
                MARGIN_X + 12,
                self.y - 18,
                size=7.2,
                bold=True,
                color=PRIMARY,
            )
            y = self.y - 34
            for line in chunk:
                self._draw_text(line, MARGIN_X + 12, y, size=8.8, color=INK)
                y -= 12
            self.y = bottom - after_gap
            remaining = remaining[len(chunk) :]
            if remaining:
                continuation = True
                self._start_new_page()

    def table(
        self,
        *,
        headers: list[str],
        rows: list[list[str]],
        widths: list[float],
        aligns: list[str] | None = None,
    ) -> None:
        if not rows:
            self.paragraph("Itens", "Nenhum item registrado.")
            return
        if abs(sum(widths) - CONTENT_WIDTH) > 0.5:
            raise ValueError("PDF table widths must sum to 511 points.")
        aligns = aligns or ["left"] * len(headers)

        def draw_header() -> None:
            self._ensure_space(56)
            self._draw_rect(MARGIN_X, self.y - 26, CONTENT_WIDTH, 26, fill=NAVY, stroke=NAVY)
            x = MARGIN_X
            for index, header in enumerate(headers):
                text_x = x + 7
                if aligns[index] == "right":
                    text_x = x + widths[index] - 7
                self._draw_cell_text(
                    header.upper(),
                    text_x,
                    self.y - 17,
                    width=widths[index] - 14,
                    size=7,
                    bold=True,
                    color=WHITE,
                    align=aligns[index],
                )
                x += widths[index]
            self.y -= 26

        def start_table_page() -> None:
            self._start_new_page()
            draw_header()

        def draw_row_segment(
            *,
            cell_lines: list[list[str]],
            offset: int,
            line_count: int,
            row_index: int,
        ) -> None:
            row_height = max(30, line_count * 12 + 12)
            fill = TINT if row_index % 2 else WHITE_SOFT
            self._draw_rect(
                MARGIN_X,
                self.y - row_height,
                CONTENT_WIDTH,
                row_height,
                fill=fill,
                stroke=BORDER,
            )
            x = MARGIN_X
            for index, lines in enumerate(cell_lines):
                segment = lines[offset : offset + line_count]
                line_y = self.y - 18
                for line in segment:
                    text_x = x + 7 if aligns[index] != "right" else x + widths[index] - 7
                    self._draw_cell_text(
                        line,
                        text_x,
                        line_y,
                        width=widths[index] - 14,
                        size=8.4,
                        align=aligns[index],
                    )
                    line_y -= 12
                x += widths[index]
            self.y -= row_height

        draw_header()
        for row_index, row in enumerate(rows):
            cell_lines = [
                self._wrapped_lines(value, widths[index] - 14, 8.4)
                for index, value in enumerate(row)
            ]
            total_lines = max(len(lines) for lines in cell_lines)
            full_height = max(30, total_lines * 12 + 12)

            if full_height > self.y - CONTENT_BOTTOM:
                start_table_page()

            if full_height <= self.y - CONTENT_BOTTOM:
                draw_row_segment(
                    cell_lines=cell_lines,
                    offset=0,
                    line_count=total_lines,
                    row_index=row_index,
                )
                continue

            offset = 0
            while offset < total_lines:
                available = self.y - CONTENT_BOTTOM
                if available < 30:
                    start_table_page()
                    available = self.y - CONTENT_BOTTOM

                max_lines = max(1, int((available - 12) // 12))
                if max_lines == 1 and available < 30:
                    start_table_page()
                    continue

                line_count = min(total_lines - offset, max_lines)
                row_height = max(30, line_count * 12 + 12)
                while row_height > self.y - CONTENT_BOTTOM and line_count > 1:
                    line_count -= 1
                    row_height = max(30, line_count * 12 + 12)

                if row_height > self.y - CONTENT_BOTTOM:
                    start_table_page()
                    continue

                draw_row_segment(
                    cell_lines=cell_lines,
                    offset=offset,
                    line_count=line_count,
                    row_index=row_index,
                )
                offset += line_count
                if offset < total_lines:
                    start_table_page()

        self.y = max(CONTENT_BOTTOM, self.y - 12)

    def totals(self, rows: list[tuple[str, str]], *, highlight_last: bool = True) -> None:
        if not rows:
            return
        row_height = 26
        box_width = 240
        x = 553 - box_width
        height = len(rows) * row_height
        after_gap = 15
        self._ensure_space(height + after_gap)
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

        self.y = bottom - after_gap

    def signature_area(self, labels: list[str]) -> None:
        if not labels:
            return
        height = 70
        self._ensure_space(height)
        width = (CONTENT_WIDTH - 28 * (len(labels) - 1)) / len(labels)
        x = MARGIN_X
        line_y = self.y - 38
        for label in labels:
            self._draw_line(x, line_y, x + width, line_y, color=MUTED)
            self._draw_text(label, x, line_y - 14, size=7.2, color=MUTED)
            x += width + 28
        self.y -= height

    def _lines_that_fit(
        self,
        *,
        base_height: float,
        line_height: float,
        after_gap: float,
    ) -> int:
        available = self.y - CONTENT_BOTTOM - base_height - after_gap
        lines = int(available // line_height)
        if lines >= 1:
            return lines

        self._start_new_page()
        available = self.y - CONTENT_BOTTOM - base_height - after_gap
        return max(1, int(available // line_height))

    def _start_new_page(self) -> None:
        self.pages.append([])
        self.y = CONTENT_TOP
        self._draw_header(first_page=False)

    def _ensure_space(self, height: float) -> None:
        if self.y - height >= CONTENT_BOTTOM:
            return
        self._start_new_page()
