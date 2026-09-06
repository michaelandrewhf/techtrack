import { CircleDollarSign, Plus } from "lucide-react";
import { Link } from "react-router-dom";

import type {
  Equipment,
  Quote,
  Receivable,
  ServiceAgreement,
  WorkOrder,
} from "../../../api/types";
import { DataTable } from "../../../components/DataTable";
import { Pagination } from "../../../components/Pagination";
import { ErrorState, PageLoader } from "../../../components/State";
import { Badge, Button, MetricCard, Panel } from "../../../components/ui";
import { formatDate, formatDateTime, formatMoney } from "../../../utils/format";
import {
  agreementStatusLabel,
  quoteTone,
  receivableTone,
} from "./presentation";
import type { CustomerTabId } from "./types";
import type {
  CustomerWorkspace,
  CustomerWorkspacePages,
} from "./useCustomerWorkspace";

export function CustomerTabs({
  activeTab,
  customerId,
  workspace,
  pages,
  onResourcePageChange,
  onReceivablesPageChange,
  onAgreementsPageChange,
  onAddEquipment,
  onCreateAgreement,
  onOpenPayment,
}: {
  activeTab: CustomerTabId;
  customerId: string;
  workspace: CustomerWorkspace;
  pages: CustomerWorkspacePages;
  onResourcePageChange: (page: number) => void;
  onReceivablesPageChange: (page: number) => void;
  onAgreementsPageChange: (page: number) => void;
  onAddEquipment: () => void;
  onCreateAgreement: () => void;
  onOpenPayment: () => void;
}) {
  if (activeTab === "equipment") {
    if (workspace.equipment.isLoading)
      return <PageLoader label="Carregando equipamentos" />;
    if (workspace.equipment.error)
      return (
        <ErrorState
          message="Nao foi possivel carregar os equipamentos."
          onRetry={workspace.equipment.refetch}
        />
      );

    return (
      <Panel
        title="Equipamentos"
        subtitle="Patrimonio tecnico vinculado ao cliente."
        action={
          <Button size="sm" type="button" onClick={onAddEquipment}>
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        }
      >
        <div className="space-y-4">
          <DataTable<Equipment>
            empty="Nenhum equipamento vinculado."
            getRowKey={(row) => row.id}
            rows={workspace.equipment.data?.results ?? []}
            columns={[
              { header: "Tipo", cell: (row) => row.equipment_type.name },
              {
                header: "Equipamento",
                cell: (row) => (
                  <Link
                    className="font-medium text-[var(--primary)] hover:underline"
                    to={`/equipment/${row.id}`}
                  >
                    {[row.manufacturer, row.model].filter(Boolean).join(" ") ||
                      row.equipment_type.name}
                  </Link>
                ),
              },
              { header: "Serial", cell: (row) => row.serial_number || "-" },
              { header: "Patrimonio", cell: (row) => row.asset_tag || "-" },
              {
                header: "Status",
                cell: (row) => <Badge>{row.status}</Badge>,
              },
              {
                header: "Acao",
                cell: (row) => (
                  <Link
                    to={`/work-orders/new?customer=${customerId}&equipment=${row.id}`}
                  >
                    <Button size="sm" type="button" variant="secondary">
                      Abrir OS
                    </Button>
                  </Link>
                ),
              },
            ]}
          />
          <Pagination
            count={workspace.equipment.data?.count ?? 0}
            page={pages.resource}
            onPageChange={onResourcePageChange}
          />
        </div>
      </Panel>
    );
  }

  if (activeTab === "work-orders") {
    if (workspace.workOrders.isLoading)
      return <PageLoader label="Carregando ordens de servico" />;
    if (workspace.workOrders.error)
      return (
        <ErrorState
          message="Nao foi possivel carregar as ordens de servico."
          onRetry={workspace.workOrders.refetch}
        />
      );

    return (
      <Panel
        title="Ordens de servico"
        subtitle="Historico de atendimentos e manutencoes do cliente."
        action={
          <Link to={`/work-orders/new?customer=${customerId}`}>
            <Button size="sm" type="button">
              <Plus className="h-4 w-4" />
              Nova OS
            </Button>
          </Link>
        }
      >
        <div className="space-y-4">
          <DataTable<WorkOrder>
            empty="Nenhuma OS para este cliente."
            getRowKey={(row) => row.id}
            rows={workspace.workOrders.data?.results ?? []}
            columns={[
              {
                header: "OS",
                cell: (row) => (
                  <Link
                    className="font-semibold text-[var(--primary)] hover:underline"
                    to={`/work-orders/${row.id}`}
                  >
                    {row.display_number}
                  </Link>
                ),
              },
              { header: "Titulo", cell: (row) => row.title },
              {
                header: "Equipamento",
                cell: (row) =>
                  [row.equipment.manufacturer, row.equipment.model]
                    .filter(Boolean)
                    .join(" ") || row.equipment.equipment_type.name,
              },
              {
                header: "Status",
                cell: (row) => <Badge>{row.status.name}</Badge>,
              },
              {
                header: "Abertura",
                cell: (row) => formatDateTime(row.opened_at),
              },
            ]}
          />
          <Pagination
            count={workspace.workOrders.data?.count ?? 0}
            page={pages.resource}
            onPageChange={onResourcePageChange}
          />
        </div>
      </Panel>
    );
  }

  if (activeTab === "quotes") {
    if (workspace.quotes.isLoading)
      return <PageLoader label="Carregando orcamentos" />;
    if (workspace.quotes.error)
      return (
        <ErrorState
          message="Nao foi possivel carregar os orcamentos."
          onRetry={workspace.quotes.refetch}
        />
      );

    return (
      <Panel
        title="Orcamentos"
        subtitle="Propostas comerciais criadas para este cliente."
        action={
          <Link to={`/quotes/new?customer=${customerId}`}>
            <Button size="sm" type="button">
              <Plus className="h-4 w-4" />
              Novo orcamento
            </Button>
          </Link>
        }
      >
        <div className="space-y-4">
          <DataTable<Quote>
            empty="Nenhum orcamento para este cliente."
            getRowKey={(row) => row.id}
            rows={workspace.quotes.data?.results ?? []}
            columns={[
              {
                header: "Orcamento",
                cell: (row) => (
                  <Link
                    className="font-semibold text-[var(--primary)] hover:underline"
                    to={`/quotes/${row.id}`}
                  >
                    {row.display_number}
                  </Link>
                ),
              },
              { header: "Titulo", cell: (row) => row.title },
              {
                header: "Equipamento",
                cell: (row) => row.equipment_label || "-",
              },
              {
                header: "Total",
                cell: (row) => formatMoney(row.total_amount),
              },
              {
                header: "Status",
                cell: (row) => (
                  <Badge tone={quoteTone(row.status)}>{row.status}</Badge>
                ),
              },
              {
                header: "Validade",
                cell: (row) => formatDate(row.valid_until),
              },
            ]}
          />
          <Pagination
            count={workspace.quotes.data?.count ?? 0}
            page={pages.resource}
            onPageChange={onResourcePageChange}
          />
        </div>
      </Panel>
    );
  }

  if (activeTab === "finance") {
    if (
      workspace.receivables.isLoading ||
      workspace.agreements.isLoading ||
      workspace.financeSummary.isLoading
    )
      return <PageLoader label="Carregando financeiro do cliente" />;
    if (
      workspace.receivables.error ||
      workspace.agreements.error ||
      workspace.financeSummary.error
    )
      return (
        <ErrorState
          message="Nao foi possivel carregar o financeiro do cliente."
          onRetry={() => {
            void workspace.receivables.refetch();
            void workspace.agreements.refetch();
            void workspace.financeSummary.refetch();
          }}
        />
      );

    return (
      <FinanceTab
        activeAgreement={workspace.activeAgreement}
        agreements={workspace.agreements.data?.results ?? []}
        agreementsCount={workspace.agreements.data?.count ?? 0}
        agreementsPage={pages.agreements}
        openReceivables={workspace.openReceivables}
        overdue={workspace.overdue}
        pending={workspace.pending}
        receivablesCount={workspace.receivables.data?.count ?? 0}
        receivablesPage={pages.receivables}
        onAgreementsPageChange={onAgreementsPageChange}
        onCreateAgreement={onCreateAgreement}
        onOpenPayment={onOpenPayment}
        onReceivablesPageChange={onReceivablesPageChange}
      />
    );
  }

  return null;
}

function FinanceTab({
  activeAgreement,
  agreements,
  agreementsCount,
  agreementsPage,
  openReceivables,
  overdue,
  pending,
  receivablesCount,
  receivablesPage,
  onAgreementsPageChange,
  onCreateAgreement,
  onOpenPayment,
  onReceivablesPageChange,
}: {
  activeAgreement?: ServiceAgreement;
  agreements: ServiceAgreement[];
  agreementsCount: number;
  agreementsPage: number;
  openReceivables: Receivable[];
  overdue: number;
  pending: number;
  receivablesCount: number;
  receivablesPage: number;
  onAgreementsPageChange: (page: number) => void;
  onCreateAgreement: () => void;
  onOpenPayment: () => void;
  onReceivablesPageChange: (page: number) => void;
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
          subtitle="Cobrancas em aberto de OS, contratos e lancamentos manuais."
          action={
            receivablesCount ? (
              <Button size="sm" type="button" onClick={onOpenPayment}>
                <CircleDollarSign className="h-4 w-4" />
                Registrar pagamento
              </Button>
            ) : undefined
          }
        >
          <div className="space-y-4">
            <DataTable<Receivable>
              empty="Nenhuma conta em aberto."
              getRowKey={(row) => row.id}
              rows={openReceivables}
              columns={[
                { header: "Descricao", cell: (row) => row.description },
                {
                  header: "Vencimento",
                  cell: (row) => formatDate(row.due_date),
                },
                { header: "Valor", cell: (row) => formatMoney(row.amount) },
                { header: "Saldo", cell: (row) => formatMoney(row.balance) },
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
              count={receivablesCount}
              page={receivablesPage}
              onPageChange={onReceivablesPageChange}
            />
          </div>
        </Panel>

        <Panel
          title="Historico de contratos"
          action={
            !activeAgreement ? (
              <Button size="sm" type="button" onClick={onCreateAgreement}>
                <Plus className="h-4 w-4" />
                Criar contrato
              </Button>
            ) : undefined
          }
        >
          <div className="space-y-4">
            <div className="space-y-3">
              {agreements.map((agreement) => (
                <div
                  className="rounded-[var(--radius-lg)] border border-[var(--border)] p-4"
                  key={agreement.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-[var(--text)]">
                        {agreement.name}
                      </div>
                      <div className="mt-1 text-xs text-[var(--text-muted)]">
                        {formatDate(agreement.starts_on)} →{" "}
                        {agreement.ends_on
                          ? formatDate(agreement.ends_on)
                          : "atual"}
                      </div>
                    </div>
                    <Badge
                      tone={
                        agreement.status === "active" ? "success" : "neutral"
                      }
                    >
                      {agreementStatusLabel(agreement.status)}
                    </Badge>
                  </div>
                  <div className="mt-3 text-sm text-[var(--text)]">
                    {formatMoney(agreement.amount)} · vencimento dia{" "}
                    {agreement.billing_day}
                  </div>
                </div>
              ))}
              {!agreements.length ? (
                <p className="text-sm text-[var(--text-muted)]">
                  Nenhum contrato registrado.
                </p>
              ) : null}
            </div>
            <Pagination
              count={agreementsCount}
              page={agreementsPage}
              onPageChange={onAgreementsPageChange}
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}
