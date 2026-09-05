import { Plus } from "lucide-react";
import { Link } from "react-router-dom";

import type { Equipment, WorkOrder } from "../../../api/types";
import { DataTable } from "../../../components/DataTable";
import { Badge, Button, Panel } from "../../../components/ui";
import { formatDateTime } from "../../../utils/format";

export function EquipmentWorkOrders({ equipment }: { equipment: Equipment }) {
  return (
    <Panel
      title="Ordens de servico"
      subtitle="Atendimentos recentes deste equipamento."
      action={
        <Link
          to={`/work-orders/new?customer=${equipment.customer.id}&equipment=${equipment.id}`}
        >
          <Button size="sm" type="button">
            <Plus className="h-4 w-4" />
            Nova OS
          </Button>
        </Link>
      }
    >
      <DataTable<WorkOrder>
        empty="Nenhuma OS para este equipamento."
        getRowKey={(row) => row.id}
        rows={equipment.recent_work_orders ?? []}
        columns={[
          {
            header: "OS",
            cell: (row) => (
              <Link
                className="font-semibold text-[var(--primary)]"
                to={`/work-orders/${row.id}`}
              >
                {row.display_number}
              </Link>
            ),
          },
          { header: "Titulo", cell: (row) => row.title },
          { header: "Status", cell: (row) => <Badge>{row.status.name}</Badge> },
          { header: "Abertura", cell: (row) => formatDateTime(row.opened_at) },
        ]}
      />
    </Panel>
  );
}
