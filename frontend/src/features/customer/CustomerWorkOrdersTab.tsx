import { Plus } from "lucide-react";
import { Link } from "react-router-dom";

import type { WorkOrder } from "../../api/types";
import { DataTable } from "../../components/DataTable";
import { Badge, Button, Panel } from "../../components/ui";
import { formatDateTime } from "../../utils/format";

export function CustomerWorkOrdersTab({
  customerId,
  rows,
}: {
  customerId: string;
  rows: WorkOrder[];
}) {
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
      <DataTable<WorkOrder>
        empty="Nenhuma OS para este cliente."
        getRowKey={(row) => row.id}
        rows={rows}
        columns={[
          {
            header: "OS",
            cell: (row) => (
              <Link
                className="font-semibold text-[var(--tt-brand)] hover:text-[var(--tt-brand-hover)]"
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
    </Panel>
  );
}
