import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { catalogApi, workOrdersApi } from "../api/endpoints";
import { queryKeys } from "../api/queryKeys";
import type { WorkOrder } from "../api/types";
import { DataTable } from "../components/DataTable";
import { PageHeader } from "../components/PageHeader";
import { Pagination } from "../components/Pagination";
import { ErrorState, PageLoader } from "../components/State";
import { Badge, Button, Input, Panel, Select } from "../components/ui";
import { formatDateTime } from "../utils/format";

function priorityTone(priority: string) {
  if (priority === "urgent") return "danger" as const;
  if (priority === "high") return "warning" as const;
  return "neutral" as const;
}

function priorityLabel(priority: string) {
  return {
    low: "Baixa",
    normal: "Normal",
    high: "Alta",
    urgent: "Urgente",
  }[priority] ?? priority;
}

export function WorkOrdersPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [page, setPage] = useState(1);
  const filters = { search, status, priority, page };
  const query = useQuery({
    queryKey: queryKeys.workOrders(filters),
    queryFn: () => workOrdersApi.list(filters),
  });
  const statuses = useQuery({
    queryKey: queryKeys.catalog("work-order-statuses", { is_active: true }),
    queryFn: () => catalogApi("work-order-statuses").list({ is_active: true }),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Operacao"
        action={
          <Link to="/work-orders/new">
            <Button type="button">
              <Plus className="h-4 w-4" />
              Abrir OS
            </Button>
          </Link>
        }
        title="Ordens de servico"
        description="Fila operacional consolidada. Para um cliente ou equipamento especifico, as mesmas acoes ficam disponiveis no contexto correspondente."
      />

      <Panel className="mb-5">
        <div className="grid gap-3 md:grid-cols-[1fr_220px_190px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Buscar OS, cliente, equipamento ou problema"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            aria-label="Filtrar status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos os status</option>
            {(statuses.data?.results ?? []).map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </Select>
          <Select
            aria-label="Filtrar prioridade"
            value={priority}
            onChange={(event) => {
              setPriority(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Todas as prioridades</option>
            <option value="low">Baixa</option>
            <option value="normal">Normal</option>
            <option value="high">Alta</option>
            <option value="urgent">Urgente</option>
          </Select>
        </div>
      </Panel>

      {query.isLoading ? <PageLoader /> : null}
      {query.error ? (
        <ErrorState message="Nao foi possivel carregar OSs." onRetry={query.refetch} />
      ) : null}
      {query.data ? (
        <div className="space-y-4">
          <DataTable<WorkOrder>
            empty="Nenhuma OS encontrada."
            getRowKey={(row) => row.id}
            rows={query.data.results}
            columns={[
              {
                header: "OS",
                cell: (row) => (
                  <Link className="font-semibold text-blue-700 dark:text-blue-300" to={`/work-orders/${row.id}`}>
                    {row.display_number}
                  </Link>
                ),
              },
              {
                header: "Cliente",
                cell: (row) => (
                  <Link className="text-slate-800 hover:text-blue-600 dark:text-slate-100" to={`/customers/${row.customer.id}?tab=work-orders`}>
                    {row.customer.name}
                  </Link>
                ),
              },
              {
                header: "Equipamento",
                cell: (row) => (
                  <Link className="text-slate-700 hover:text-blue-600 dark:text-slate-200" to={`/equipment/${row.equipment.id}`}>
                    {[row.equipment.manufacturer, row.equipment.model].filter(Boolean).join(" ") || row.equipment.equipment_type.name}
                  </Link>
                ),
              },
              { header: "Titulo", cell: (row) => row.title },
              { header: "Status", cell: (row) => <Badge>{row.status.name}</Badge> },
              { header: "Prioridade", cell: (row) => <Badge tone={priorityTone(row.priority)}>{priorityLabel(row.priority)}</Badge> },
              { header: "Abertura", cell: (row) => formatDateTime(row.opened_at), hideOnMobile: true },
            ]}
          />
          <Pagination count={query.data.count} page={page} onPageChange={setPage} />
        </div>
      ) : null}
    </div>
  );
}
