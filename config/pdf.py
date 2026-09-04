from __future__ import annotations

from io import BytesIO
from textwrap import wrap

PAGE_WIDTH = 595
PAGE_HEIGHT = 842
MARGIN_X = 42
CONTENT_TOP = 794
CONTENT_BOTTOM = 62

BLUE = (0.11, 0.35, 0.72)
DARK = (0.10, 0.13, 0.20)
MUTED = (0.39, 0.45, 0.55)
BORDER = (0.86, 0.88, 0.92)
SOFT = (0.96, 0.97, 0.99)
WHITE = (1.0, 1.0, 1.0)


def _escape_pdf_text(value: str) -> str:
    return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _clean(value) -> str:
    if value is None:
        return ""
    return " ".join(str(value).replace("\r", " ").replace("\n", " ").split())


def _rgb(rgb: tuple[float, float, float]) -> str:
    return " ".join(f"{value:.3f}" for value in rgb)


class PdfDocument:
    """Small dependency-free PDF layout engine for TechTrack client documents."""

    def __init__(
        self,
        *,
        brand: str,
        document_label: str,
        document_number: str,
        footer_left: str = "",
        revision: str = "",
    ):
        self.brand = brand or "TechTrack"
        self.document_label = document_label
        self.document_number = document_number
        self.footer_left = footer_left
        self.revision = revision
        self.pages: list[list[str]] = [[]]
        self.y = CONTENT_TOP
        self._draw_header(first_page=True)

    @property
    def commands(self) -> list[str]:
        return self.pages[-1]

    def _append(self, command: str) -> None:
        self.commands.append(command)

    def _draw_text(
        self,
        text: str,
        x: float,
        y: float,
        *,
        size: float = 10,
        bold: bool = False,
        color: tuple[float, float, float] = DARK,
    ) -> None:
        safe = _escape_pdf_text(_clean(text))
        font = "F2" if bold else "F1"
        self._append(
            f"BT /{font} {size:.1f} Tf {_rgb(color)} rg {x:.1f} {y:.1f} Td ({safe}) Tj ET"
        )

    def _draw_rect(
        self,
        x: float,
        y: float,
        width: float,
        height: float,
        *,
        fill: tuple[float, float, float] | None = None,
        stroke: tuple[float, float, float] | None = BORDER,
    ) -> None:
        commands = ["q"]
        if fill is not None:
            commands.append(f"{_rgb(fill)} rg")
        if stroke is not None:
            commands.append(f"{_rgb(stroke)} RG 0.7 w")
        paint = "B" if fill is not None and stroke is not None else "f" if fill is not None else "S"
        commands.append(f"{x:.1f} {y:.1f} {width:.1f} {height:.1f} re {paint}")
        commands.append("Q")
        self._append(" ".join(commands))

    def _draw_line(
        self,
        x1: float,
        y1: float,
        x2: float,
        y2: float,
        *,
        color: tuple[float, float, float] = BORDER,
        width: float = 0.7,
    ) -> None:
        self._append(
            f"q {_rgb(color)} RG {width:.1f} w {x1:.1f} {y1:.1f} m {x2:.1f} {y2:.1f} l S Q"
        )

    def _wrapped_lines(self, text: str, width: float, size: float) -> list[str]:
        cleaned = _clean(text)
        if not cleaned:
            return ["-"]
        max_chars = max(8, int(width / max(size * 0.52, 1)))
        return wrap(cleaned, width=max_chars, break_long_words=True, break_on_hyphens=False) or ["-"]

    def _ensure_space(self, height: float) -> None:
        if self.y - height >= CONTENT_BOTTOM:
            return
        self.pages.append([])
        self.y = CONTENT_TOP
        self._draw_header(first_page=False)

    def _draw_header(self, *, first_page: bool) -> None:
        if first_page:
            self._draw_rect(MARGIN_X, 754, 511, 58, fill=DARK, stroke=DARK)
            self._draw_text(self.brand, MARGIN_X + 16, 788, size=17, bold=True, color=WHITE)
            self._draw_text(
                self.document_label.upper(),
                MARGIN_X + 16,
                769,
                size=8.5,
                bold=True,
                color=(0.75, 0.82, 0.92),
            )
            self._draw_text(
                self.document_number,
                553,
                781,
                size=15,
                bold=True,
                color=WHITE,
            )
            self.y = 736
        else:
            self._draw_text(self.brand, MARGIN_X, 807, size=11, bold=True, color=BLUE)
            self._draw_text(
                f"{self.document_label} · {self.document_number}",
                553,
                807,
                size=8.5,
                color=MUTED,
            )
            self._draw_line(MARGIN_X, 798, 553, 798)
            self.y = 780

    def metadata_row(self, items: list[tuple[str, str]]) -> None:
        if not items:
            return
        self._ensure_space(42)
        count = len(items)
        gap = 10
        width = (511 - gap * (count - 1)) / count
        x = MARGIN_X
        for label, value in items:
            self._draw_text(label.upper(), x, self.y, size=7.5, bold=True, color=MUTED)
            self._draw_text(value or "-", x, self.y - 15, size=9.5, bold=True)
            x += width + gap
        self.y -= 39

    def section_title(self, title: str) -> None:
        self._ensure_space(31)
        self._draw_rect(MARGIN_X, self.y - 22, 511, 24, fill=SOFT, stroke=BORDER)
        self._draw_rect(MARGIN_X, self.y - 22, 4, 24, fill=BLUE, stroke=BLUE)
        self._draw_text(title, MARGIN_X + 12, self.y - 14, size=9, bold=True, color=DARK)
        self.y -= 32

    def info_box(self, fields: list[tuple[str, str]], *, columns: int = 2) -> None:
        if not fields:
            return
        columns = max(1, min(columns, 3))
        rows = (len(fields) + columns - 1) // columns
        row_height = 36
        height = rows * row_height + 10
        self._ensure_space(height + 6)
        bottom = self.y - height
        self._draw_rect(MARGIN_X, bottom, 511, height, fill=WHITE, stroke=BORDER)
        column_width = 511 / columns
        for index, (label, value) in enumerate(fields):
            row = index // columns
            column = index % columns
            x = MARGIN_X + column * column_width + 10
            y = self.y - 18 - row * row_height
            self._draw_text(label.upper(), x, y, size=7, bold=True, color=MUTED)
            value_width = column_width - 20
            lines = self._wrapped_lines(value or "-", value_width, 9)
            self._draw_text(lines[0], x, y - 13, size=9, bold=False)
        self.y = bottom - 12

    def paragraph(self, title: str, text: str) -> None:
        lines = self._wrapped_lines(text or "-", 487, 9.2)
        height = 33 + len(lines) * 13
        self._ensure_space(height)
        self._draw_text(title.upper(), MARGIN_X, self.y, size=7.5, bold=True, color=MUTED)
        y = self.y - 17
        for line in lines:
            self._draw_text(line, MARGIN_X, y, size=9.2)
            y -= 13
        self.y = y - 7

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
        if abs(sum(widths) - 511) > 0.5:
            raise ValueError("PDF table widths must sum to 511 points.")
        aligns = aligns or ["left"] * len(headers)

        def draw_header() -> None:
            self._ensure_space(30)
            self._draw_rect(MARGIN_X, self.y - 26, 511, 26, fill=DARK, stroke=DARK)
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

        draw_header()
        for row_index, row in enumerate(rows):
            cell_lines = [
                self._wrapped_lines(value, widths[index] - 14, 8.4)
                for index, value in enumerate(row)
            ]
            row_height = max(30, max(len(lines) for lines in cell_lines) * 12 + 12)
            if self.y - row_height < CONTENT_BOTTOM:
                self.pages.append([])
                self.y = CONTENT_TOP
                self._draw_header(first_page=False)
                draw_header()
            fill = SOFT if row_index % 2 else WHITE
            self._draw_rect(MARGIN_X, self.y - row_height, 511, row_height, fill=fill, stroke=BORDER)
            x = MARGIN_X
            for index, lines in enumerate(cell_lines):
                line_y = self.y - 18
                for line in lines:
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
        self.y -= 12

    def _draw_cell_text(
        self,
        text: str,
        x: float,
        y: float,
        *,
        width: float,
        size: float,
        bold: bool = False,
        color: tuple[float, float, float] = DARK,
        align: str = "left",
    ) -> None:
        if align == "right":
            estimated = min(width, len(_clean(text)) * size * 0.48)
            x -= estimated
        self._draw_text(text, x, y, size=size, bold=bold, color=color)

    def totals(self, rows: list[tuple[str, str]], *, highlight_last: bool = True) -> None:
        if not rows:
            return
        line_height = 24
        height = len(rows) * line_height + 12
        box_width = 230
        x = 553 - box_width
        self._ensure_space(height + 8)
        bottom = self.y - height
        self._draw_rect(x, bottom, box_width, height, fill=SOFT, stroke=BORDER)
        y = self.y - 20
        for index, (label, value) in enumerate(rows):
            is_last = highlight_last and index == len(rows) - 1
            if is_last:
                self._draw_line(x + 10, y + 8, x + box_width - 10, y + 8, color=BORDER)
            self._draw_text(label, x + 12, y, size=8.5 if not is_last else 9.5, bold=is_last, color=MUTED if not is_last else DARK)
            self._draw_cell_text(
                value,
                x + box_width - 12,
                y,
                width=110,
                size=9 if not is_last else 12,
                bold=True,
                align="right",
                color=BLUE if is_last else DARK,
            )
            y -= line_height
        self.y = bottom - 14

    def note_box(self, title: str, text: str) -> None:
        lines = self._wrapped_lines(text or "-", 475, 8.8)
        height = 32 + len(lines) * 12
        self._ensure_space(height + 8)
        bottom = self.y - height
        self._draw_rect(MARGIN_X, bottom, 511, height, fill=SOFT, stroke=BORDER)
        self._draw_text(title.upper(), MARGIN_X + 12, self.y - 18, size=7.5, bold=True, color=BLUE)
        y = self.y - 34
        for line in lines:
            self._draw_text(line, MARGIN_X + 12, y, size=8.8)
            y -= 12
        self.y = bottom - 12

    def build(self) -> bytes:
        page_count = len(self.pages)
        for index, commands in enumerate(self.pages, start=1):
            commands.append(f"q {_rgb(BORDER)} RG 0.6 w {MARGIN_X} 48 m 553 48 l S Q")
            if self.footer_left:
                commands.append(
                    self._text_command(self.footer_left, MARGIN_X, 31, size=7, color=MUTED)
                )
            center_text = "Documento comercial · Nao constitui nota fiscal"
            commands.append(self._text_command(center_text, 297, 31, size=6.8, color=MUTED, center=True))
            revision = f" · {self.revision}" if self.revision else ""
            page_text = f"Pagina {index}/{page_count}{revision}"
            commands.append(self._text_command(page_text, 553, 31, size=7, color=MUTED, right=True))

        objects: list[bytes] = []

        def add_object(payload: bytes) -> int:
            objects.append(payload)
            return len(objects)

        font_regular = add_object(
            b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
        )
        font_bold = add_object(
            b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"
        )
        pages_id = add_object(b"")
        page_ids: list[int] = []

        for commands in self.pages:
            stream = "\n".join(commands).encode("cp1252", errors="replace")
            content_id = add_object(
                b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream"
            )
            page_id = add_object(
                (
                    f"<< /Type /Page /Parent {pages_id} 0 R "
                    f"/MediaBox [0 0 {PAGE_WIDTH} {PAGE_HEIGHT}] "
                    f"/Resources << /Font << /F1 {font_regular} 0 R /F2 {font_bold} 0 R >> >> "
                    f"/Contents {content_id} 0 R >>"
                ).encode("ascii")
            )
            page_ids.append(page_id)

        kids = " ".join(f"{page_id} 0 R" for page_id in page_ids)
        objects[pages_id - 1] = (
            f"<< /Type /Pages /Kids [{kids}] /Count {len(page_ids)} >>"
        ).encode("ascii")
        catalog_id = add_object(f"<< /Type /Catalog /Pages {pages_id} 0 R >>".encode("ascii"))

        buffer = BytesIO()
        buffer.write(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
        offsets = [0]
        for object_index, payload in enumerate(objects, start=1):
            offsets.append(buffer.tell())
            buffer.write(f"{object_index} 0 obj\n".encode("ascii"))
            buffer.write(payload)
            buffer.write(b"\nendobj\n")

        xref_offset = buffer.tell()
        buffer.write(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
        buffer.write(b"0000000000 65535 f \n")
        for offset in offsets[1:]:
            buffer.write(f"{offset:010d} 00000 n \n".encode("ascii"))
        buffer.write(
            (
                f"trailer\n<< /Size {len(objects) + 1} /Root {catalog_id} 0 R >>\n"
                f"startxref\n{xref_offset}\n%%EOF\n"
            ).encode("ascii")
        )
        return buffer.getvalue()

    def _text_command(
        self,
        text: str,
        x: float,
        y: float,
        *,
        size: float,
        color: tuple[float, float, float],
        center: bool = False,
        right: bool = False,
    ) -> str:
        cleaned = _clean(text)
        estimated = len(cleaned) * size * 0.48
        if center:
            x -= estimated / 2
        elif right:
            x -= estimated
        safe = _escape_pdf_text(cleaned)
        return f"BT /F1 {size:.1f} Tf {_rgb(color)} rg {x:.1f} {y:.1f} Td ({safe}) Tj ET"


def render_text_pdf(title: str, lines: list[str]) -> bytes:
    """Backward-compatible text renderer built on the structured document engine."""
    document = PdfDocument(
        brand="TechTrack",
        document_label="Documento",
        document_number=title,
    )
    for line in lines:
        document.paragraph("", line)
    return document.build()
