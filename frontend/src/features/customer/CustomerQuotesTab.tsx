import { Plus } from "lucide-react";
import { Link } from "react-router-dom";

import type { Quote } from "../../api/types";
import { DataTable } from "../../components/DataTable";
import { Badge, Button, Panel } from "../../components/ui";
import { formatDate, formatMoney } from "../../utils/format";
import { quoteTone } from "./detail";

export function CustomerQuotesTab({
  customerId,
  rows,
}: {
  customerId: string;
  rows: Quote[];
}) {
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
      <DataTable<Quote>
        empty="Nenhum orcamento para este cliente."
        getRowKey={(row) => row.id}
        rows={rows}
        columns={[
          {
            header: "Orcamento",
            cell: (row) => (
              <Link
                className="font-semibold text-[var(--tt-brand)] hover:text-[var(--tt-brand-hover)]"
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
    </Panel>
  );
}
