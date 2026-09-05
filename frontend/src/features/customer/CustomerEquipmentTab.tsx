import { Plus } from "lucide-react";
import { Link } from "react-router-dom";

import type { Equipment } from "../../api/types";
import { DataTable } from "../../components/DataTable";
import { Badge, Button, Panel } from "../../components/ui";

export function CustomerEquipmentTab({
  customerId,
  rows,
  onAdd,
}: {
  customerId: string;
  rows: Equipment[];
  onAdd: () => void;
}) {
  return (
    <Panel
      title="Equipamentos"
      subtitle="Patrimonio tecnico vinculado ao cliente."
      action={
        <Button size="sm" type="button" onClick={onAdd}>
          <Plus className="h-4 w-4" />
          Adicionar
        </Button>
      }
    >
      <DataTable<Equipment>
        empty="Nenhum equipamento vinculado."
        getRowKey={(row) => row.id}
        rows={rows}
        columns={[
          { header: "Tipo", cell: (row) => row.equipment_type.name },
          {
            header: "Equipamento",
            cell: (row) => (
              <Link
                className="font-medium text-[var(--tt-brand)] hover:text-[var(--tt-brand-hover)]"
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
    </Panel>
  );
}
