import { CircleDollarSign, Plus } from "lucide-react";

import type { Receivable, ServiceAgreement } from "../../api/types";
import { DataTable } from "../../components/DataTable";
import { Badge, Button, MetricCard, Panel } from "../../components/ui";
import { formatDate, formatMoney } from "../../utils/format";
import { agreementStatusLabel, receivableTone } from "./detail";

export function CustomerFinanceTab({
  activeAgreement,
  agreements,
  receivables,
  openReceivables,
  pending,
  overdue,
  onOpenPayment,
  onOpenAgreement,
}: {
  activeAgreement?: ServiceAgreement;
  agreements: ServiceAgreement[];
  receivables: Receivable[];
  openReceivables: Receivable[];
  pending: number;
  overdue: number;
  onOpenPayment: () => void;
  onOpenAgreement: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="Saldo pendente"
          value={formatMoney(pending)}
          tone={pending > 0 ? "warning" : "success"}
        />
        <MetricCard
          label="Em atraso"
          value={formatMoney(overdue)}
          tone={overdue > 0 ? "danger" : "success"}
        />
        <MetricCard
          label="Relacionamento"
          value={activeAgreement ? "Mensalista" : "Avulso"}
          tone={activeAgreement ? "info" : "neutral"}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <Panel
          title="Contas a receber"
          subtitle="Cobrancas avulsas, de OS e mensalidades do cliente."
          action={
            openReceivables.length ? (
              <Button size="sm" type="button" onClick={onOpenPayment}>
                <CircleDollarSign className="h-4 w-4" />
                Registrar pagamento
              </Button>
            ) : undefined
          }
        >
          <DataTable<Receivable>
            empty="Nenhum lancamento financeiro."
            getRowKey={(row) => row.id}
            rows={receivables}
            columns={[
              { header: "Descricao", cell: (row) => row.description },
              {
                header: "Vencimento",
                cell: (row) => formatDate(row.due_date),
              },
              { header: "Valor", cell: (row) => formatMoney(row.amount) },
              {
                header: "Saldo",
                cell: (row) => formatMoney(row.balance),
              },
              {
                header: "Status",
                cell: (row) => (
                  <Badge tone={receivableTone(row)}>
                    {row.is_overdue ? "Vencido" : row.status}
                  </Badge>
                ),
              },
            ]}
          />
        </Panel>

        <Panel
          title="Historico de contratos"
          action={
            !activeAgreement ? (
              <Button size="sm" type="button" onClick={onOpenAgreement}>
                <Plus className="h-4 w-4" />
                Criar contrato
              </Button>
            ) : undefined
          }
        >
          <div className="space-y-3">
            {agreements.map((agreement) => (
              <div
                className="rounded-[var(--tt-radius-md)] border border-[var(--tt-border)] p-4"
                key={agreement.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-[var(--tt-text)]">
                      {agreement.name}
                    </div>
                    <div className="mt-1 text-xs text-[var(--tt-text-muted)]">
                      {formatDate(agreement.starts_on)} →{" "}
                      {agreement.ends_on ? formatDate(agreement.ends_on) : "atual"}
                    </div>
                  </div>
                  <Badge
                    tone={agreement.status === "active" ? "success" : "neutral"}
                  >
                    {agreementStatusLabel(agreement.status)}
                  </Badge>
                </div>
                <div className="mt-3 text-sm text-[var(--tt-text)]">
                  {formatMoney(agreement.amount)} · vencimento dia{" "}
                  {agreement.billing_day}
                </div>
              </div>
            ))}
            {!agreements.length ? (
              <p className="text-sm text-[var(--tt-text-muted)]">
                Nenhum contrato registrado.
              </p>
            ) : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}
