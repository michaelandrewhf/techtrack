import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ClipboardList,
  FileText,
  Monitor,
  Plus,
  ReceiptText,
  Users,
  WalletCards,
} from "lucide-react";
import { Link } from "react-router-dom";

import { dashboardApi, financeApi } from "../api/endpoints";
import { queryKeys } from "../api/queryKeys";
import { PageHeader } from "../components/PageHeader";
import { ErrorState, PageLoader } from "../components/State";
import { Badge, Button, MetricCard, Panel } from "../components/ui";
import { formatDate, formatDateTime, formatMoney } from "../utils/format";

export function DashboardPage() {
  const query = useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: dashboardApi.get,
  });
  const finance = useQuery({
    queryKey: ["finance", "dashboard"],
    queryFn: financeApi.dashboard,
  });

  if (query.isLoading) return <PageLoader />;
  if (query.error || !query.data)
    return (
      <ErrorState
        message="Nao foi possivel carregar a central de trabalho."
        onRetry={query.refetch}
      />
    );

  const data = query.data;
  const overdueTotal = Number(finance.data?.overdue_total ?? 0);
  const attentionCount =
    data.awaiting_customer.length +
    data.maintenance.overdue +
    (overdueTotal > 0 ? 1 : 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Central de trabalho"
        title="Inicio"
        description="Priorize o que precisa de acao agora e use os indicadores como contexto, nao como destino final."
        action={
          <div className="flex flex-wrap gap-2">
            <Link to="/work-orders/new">
              <Button type="button">
                <Plus className="h-4 w-4" />
                Nova OS
              </Button>
            </Link>
            <Link to="/quotes/new">
              <Button type="button" variant="secondary">
                <FileText className="h-4 w-4" />
                Orcamento
              </Button>
            </Link>
            <Link to="/customers?new=1">
              <Button type="button" variant="secondary">
                <Users className="h-4 w-4" />
                Cliente
              </Button>
            </Link>
          </div>
        }
      />

      {attentionCount > 0 ? (
        <Panel
          title="Precisa de atencao"
          subtitle="Pendencias que podem exigir uma decisao ou contato."
        >
          <div className="grid gap-3 lg:grid-cols-3">
            <Link
              className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--warning-soft)] p-4 transition-colors hover:border-[var(--border-strong)]"
              to="/work-orders"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-[var(--warning)]">
                    Aguardando cliente
                  </div>
                  <div className="mt-1 text-2xl font-semibold text-[var(--text)]">
                    {data.awaiting_customer.length}
                  </div>
                </div>
                <ClipboardList className="h-5 w-5 text-[var(--warning)]" />
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                OSs que dependem de retorno para continuar.
              </p>
            </Link>
            <Link
              className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--danger-soft)] p-4 transition-colors hover:border-[var(--border-strong)]"
              to="/equipment"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-[var(--danger)]">
                    Preventivas vencidas
                  </div>
                  <div className="mt-1 text-2xl font-semibold text-[var(--text)]">
                    {data.maintenance.overdue}
                  </div>
                </div>
                <AlertTriangle className="h-5 w-5 text-[var(--danger)]" />
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Equipamentos com manutencao recomendada em atraso.
              </p>
            </Link>
            <Link
              className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--danger-soft)] p-4 transition-colors hover:border-[var(--border-strong)]"
              to="/finance"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-[var(--danger)]">
                    Recebimentos em atraso
                  </div>
                  <div className="mt-1 text-2xl font-semibold text-[var(--text)]">
                    {formatMoney(finance.data?.overdue_total ?? "0")}
                  </div>
                </div>
                <ReceiptText className="h-5 w-5 text-[var(--danger)]" />
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Saldo vencido consolidado no financeiro.
              </p>
            </Link>
          </div>
        </Panel>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard
          icon={<Users className="h-5 w-5" />}
          label="Clientes ativos"
          value={data.customers.active}
        />
        <MetricCard
          icon={<Monitor className="h-5 w-5" />}
          label="Equipamentos ativos"
          value={data.equipment.active}
        />
        <MetricCard
          icon={<ClipboardList className="h-5 w-5" />}
          label="OS abertas"
          value={data.work_orders.open}
          tone="info"
        />
        <MetricCard
          icon={<ClipboardList className="h-5 w-5" />}
          label="Em andamento"
          value={data.work_orders.in_progress}
          tone="warning"
        />
        <MetricCard
          icon={<WalletCards className="h-5 w-5" />}
          label="A receber"
          value={formatMoney(finance.data?.pending_total ?? "0")}
          tone="warning"
        />
        <MetricCard
          icon={<WalletCards className="h-5 w-5" />}
          label="Recebido no mes"
          value={formatMoney(finance.data?.received_this_month ?? "0")}
          tone="success"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <Panel
          title="OS recentes"
          subtitle="Ultimos atendimentos movimentados no sistema."
        >
          <div className="space-y-2">
            {data.recent_work_orders.map((workOrder) => (
              <Link
                className="block rounded-[var(--radius-lg)] border border-[var(--border)] p-3.5 transition-colors hover:bg-[var(--surface-subtle)]"
                key={workOrder.id}
                to={`/work-orders/${workOrder.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-[var(--text)]">
                      {workOrder.display_number}
                    </div>
                    <div className="mt-0.5 truncate text-sm text-[var(--text-muted)]">
                      {workOrder.title}
                    </div>
                    <div className="mt-1 text-xs text-[var(--text-subtle)]">
                      {formatDateTime(workOrder.opened_at)}
                    </div>
                  </div>
                  <Badge>{workOrder.status?.name ?? "-"}</Badge>
                </div>
              </Link>
            ))}
            {!data.recent_work_orders.length ? (
              <p className="text-sm text-[var(--text-muted)]">
                Nenhuma OS recente.
              </p>
            ) : null}
          </div>
        </Panel>

        <Panel
          title="Proximos recebimentos"
          subtitle="Contas abertas com vencimento futuro mais proximo."
        >
          <div className="space-y-2">
            {(finance.data?.upcoming ?? []).slice(0, 6).map((receivable) => (
              <Link
                className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] p-3 transition-colors hover:bg-[var(--surface-subtle)]"
                key={receivable.id}
                to={`/customers/${receivable.customer}?tab=finance`}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-[var(--text)]">
                    {receivable.customer_name}
                  </div>
                  <div className="mt-1 text-xs text-[var(--text-muted)]">
                    Vence {formatDate(receivable.due_date)}
                  </div>
                </div>
                <strong className="text-sm text-[var(--text)]">
                  {formatMoney(receivable.balance)}
                </strong>
              </Link>
            ))}
            {!finance.data?.upcoming?.length ? (
              <p className="text-sm text-[var(--text-muted)]">
                Nenhum recebimento futuro em aberto.
              </p>
            ) : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}
