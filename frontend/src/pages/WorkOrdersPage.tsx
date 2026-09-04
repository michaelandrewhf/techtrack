import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { catalogApi, workOrdersApi } from "../api/endpoints";
import { queryKeys } from "../api/queryKeys";
import type { WorkOrder } from "../api/types";
import { DataTable } from "../components/DataTable";
import { PageHeader } from "../components/PageHeader";
import { Pagination } from "../components/Pagination";
import { ErrorState, PageLoader } from "../components/State";
import { Badge, Button, Input, Select } from "../components/ui";
import { formatDateTime } from "../utils/format";

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
        action={
          <Link to="/work-orders/new">
            <Button type="button">
              <Plus className="h-4 w-4" />
              Abrir OS
            </Button>
          </Link>
        }
        title="Ordens de Servico"
        description="Acompanhamento das OSs e seus estados atuais."
      />
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <Input
          placeholder="Buscar OS, cliente, equipamento ou problema"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">Todos os status</option>
          {(statuses.data?.results ?? []).map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
        <Select
          value={priority}
          onChange={(event) => setPriority(event.target.value)}
        >
          <option value="">Todas as prioridades</option>
          <option value="low">Baixa</option>
          <option value="normal">Normal</option>
          <option value="high">Alta</option>
          <option value="urgent">Urgente</option>
        </Select>
      </div>
      {query.isLoading ? <PageLoader /> : null}
      {query.error ? (
        <ErrorState
          message="Nao foi possivel carregar OSs."
          onRetry={query.refetch}
        />
      ) : null}
      {query.data ? (
        <div className="space-y-4">
          <DataTable<WorkOrder>
            empty="Nenhuma OS cadastrada."
            rows={query.data.results}
            columns={[
              {
                header: "OS",
                cell: (row) => (
                  <Link
                    className="font-medium text-blue-700 dark:text-blue-300"
                    to={`/work-orders/${row.id}`}
                  >
                    {row.display_number}
                  </Link>
                ),
              },
              { header: "Cliente", cell: (row) => row.customer.name },
              {
                header: "Equipamento",
                cell: (row) =>
                  [row.equipment.manufacturer, row.equipment.model]
                    .filter(Boolean)
                    .join(" ") || row.equipment.equipment_type.name,
              },
              { header: "Titulo", cell: (row) => row.title },
              {
                header: "Status",
                cell: (row) => <Badge>{row.status.name}</Badge>,
              },
              { header: "Prioridade", cell: (row) => row.priority },
              {
                header: "Abertura",
                cell: (row) => formatDateTime(row.opened_at),
              },
            ]}
          />
          <Pagination
            count={query.data.count}
            page={page}
            onPageChange={setPage}
          />
        </div>
      ) : null}
    </div>
  );
}
