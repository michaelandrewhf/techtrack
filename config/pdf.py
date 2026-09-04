from __future__ import annotations

from io import BytesIO


def _escape_pdf_text(value: str) -> str:
    return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def render_text_pdf(title: str, lines: list[str]) -> bytes:
    """Render a small client-facing PDF without adding a native/system dependency.

    The renderer intentionally supports text-first documents. It uses Helvetica with
    WinAnsi encoding and paginates automatically. A richer HTML/CSS renderer can
    replace this implementation later without changing the API/document snapshot layer.
    """

    page_width = 595
    page_height = 842
    margin_x = 48
    start_y = 790
    line_height = 16
    lines_per_page = 43

    normalized = [str(line) for line in lines]
    chunks = [normalized[i : i + lines_per_page] for i in range(0, len(normalized), lines_per_page)] or [[]]

    objects: list[bytes] = []

    def add_object(payload: bytes) -> int:
        objects.append(payload)
        return len(objects)

    font_id = add_object(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
    pages_placeholder_id = add_object(b"")
    page_ids: list[int] = []

    for page_index, page_lines in enumerate(chunks, start=1):
        stream_lines = [
            "BT",
            "/F1 16 Tf",
            f"{margin_x} {start_y} Td",
            f"({_escape_pdf_text(title)}) Tj",
            "0 -26 Td",
            "/F1 10 Tf",
        ]
        for line in page_lines:
            safe = _escape_pdf_text(line)
            stream_lines.extend([f"({safe}) Tj", f"0 -{line_height} Td"])
        stream_lines.extend(["0 -10 Td", f"(Pagina {page_index}/{len(chunks)}) Tj", "ET"])
        stream = "\n".join(stream_lines).encode("cp1252", errors="replace")
        content_id = add_object(b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream")
        page_id = add_object(
            (
                f"<< /Type /Page /Parent {pages_placeholder_id} 0 R "
                f"/MediaBox [0 0 {page_width} {page_height}] "
                f"/Resources << /Font << /F1 {font_id} 0 R >> >> "
                f"/Contents {content_id} 0 R >>"
            ).encode("ascii")
        )
        page_ids.append(page_id)

    kids = " ".join(f"{page_id} 0 R" for page_id in page_ids)
    objects[pages_placeholder_id - 1] = f"<< /Type /Pages /Kids [{kids}] /Count {len(page_ids)} >>".encode("ascii")
    catalog_id = add_object(f"<< /Type /Catalog /Pages {pages_placeholder_id} 0 R >>".encode("ascii"))

    buffer = BytesIO()
    buffer.write(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0]
    for index, payload in enumerate(objects, start=1):
        offsets.append(buffer.tell())
        buffer.write(f"{index} 0 obj\n".encode("ascii"))
        buffer.write(payload)
        buffer.write(b"\nendobj\n")

    xref_offset = buffer.tell()
    buffer.write(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    buffer.write(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        buffer.write(f"{offset:010d} 00000 n \n".encode("ascii"))
    buffer.write(
        (f"trailer\n<< /Size {len(objects) + 1} /Root {catalog_id} 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n").encode(
            "ascii"
        )
    )
    return buffer.getvalue()
