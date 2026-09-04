import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { quotesApi } from "../api/endpoints";
import { PageHeader } from "../components/PageHeader";
import { Pagination } from "../components/Pagination";
import { Badge, Button, Input, Select } from "../components/ui";
import { formatDate, formatMoney } from "../utils/format";

function tone(status: string) {
  if (status === "approved") return "success";
  if (status === "rejected" || status === "cancelled") return "danger";
  if (status === "sent") return "warning";
  return "neutral";
}

export function QuotesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const query = useQuery({
    queryKey: ["quotes", { page, search, status }],
    queryFn: () => quotesApi.list({ page, search, status, ordering: "-created_at" }),
  });

  return (
    <div>
      <PageHeader
        title="Orcamentos"
        description="Propostas comerciais independentes da execucao da ordem de servico."
        action={
          <Link to="/quotes/new">
            <Button type="button"><Plus className="h-4 w-4" />Novo orcamento</Button>
          </Link>
        }
      />

      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_220px]">
        <Input placeholder="Buscar cliente, titulo ou descricao" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        <Select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
          <option value="">Todos os status</option>
          <option value="draft">Rascunho</option>
          <option value="sent">Enviado</option>
          <option value="approved">Aprovado</option>
          <option value="rejected">Rejeitado</option>
          <option value="cancelled">Cancelado</option>
        </Select>
      </div>

      <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {query.isLoading ? <div className="p-5 text-sm text-slate-500">Carregando orcamentos...</div> : null}
        {query.isError ? <div className="p-5 text-sm text-red-600">Nao foi possivel carregar os orcamentos.</div> : null}
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {query.data?.results.map((quote) => (
            <Link key={quote.id} to={`/quotes/${quote.id}`} className="grid gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-800 md:grid-cols-[130px_1.5fr_1fr_140px_120px] md:items-center">
              <div className="font-semibold text-blue-600">{quote.display_number}</div>
              <div>
                <div className="font-medium text-slate-950 dark:text-white">{quote.customer_name}</div>
                <div className="text-sm text-slate-500">{quote.title}</div>
              </div>
              <div className="text-sm text-slate-500">{quote.equipment_label || "Sem equipamento"}</div>
              <div>
                <div className="font-medium">{formatMoney(quote.total_amount)}</div>
                <div className="text-xs text-slate-500">Validade {formatDate(quote.valid_until)}</div>
              </div>
              <Badge tone={tone(quote.status)}>{quote.status}</Badge>
            </Link>
          ))}
          {!query.isLoading && query.data?.results.length === 0 ? <div className="p-6 text-center text-sm text-slate-500">Nenhum orcamento encontrado.</div> : null}
        </div>
      </div>

      {query.data ? <div className="mt-4"><Pagination page={page} count={query.data.count} pageSize={25} onPageChange={setPage} /></div> : null}
    </div>
  );
}
