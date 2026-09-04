import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ClipboardList, Monitor, Users } from "lucide-react";
import { Link } from "react-router-dom";

import { dashboardApi } from "../api/endpoints";
import { queryKeys } from "../api/queryKeys";
import { ErrorState, PageLoader } from "../components/State";
import { Badge, Panel } from "../components/ui";
import { formatDateTime } from "../utils/format";

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {label}
        </span>
        <Icon className="h-5 w-5 text-blue-600" />
      </div>
      <div className="mt-3 text-3xl font-semibold text-slate-950 dark:text-white">
        {value}
      </div>
    </div>
  );
}

export function DashboardPage() {
  const query = useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: dashboardApi.get,
  });
  if (query.isLoading) return <PageLoader />;
  if (query.error || !query.data)
    return (
      <ErrorState
        message="Nao foi possivel carregar o dashboard."
        onRetry={query.refetch}
      />
    );

  const data = query.data;
  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-slate-950 dark:text-white">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Indicadores operacionais vindos da API.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric
          icon={Users}
          label="Clientes ativos"
          value={data.customers.active}
        />
        <Metric
          icon={Monitor}
          label="Equipamentos ativos"
          value={data.equipment.active}
        />
        <Metric
          icon={ClipboardList}
          label="OS abertas"
          value={data.work_orders.open}
        />
        <Metric
          icon={ClipboardList}
          label="OS em andamento"
          value={data.work_orders.in_progress}
        />
        <Metric
          icon={AlertTriangle}
          label="Preventivas vencidas"
          value={data.maintenance.overdue}
        />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="OS recentes">
          <div className="space-y-3">
            {data.recent_work_orders.map((workOrder) => (
              <Link
                className="block rounded-md border border-slate-100 p-3 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                key={workOrder.id}
                to={`/work-orders/${workOrder.id}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-slate-950 dark:text-white">
                    {workOrder.display_number}
                  </span>
                  <Badge>{workOrder.status?.name ?? "-"}</Badge>
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  {workOrder.title}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {formatDateTime(workOrder.opened_at)}
                </div>
              </Link>
            ))}
          </div>
        </Panel>
        <Panel title="Aguardando cliente">
          <div className="space-y-3">
            {data.awaiting_customer.length ? (
              data.awaiting_customer.map((workOrder) => (
                <Link
                  className="block rounded-md border border-slate-100 p-3 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                  key={workOrder.id}
                  to={`/work-orders/${workOrder.id}`}
                >
                  <div className="font-medium text-slate-950 dark:text-white">
                    {workOrder.display_number}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    {workOrder.title}
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-sm text-slate-500">
                Nenhuma OS aguardando cliente.
              </p>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
