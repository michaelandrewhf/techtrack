import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { quotesApi } from "../api/endpoints";
import type { Quote } from "../api/types";
import { DataTable } from "../components/DataTable";
import { PageHeader } from "../components/PageHeader";
import { Pagination } from "../components/Pagination";
import { ErrorState, PageLoader } from "../components/State";
import { Badge, Button, Input, Panel, Select } from "../components/ui";
import { formatDate, formatMoney } from "../utils/format";

function tone(status: string) {
  if (status === "approved") return "success" as const;
  if (status === "rejected" || status === "cancelled") return "danger" as const;
  if (status === "sent") return "warning" as const;
  return "neutral" as const;
}

function statusLabel(status: string) {
  return (
    {
      draft: "Rascunho",
      sent: "Enviado",
      approved: "Aprovado",
      rejected: "Rejeitado",
      cancelled: "Cancelado",
    }[status] ?? status
  );
}

export function QuotesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const query = useQuery({
    queryKey: ["quotes", { page, search, status }],
    queryFn: () =>
      quotesApi.list({ page, search, status, ordering: "-created_at" }),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Comercial"
        title="Orcamentos"
        description="Visao consolidada das propostas. Criacao e acompanhamento tambem ficam disponiveis dentro do cliente e do equipamento."
        action={
          <Link to="/quotes/new">
            <Button type="button">
              <Plus className="h-4 w-4" />
              Novo orcamento
            </Button>
          </Link>
        }
      />

      <Panel className="mb-5">
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[var(--text-subtle)]" />
            <Input
              className="pl-9"
              placeholder="Buscar cliente, titulo, descricao ou numero"
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
            <option value="draft">Rascunho</option>
            <option value="sent">Enviado</option>
            <option value="approved">Aprovado</option>
            <option value="rejected">Rejeitado</option>
            <option value="cancelled">Cancelado</option>
          </Select>
        </div>
      </Panel>

      {query.isLoading ? <PageLoader label="Carregando orcamentos" /> : null}
      {query.isError ? (
        <ErrorState
          message="Nao foi possivel carregar os orcamentos."
          onRetry={query.refetch}
        />
      ) : null}
      {query.data ? (
        <div className="space-y-4">
          <DataTable<Quote>
            empty="Nenhum orcamento encontrado."
            getRowKey={(row) => row.id}
            rows={query.data.results}
            columns={[
              {
                header: "Orcamento",
                cell: (row) => (
                  <Link
                    className="font-semibold text-[var(--primary)] hover:text-[var(--primary-hover)]"
                    to={`/quotes/${row.id}`}
                  >
                    {row.display_number}
                  </Link>
                ),
              },
              {
                header: "Cliente",
                cell: (row) => (
                  <Link
                    className="text-[var(--text)] hover:text-[var(--primary)]"
                    to={`/customers/${row.customer}?tab=quotes`}
                  >
                    {row.customer_name}
                  </Link>
                ),
              },
              { header: "Titulo", cell: (row) => row.title },
              {
                header: "Equipamento",
                cell: (row) => row.equipment_label || "-",
                hideOnMobile: true,
              },
              {
                header: "Total",
                cell: (row) => (
                  <strong className="text-[var(--text)]">
                    {formatMoney(row.total_amount)}
                  </strong>
                ),
              },
              {
                header: "Validade",
                cell: (row) => formatDate(row.valid_until),
                hideOnMobile: true,
              },
              {
                header: "Status",
                cell: (row) => (
                  <Badge tone={tone(row.status)}>
                    {statusLabel(row.status)}
                  </Badge>
                ),
              },
            ]}
          />
          <Pagination
            page={page}
            count={query.data.count}
            pageSize={25}
            onPageChange={setPage}
          />
        </div>
      ) : null}
    </div>
  );
}
