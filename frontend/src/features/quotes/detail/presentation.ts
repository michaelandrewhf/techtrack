export function quoteStatusTone(status: string) {
  if (status === "approved") return "success" as const;
  if (status === "rejected" || status === "cancelled") return "danger" as const;
  if (status === "sent") return "warning" as const;
  return "neutral" as const;
}

export function quoteStatusLabel(status: string) {
  return (
    {
      draft: "Rascunho",
      sent: "Enviado",
      approved: "Aprovado",
      rejected: "Rejeitado",
      cancelled: "Cancelado",
    }[status] ?? status
  );
}
