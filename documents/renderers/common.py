from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal


def money(value) -> str:
    amount = Decimal(str(value or 0))
    return f"R$ {amount:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def pt_date(value) -> str:
    if not value:
        return "-"
    if isinstance(value, (date, datetime)):
        parsed = value
    else:
        try:
            parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except ValueError:
            try:
                parsed = date.fromisoformat(str(value))
            except ValueError:
                return str(value)
    return parsed.strftime("%d/%m/%Y")


def business_footer(business: dict) -> str:
    values = [
        business.get("document"),
        business.get("phone") or business.get("whatsapp"),
        business.get("email"),
    ]
    return " | ".join(value for value in values if value)


def quote_status_label(status: str | None) -> str:
    return {
        "draft": "Rascunho",
        "sent": "Enviado",
        "approved": "Aprovado",
        "rejected": "Rejeitado",
        "cancelled": "Cancelado",
    }.get(status, status or "-")


def equipment_model(equipment: dict) -> str:
    return " ".join(value for value in [equipment.get("manufacturer"), equipment.get("model")] if value) or "-"
