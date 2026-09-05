import type { Receivable } from "../../api/types";

export function receivableTone(receivable: Receivable) {
  if (receivable.is_overdue) return "danger" as const;
  if (receivable.status === "paid") return "success" as const;
  if (receivable.status === "partial") return "warning" as const;
  return "neutral" as const;
}

export function agreementTone(status: string) {
  if (status === "active") return "success" as const;
  if (status === "paused") return "warning" as const;
  return "neutral" as const;
}
