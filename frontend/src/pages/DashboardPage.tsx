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
    data.awaiting_customer.length + data.maintenance.overdue + (overdueTotal > 0 ? 1 : 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600 dark:text-blue-400">
            Central de trabalho
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
            Inicio
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
            Priorize o que precisa de acao agora e use os indicadores como contexto, nao como destino final.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/work-orders/new"><Button type="button"><Plus className="h-4 w-4" />Nova OS</Button></Link>
          <Link to="/quotes/new"><Button type="button" variant="secondary"><FileText className="h-4 w-4" />Orcamento</Button></Link>
          <Link to="/customers?new=1"><Button type="button" variant="secondary"><Users className="h-4 w-4" />Cliente</Button></Link>
        </div>
      </div>

      {attentionCount > 0 ? (
        <Panel
          title="Precisa de atencao"
          subtitle="Pendencias que podem exigir uma decisao ou contato."
        >
          <div className="grid gap-3 lg:grid-cols-3">
            <Link
              className="rounded-xl border border-amber-200 bg-amber-50 p-4 transition hover:border-amber-300 dark:border-amber-900 dark:bg-amber-950/40"
              to="/work-orders"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-amber-900 dark:text-amber-100">Aguardando cliente</div>
                  <div className="mt-1 text-2xl font-semibold text-amber-900 dark:text-amber-100">{data.awaiting_customer.length}</div>
                </div>
                <ClipboardList className="h-5 w-5 text-amber-700 dark:text-amber-300" />
              </div>
              <p className="mt-2 text-xs text-amber-800/80 dark:text-amber-200/80">OSs que dependem de retorno para continuar.</p>
            </Link>
            <Link
              className="rounded-xl border border-red-200 bg-red-50 p-4 transition hover:border-red-300 dark:border-red-900 dark:bg-red-950/40"
              to="/equipment"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-red-900 dark:text-red-100">Preventivas vencidas</div>
                  <div className="mt-1 text-2xl font-semibold text-red-900 dark:text-red-100">{data.maintenance.overdue}</div>
                </div>
                <AlertTriangle className="h-5 w-5 text-red-700 dark:text-red-300" />
              </div>
              <p className="mt-2 text-xs text-red-800/80 dark:text-red-200/80">Equipamentos com manutencao recomendada em atraso.</p>
            </Link>
            <Link
              className="rounded-xl border border-red-200 bg-red-50 p-4 transition hover:border-red-300 dark:border-red-900 dark:bg-red-950/40"
              to="/finance"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-red-900 dark:text-red-100">Recebimentos em atraso</div>
                  <div className="mt-1 text-2xl font-semibold text-red-900 dark:text-red-100">{formatMoney(finance.data?.overdue_total ?? "0")}</div>
                </div>
                <ReceiptText className="h-5 w-5 text-red-700 dark:text-red-300" />
              </div>
              <p className="mt-2 text-xs text-red-800/80 dark:text-red-200/80">Saldo vencido consolidado no financeiro.</p>
            </Link>
          </div>
        </Panel>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard icon={<Users className="h-5 w-5" />} label="Clientes ativos" value={data.customers.active} />
        <MetricCard icon={<Monitor className="h-5 w-5" />} label="Equipamentos ativos" value={data.equipment.active} />
        <MetricCard icon={<ClipboardList className="h-5 w-5" />} label="OS abertas" value={data.work_orders.open} tone="info" />
        <MetricCard icon={<ClipboardList className="h-5 w-5" />} label="Em andamento" value={data.work_orders.in_progress} tone="warning" />
        <MetricCard icon={<WalletCards className="h-5 w-5" />} label="A receber" value={formatMoney(finance.data?.pending_total ?? "0")} tone="warning" />
        <MetricCard icon={<WalletCards className="h-5 w-5" />} label="Recebido no mes" value={formatMoney(finance.data?.received_this_month ?? "0")} tone="success" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <Panel title="OS recentes" subtitle="Ultimos atendimentos movimentados no sistema.">
          <div className="space-y-2">
            {data.recent_work_orders.map((workOrder) => (
              <Link
                className="block rounded-xl border border-slate-200 p-3.5 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                key={workOrder.id}
                to={`/work-orders/${workOrder.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-950 dark:text-white">{workOrder.display_number}</div>
                    <div className="mt-0.5 truncate text-sm text-slate-600 dark:text-slate-300">{workOrder.title}</div>
                    <div className="mt-1 text-xs text-slate-400">{formatDateTime(workOrder.opened_at)}</div>
                  </div>
                  <Badge>{workOrder.status?.name ?? "-"}</Badge>
                </div>
              </Link>
            ))}
            {!data.recent_work_orders.length ? <p className="text-sm text-slate-500">Nenhuma OS recente.</p> : null}
          </div>
        </Panel>

        <Panel title="Proximos recebimentos" subtitle="Contas abertas com vencimento futuro mais proximo.">
          <div className="space-y-2">
            {(finance.data?.upcoming ?? []).slice(0, 6).map((receivable) => (
              <Link
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                key={receivable.id}
                to={`/customers/${receivable.customer}?tab=finance`}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-900 dark:text-white">{receivable.customer_name}</div>
                  <div className="mt-1 text-xs text-slate-500">Vence {formatDate(receivable.due_date)}</div>
                </div>
                <strong className="text-sm">{formatMoney(receivable.balance)}</strong>
              </Link>
            ))}
            {!finance.data?.upcoming?.length ? <p className="text-sm text-slate-500">Nenhum recebimento futuro em aberto.</p> : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}
