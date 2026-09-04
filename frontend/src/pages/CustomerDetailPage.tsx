import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { customersApi, financeApi } from "../api/endpoints";
import { queryKeys } from "../api/queryKeys";
import type { Equipment, WorkOrder } from "../api/types";
import { DataTable } from "../components/DataTable";
import { PageHeader } from "../components/PageHeader";
import { ErrorState, PageLoader } from "../components/State";
import { Badge, Button, Panel } from "../components/ui";
import { formatDate, formatDateTime, formatMoney } from "../utils/format";

export function CustomerDetailPage() {
  const { id = "" } = useParams();
  const customer = useQuery({
    queryKey: queryKeys.customer(id),
    queryFn: () => customersApi.get(id),
  });
  const equipment = useQuery({
    queryKey: queryKeys.customerEquipment(id),
    queryFn: () => customersApi.equipment(id),
  });
  const workOrders = useQuery({
    queryKey: queryKeys.customerWorkOrders(id),
    queryFn: () => customersApi.workOrders(id),
  });
  const agreements = useQuery({
    queryKey: ["finance", "customer", id, "agreements"],
    queryFn: () =>
      financeApi.agreements({ customer: id, ordering: "-starts_on" }),
  });
  const receivables = useQuery({
    queryKey: ["finance", "customer", id, "receivables"],
    queryFn: () =>
      financeApi.receivables({ customer: id, ordering: "-due_date" }),
  });

  if (customer.isLoading) return <PageLoader />;
  if (customer.error || !customer.data)
    return <ErrorState message="Cliente nao encontrado." />;

  const pending =
    receivables.data?.results.reduce(
      (total, receivable) =>
        receivable.status === "cancelled"
          ? total
          : total + Number(receivable.balance),
      0,
    ) ?? 0;

  return (
    <div>
      <PageHeader
        action={
          <Link to="/work-orders/new">
            <Button type="button">Abrir OS</Button>
          </Link>
        }
        title={customer.data.name}
        description="Visao geral do cliente, equipamentos, financeiro e ordens recentes."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Cadastro">
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-slate-500">Telefone</dt>
              <dd>{customer.data.phone || "-"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">WhatsApp</dt>
              <dd>{customer.data.whatsapp || "-"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">E-mail</dt>
              <dd>{customer.data.email || "-"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd>
                <Badge>{customer.data.status}</Badge>
              </dd>
            </div>
          </dl>
        </Panel>
        <Panel title="Financeiro">
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-slate-500">Saldo pendente</div>
              <div className="text-xl font-semibold">
                {formatMoney(pending)}
              </div>
            </div>
            <div>
              <div className="text-slate-500">Acordos ativos</div>
              <div className="font-medium">
                {agreements.data?.results.filter(
                  (item) => item.status === "active",
                ).length ?? 0}
              </div>
            </div>
            <Link className="text-blue-700 dark:text-blue-300" to="/finance">
              Abrir Financeiro
            </Link>
          </div>
        </Panel>
        <Panel title="Observacoes">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {customer.data.notes || "Sem observacoes."}
          </p>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title="Equipamentos">
          {equipment.isLoading ? <PageLoader /> : null}
          {equipment.data ? (
            <DataTable<Equipment>
              empty="Nenhum equipamento vinculado."
              rows={equipment.data.results}
              columns={[
                { header: "Tipo", cell: (row) => row.equipment_type.name },
                {
                  header: "Modelo",
                  cell: (row) => (
                    <Link
                      className="text-blue-700 dark:text-blue-300"
                      to={`/equipment/${row.id}`}
                    >
                      {[row.manufacturer, row.model]
                        .filter(Boolean)
                        .join(" ") || "-"}
                    </Link>
                  ),
                },
                { header: "Serial", cell: (row) => row.serial_number || "-" },
                { header: "Status", cell: (row) => row.status },
              ]}
            />
          ) : null}
        </Panel>
        <Panel title="Ordens de Servico">
          {workOrders.isLoading ? <PageLoader /> : null}
          {workOrders.data ? (
            <DataTable<WorkOrder>
              empty="Nenhuma OS para este cliente."
              rows={workOrders.data.results}
              columns={[
                {
                  header: "OS",
                  cell: (row) => (
                    <Link
                      className="text-blue-700 dark:text-blue-300"
                      to={`/work-orders/${row.id}`}
                    >
                      {row.display_number}
                    </Link>
                  ),
                },
                { header: "Titulo", cell: (row) => row.title },
                { header: "Status", cell: (row) => row.status.name },
                {
                  header: "Abertura",
                  cell: (row) => formatDateTime(row.opened_at),
                },
              ]}
            />
          ) : null}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title="Contratos / mensalidades">
          <div className="space-y-2">
            {agreements.data?.results.map((agreement) => (
              <div
                className="flex items-center justify-between rounded-md border border-slate-200 p-3 dark:border-slate-800"
                key={agreement.id}
              >
                <div>
                  <div className="font-medium">{agreement.name}</div>
                  <div className="text-xs text-slate-500">
                    Desde {formatDate(agreement.starts_on)} · vence dia{" "}
                    {agreement.billing_day}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">
                    {formatMoney(agreement.amount)}
                  </div>
                  <Badge
                    tone={agreement.status === "active" ? "success" : "neutral"}
                  >
                    {agreement.status}
                  </Badge>
                </div>
              </div>
            ))}
            {!agreements.data?.results.length ? (
              <p className="text-sm text-slate-500">
                Cliente sem acordo recorrente.
              </p>
            ) : null}
          </div>
        </Panel>
        <Panel title="Historico financeiro">
          <div className="space-y-2">
            {receivables.data?.results.map((receivable) => (
              <div
                className="flex items-center justify-between rounded-md border border-slate-200 p-3 dark:border-slate-800"
                key={receivable.id}
              >
                <div>
                  <div className="font-medium">{receivable.description}</div>
                  <div className="text-xs text-slate-500">
                    Vencimento {formatDate(receivable.due_date)} ·{" "}
                    {receivable.status}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">
                    {formatMoney(receivable.amount)}
                  </div>
                  <div className="text-xs text-slate-500">
                    Saldo {formatMoney(receivable.balance)}
                  </div>
                </div>
              </div>
            ))}
            {!receivables.data?.results.length ? (
              <p className="text-sm text-slate-500">
                Nenhum lancamento financeiro.
              </p>
            ) : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}
