import { Plus } from "lucide-react";
import { Link } from "react-router-dom";

import type { Payment, Receivable, ServiceAgreement } from "../../api/types";
import { DataTable } from "../../components/DataTable";
import { Pagination } from "../../components/Pagination";
import { ErrorState, PageLoader } from "../../components/State";
import { Badge, Button, Panel } from "../../components/ui";
import { formatDate, formatDateTime, formatMoney } from "../../utils/format";
import { agreementTone, receivableTone } from "./presentation";
import type { FinanceTabId } from "./types";
import type { FinanceWorkspace } from "./useFinanceWorkspace";

export function FinanceTabs({
  activeTab,
  workspace,
  page,
  onPageChange,
  onOpenAgreement,
  onOpenPayment,
}: {
  activeTab: FinanceTabId;
  workspace: FinanceWorkspace;
  page: number;
  onPageChange: (page: number) => void;
  onOpenAgreement: () => void;
  onOpenPayment: () => void;
}) {
  if (activeTab === "receivables") {
    if (workspace.receivables.isLoading)
      return <PageLoader label="Carregando contas a receber" />;
    if (workspace.receivables.error)
      return (
        <ErrorState
          message="Nao foi possivel carregar as contas a receber."
          onRetry={workspace.receivables.refetch}
        />
      );

    return (
      <Panel
        title="Contas a receber"
        subtitle="Cobrancas pendentes ou parcialmente pagas de OS, contratos e lancamentos manuais."
        action={
          <Button size="sm" type="button" onClick={onOpenPayment}>
            Registrar pagamento
          </Button>
        }
      >
        <div className="space-y-4">
          <DataTable<Receivable>
            empty="Nenhuma conta em aberto."
            getRowKey={(row) => row.id}
            rows={workspace.openReceivables}
            columns={[
              {
                header: "Cliente",
                cell: (row) => (
                  <Link
                    className="font-medium text-[var(--primary)] hover:underline"
                    to={`/customers/${row.customer}?tab=finance`}
                  >
                    {row.customer_name}
                  </Link>
                ),
              },
              { header: "Descricao", cell: (row) => row.description },
              { header: "Origem", cell: (row) => row.origin },
              {
                header: "Vencimento",
                cell: (row) => formatDate(row.due_date),
              },
              { header: "Valor", cell: (row) => formatMoney(row.amount) },
              {
                header: "Saldo",
                cell: (row) => <strong>{formatMoney(row.balance)}</strong>,
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
          <Pagination
            count={workspace.receivables.data?.count ?? 0}
            page={page}
            onPageChange={onPageChange}
          />
        </div>
      </Panel>
    );
  }

  if (activeTab === "payments") {
    if (workspace.payments.isLoading)
      return <PageLoader label="Carregando recebimentos" />;
    if (workspace.payments.error)
      return (
        <ErrorState
          message="Nao foi possivel carregar os recebimentos."
          onRetry={workspace.payments.refetch}
        />
      );

    return (
      <Panel
        title="Recebimentos"
        subtitle="Historico consolidado de pagamentos registrados."
      >
        <div className="space-y-4">
          <DataTable<Payment>
            empty="Nenhum pagamento registrado."
            getRowKey={(row) => row.id}
            rows={workspace.payments.data?.results ?? []}
            columns={[
              { header: "Data", cell: (row) => formatDateTime(row.paid_at) },
              {
                header: "Valor",
                cell: (row) => <strong>{formatMoney(row.amount)}</strong>,
              },
              { header: "Metodo", cell: (row) => row.payment_method_name },
              { header: "Referencia", cell: (row) => row.reference || "-" },
              {
                header: "Situacao",
                cell: (row) => (
                  <Badge tone={row.voided_at ? "danger" : "success"}>
                    {row.voided_at ? "Invalidado" : "Valido"}
                  </Badge>
                ),
              },
            ]}
          />
          <Pagination
            count={workspace.payments.data?.count ?? 0}
            page={page}
            onPageChange={onPageChange}
          />
        </div>
      </Panel>
    );
  }

  if (activeTab === "agreements") {
    if (workspace.agreements.isLoading)
      return <PageLoader label="Carregando contratos" />;
    if (workspace.agreements.error)
      return (
        <ErrorState
          message="Nao foi possivel carregar os contratos."
          onRetry={workspace.agreements.refetch}
        />
      );

    return (
      <Panel
        title="Contratos / mensalistas"
        subtitle="Historico consolidado de acordos recorrentes."
        action={
          <Button size="sm" type="button" onClick={onOpenAgreement}>
            <Plus className="h-4 w-4" />
            Novo contrato
          </Button>
        }
      >
        <div className="space-y-4">
          <DataTable<ServiceAgreement>
            empty="Nenhum contrato registrado."
            getRowKey={(row) => row.id}
            rows={workspace.agreements.data?.results ?? []}
            columns={[
              {
                header: "Cliente",
                cell: (row) => (
                  <Link
                    className="font-medium text-[var(--primary)] hover:underline"
                    to={`/customers/${row.customer}?tab=finance`}
                  >
                    {row.customer_name}
                  </Link>
                ),
              },
              { header: "Contrato", cell: (row) => row.name },
              { header: "Valor", cell: (row) => formatMoney(row.amount) },
              {
                header: "Vencimento",
                cell: (row) => `Dia ${row.billing_day}`,
              },
              { header: "Inicio", cell: (row) => formatDate(row.starts_on) },
              { header: "Fim", cell: (row) => formatDate(row.ends_on) },
              {
                header: "Status",
                cell: (row) => (
                  <Badge tone={agreementTone(row.status)}>{row.status}</Badge>
                ),
              },
            ]}
          />
          <Pagination
            count={workspace.agreements.data?.count ?? 0}
            page={page}
            onPageChange={onPageChange}
          />
        </div>
      </Panel>
    );
  }

  return null;
}
