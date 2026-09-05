import { z } from "zod";

import type { Receivable } from "../../api/types";

export const customerSchema = z.object({
  name: z.string().min(1, "Informe o nome."),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email("E-mail invalido.").or(z.literal("")).optional(),
  notes: z.string().optional(),
  status: z.string().min(1),
});

export const equipmentSchema = z.object({
  equipment_type_id: z.string().min(1, "Selecione o tipo."),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serial_number: z.string().optional(),
  asset_tag: z.string().optional(),
  operating_system: z.string().optional(),
  notes: z.string().optional(),
  status: z.string().default("active"),
});

export const agreementSchema = z
  .object({
    name: z.string().min(1, "Informe o nome do contrato."),
    description: z.string().optional(),
    amount: z.string().min(1, "Informe o valor mensal."),
    billing_day: z.string().min(1, "Informe o dia de vencimento."),
    starts_on: z.string().min(1, "Informe a data de inicio."),
    first_billing_mode: z.enum(["receive_now", "next_month"]),
    first_payment_method: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.first_billing_mode === "receive_now" &&
      !data.first_payment_method
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["first_payment_method"],
        message: "Selecione o metodo de pagamento.",
      });
    }
  });

export type CustomerForm = z.input<typeof customerSchema>;
export type EquipmentForm = z.input<typeof equipmentSchema>;
export type AgreementForm = z.input<typeof agreementSchema>;
export type CustomerModal =
  "edit" | "equipment" | "agreement" | "payment" | null;

export const customerTabs = [
  { id: "overview", label: "Visao geral" },
  { id: "equipment", label: "Equipamentos" },
  { id: "work-orders", label: "Ordens de servico" },
  { id: "quotes", label: "Orcamentos" },
  { id: "finance", label: "Financeiro" },
] as const;

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
