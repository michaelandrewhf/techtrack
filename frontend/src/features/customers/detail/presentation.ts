import type { Receivable } from "../../../api/types";

export function customerStatusLabel(status: string) {
  return (
    {
      active: "Ativo",
      inactive: "Inativo",
      prospect: "Prospect",
      blocked: "Bloqueado",
    }[status] ?? status
  );
}

export function agreementStatusLabel(status: string) {
  return (
    {
      active: "Ativo",
      paused: "Pausado",
      ended: "Encerrado",
      cancelled: "Cancelado",
    }[status] ?? status
  );
}

export function receivableTone(receivable: Receivable) {
  if (receivable.is_overdue) return "danger" as const;
  if (receivable.status === "paid") return "success" as const;
  if (receivable.status === "partial") return "warning" as const;
  return "neutral" as const;
}

export function quoteTone(status: string) {
  if (status === "approved") return "success" as const;
  if (status === "sent") return "warning" as const;
  if (status === "rejected" || status === "cancelled") return "danger" as const;
  return "neutral" as const;
}
