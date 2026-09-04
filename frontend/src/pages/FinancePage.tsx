import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleDollarSign, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { catalogApi, customersApi, financeApi } from "../api/endpoints";
import type { Payment, Receivable, ServiceAgreement } from "../api/types";
import { DataTable } from "../components/DataTable";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { PageLoader } from "../components/State";
import { Tabs } from "../components/Tabs";
import {
  Badge,
  Button,
  Field,
  Input,
  MetricCard,
  Notice,
  Panel,
  Select,
} from "../components/ui";
import { errorMessage } from "../utils/errors";
import { formatDate, formatDateTime, formatMoney } from "../utils/format";

function statusTone(receivable: Receivable) {
  if (receivable.is_overdue) return "danger" as const;
  if (receivable.status === "paid") return "success" as const;
  if (receivable.status === "partial") return "warning" as const;
  return "neutral" as const;
}

function agreementTone(status: string) {
  if (status === "active") return "success" as const;
  if (status === "paused") return "warning" as const;
  return "neutral" as const;
}

const tabItems = [
  { id: "overview", label: "Visao geral" },
  { id: "receivables", label: "Contas a receber" },
  { id: "payments", label: "Recebimentos" },
  { id: "agreements", label: "Contratos" },
];

export function FinancePage() {
  const [params, setParams] = useSearchParams();
  const requestedTab = params.get("tab") ?? "overview";
  const activeTab = tabItems.some((tab) => tab.id === requestedTab)
    ? requestedTab
    : "overview";
  const queryClient = useQueryClient();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [agreementOpen, setAgreementOpen] = useState(false);
  const [selectedReceivable, setSelectedReceivable] = useState<string>("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [agreementCustomer, setAgreementCustomer] = useState("");
  const [agreementName, setAgreementName] = useState("Suporte mensal");
  const [agreementAmount, setAgreementAmount] = useState("");
  const [agreementDay, setAgreementDay] = useState("10");
  const [agreementStart, setAgreementStart] = useState(
    new Date().toISOString().slice(0, 10),
  );

  const dashboard = useQuery({
    queryKey: ["finance", "dashboard"],
    queryFn: financeApi.dashboard,
  });
  const receivables = useQuery({
    queryKey: ["finance", "receivables"],
    queryFn: () =>
      financeApi.receivables({ ordering: "due_date", page_size: 100 }),
  });
  const payments = useQuery({
    queryKey: ["finance", "payments"],
    queryFn: () =>
      financeApi.payments({ ordering: "-paid_at", page_size: 100 }),
  });
  const agreements = useQuery({
    queryKey: ["finance", "agreements"],
    queryFn: () =>
      financeApi.agreements({ ordering: "customer__name", page_size: 100 }),
  });
  const customers = useQuery({
    queryKey: ["customers", "finance-select"],
    queryFn: () => customersApi.list({ page_size: 100, status: "active" }),
  });
  const paymentMethods = useQuery({
    queryKey: ["catalog", "payment-methods", "finance"],
    queryFn: () =>
      catalogApi("payment-methods").list({ is_active: true, page_size: 100 }),
  });

  const openReceivables = useMemo(
    () =>
      receivables.data?.results.filter(
        (item) => item.status !== "paid" && item.status !== "cancelled",
      ) ?? [],
    [receivables.data?.results],
  );
  const activeAgreements = useMemo(
    () =>
      agreements.data?.results.filter((item) => item.status === "active") ?? [],
    [agreements.data?.results],
  );

  const refreshFinance = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["finance"] }),
      queryClient.invalidateQueries({ queryKey: ["customers"] }),
    ]);
  };

  const addPayment = useMutation({
    mutationFn: () =>
      financeApi.addPayment(selectedReceivable, {
        amount: paymentAmount,
        payment_method: paymentMethod,
      }),
    onSuccess: async () => {
      setPaymentAmount("");
      setSelectedReceivable("");
      setPaymentMethod("");
      setPaymentOpen(false);
      await refreshFinance();
    },
  });

  const createAgreement = useMutation({
    mutationFn: () =>
      financeApi.createAgreement({
        customer: agreementCustomer,
        name: agreementName,
        status: "active",
        starts_on: agreementStart,
        billing_frequency: "monthly",
        amount: agreementAmount,
        billing_day: Number(agreementDay),
      }),
    onSuccess: async () => {
      setAgreementAmount("");
      setAgreementCustomer("");
      setAgreementOpen(false);
      await refreshFinance();
    },
  });

  const selectTab = (value: string) => {
    const next = new URLSearchParams(params);
    if (value === "overview") next.delete("tab");
    else next.set("tab", value);
    setParams(next, { replace: true });
  };

  return (
    <div>
      <PageHeader
        eyebrow="Gestao"
        title="Financeiro"
        description="Visao consolidada de contas a receber, recebimentos e contratos. Operacoes ligadas a um cliente tambem podem ser feitas dentro do proprio cliente."
        action={
          <>
            <Button type="button" onClick={() => setPaymentOpen(true)}>
              <CircleDollarSign className="h-4 w-4" />
              Registrar pagamento
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setAgreementOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Novo contrato
            </Button>
          </>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="A receber"
          value={formatMoney(dashboard.data?.pending_total ?? "0")}
          tone="warning"
        />
        <MetricCard
          label="Recebido no mes"
          value={formatMoney(dashboard.data?.received_this_month ?? "0")}
          tone="success"
        />
        <MetricCard
          label="Em atraso"
          value={formatMoney(dashboard.data?.overdue_total ?? "0")}
          tone={
            Number(dashboard.data?.overdue_total ?? 0) > 0
              ? "danger"
              : "success"
          }
        />
        <MetricCard
          label="Contratos ativos"
          value={activeAgreements.length}
          tone="info"
        />
      </div>

      <Tabs items={tabItems} value={activeTab} onChange={selectTab} />

      <div className="mt-5">
        {activeTab === "overview" ? (
          <div className="grid gap-5 xl:grid-cols-2">
            <Panel
              title="Proximos vencimentos"
              subtitle="Contas abertas com vencimento mais proximo."
            >
              <div className="space-y-2">
                {(dashboard.data?.upcoming ?? []).map((item) => (
                  <Link
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                    key={item.id}
                    to={`/customers/${item.customer}?tab=finance`}
                  >
                    <div>
                      <div className="font-medium text-slate-950 dark:text-white">
                        {item.customer_name}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {item.description} · vence {formatDate(item.due_date)}
                      </div>
                    </div>
                    <strong>{formatMoney(item.balance)}</strong>
                  </Link>
                ))}
                {!dashboard.data?.upcoming?.length ? (
                  <p className="text-sm text-slate-500">
                    Nenhum vencimento futuro em aberto.
                  </p>
                ) : null}
              </div>
            </Panel>

            <Panel
              title="Recebimentos recentes"
              subtitle="Ultimas baixas registradas no sistema."
            >
              <div className="space-y-2">
                {(dashboard.data?.recent_payments ?? []).map((payment) => (
                  <div
                    className="flex items-center justify-between rounded-xl border border-slate-200 p-3 dark:border-slate-800"
                    key={payment.id}
                  >
                    <div>
                      <div className="font-medium">
                        {formatMoney(payment.amount)}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {payment.payment_method_name}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">
                      {formatDateTime(payment.paid_at)}
                    </div>
                  </div>
                ))}
                {!dashboard.data?.recent_payments?.length ? (
                  <p className="text-sm text-slate-500">
                    Nenhum recebimento recente.
                  </p>
                ) : null}
              </div>
            </Panel>
          </div>
        ) : null}

        {activeTab === "receivables" ? (
          <Panel
            title="Contas a receber"
            subtitle="Cobrancas de OS, contratos e lancamentos manuais."
            action={
              <Button
                size="sm"
                type="button"
                onClick={() => setPaymentOpen(true)}
              >
                Registrar pagamento
              </Button>
            }
          >
            {receivables.isLoading ? <PageLoader /> : null}
            <DataTable<Receivable>
              empty="Nenhuma conta a receber."
              getRowKey={(row) => row.id}
              rows={receivables.data?.results ?? []}
              columns={[
                {
                  header: "Cliente",
                  cell: (row) => (
                    <Link
                      className="font-medium text-blue-700 dark:text-blue-300"
                      to={`/customers/${row.customer}?tab=finance`}
                    >
                      {row.customer_name}
                    </Link>
                  ),
                },
                { header: "Descricao", cell: (row) => row.description },
                { header: "Origem", cell: (row) => row.origin },
                {
                  header: "Vencimento",
                  cell: (row) => formatDate(row.due_date),
                },
                { header: "Valor", cell: (row) => formatMoney(row.amount) },
                {
                  header: "Saldo",
                  cell: (row) => <strong>{formatMoney(row.balance)}</strong>,
                },
                {
                  header: "Status",
                  cell: (row) => (
                    <Badge tone={statusTone(row)}>
                      {row.is_overdue ? "Vencido" : row.status}
                    </Badge>
                  ),
                },
              ]}
            />
          </Panel>
        ) : null}

        {activeTab === "payments" ? (
          <Panel
            title="Recebimentos"
            subtitle="Historico consolidado de pagamentos registrados."
          >
            {payments.isLoading ? <PageLoader /> : null}
            <DataTable<Payment>
              empty="Nenhum pagamento registrado."
              getRowKey={(row) => row.id}
              rows={payments.data?.results ?? []}
              columns={[
                { header: "Data", cell: (row) => formatDateTime(row.paid_at) },
                {
                  header: "Valor",
                  cell: (row) => <strong>{formatMoney(row.amount)}</strong>,
                },
                { header: "Metodo", cell: (row) => row.payment_method_name },
                { header: "Referencia", cell: (row) => row.reference || "-" },
                {
                  header: "Situacao",
                  cell: (row) => (
                    <Badge tone={row.voided_at ? "danger" : "success"}>
                      {row.voided_at ? "Invalidado" : "Valido"}
                    </Badge>
                  ),
                },
              ]}
            />
          </Panel>
        ) : null}

        {activeTab === "agreements" ? (
          <Panel
            title="Contratos / mensalistas"
            subtitle="Historico consolidado de acordos recorrentes."
            action={
              <Button
                size="sm"
                type="button"
                onClick={() => setAgreementOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Novo contrato
              </Button>
            }
          >
            <DataTable<ServiceAgreement>
              empty="Nenhum contrato registrado."
              getRowKey={(row) => row.id}
              rows={agreements.data?.results ?? []}
              columns={[
                {
                  header: "Cliente",
                  cell: (row) => (
                    <Link
                      className="font-medium text-blue-700 dark:text-blue-300"
                      to={`/customers/${row.customer}?tab=finance`}
                    >
                      {row.customer_name}
                    </Link>
                  ),
                },
                { header: "Contrato", cell: (row) => row.name },
                { header: "Valor", cell: (row) => formatMoney(row.amount) },
                {
                  header: "Vencimento",
                  cell: (row) => `Dia ${row.billing_day}`,
                },
                { header: "Inicio", cell: (row) => formatDate(row.starts_on) },
                { header: "Fim", cell: (row) => formatDate(row.ends_on) },
                {
                  header: "Status",
                  cell: (row) => (
                    <Badge tone={agreementTone(row.status)}>{row.status}</Badge>
                  ),
                },
              ]}
            />
          </Panel>
        ) : null}
      </div>

      <Modal
        open={paymentOpen}
        title="Registrar pagamento"
        description="Escolha uma conta em aberto e registre a baixa total ou parcial."
        onClose={() => setPaymentOpen(false)}
      >
        <div className="space-y-4">
          <Field label="Conta a receber" required>
            <Select
              value={selectedReceivable}
              onChange={(event) => {
                const value = event.target.value;
                setSelectedReceivable(value);
                const selected = openReceivables.find(
                  (item) => item.id === value,
                );
                setPaymentAmount(selected?.balance ?? "");
              }}
            >
              <option value="">Selecione</option>
              {openReceivables.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.customer_name} · {item.description} ·{" "}
                  {formatMoney(item.balance)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Valor" required>
            <Input
              inputMode="decimal"
              value={paymentAmount}
              onChange={(event) => setPaymentAmount(event.target.value)}
            />
          </Field>
          <Field label="Metodo" required>
            <Select
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
            >
              <option value="">Selecione</option>
              {(paymentMethods.data?.results ?? []).map((method) => (
                <option key={method.id} value={method.id}>
                  {method.name}
                </option>
              ))}
            </Select>
          </Field>
          {addPayment.error ? (
            <Notice tone="danger">{errorMessage(addPayment.error)}</Notice>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPaymentOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              disabled={
                !selectedReceivable ||
                !paymentAmount ||
                !paymentMethod ||
                addPayment.isPending
              }
              type="button"
              onClick={() => addPayment.mutate()}
            >
              Registrar pagamento
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={agreementOpen}
        title="Novo contrato"
        description="Crie um relacionamento recorrente; o cliente passa a ser apresentado como mensalista enquanto o contrato estiver ativo."
        onClose={() => setAgreementOpen(false)}
      >
        <div className="space-y-4">
          <Field label="Cliente" required>
            <Select
              value={agreementCustomer}
              onChange={(event) => setAgreementCustomer(event.target.value)}
            >
              <option value="">Selecione</option>
              {(customers.data?.results ?? []).map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Nome do acordo" required>
            <Input
              value={agreementName}
              onChange={(event) => setAgreementName(event.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor mensal" required>
              <Input
                inputMode="decimal"
                value={agreementAmount}
                onChange={(event) => setAgreementAmount(event.target.value)}
              />
            </Field>
            <Field label="Dia vencimento" required>
              <Input
                max={31}
                min={1}
                type="number"
                value={agreementDay}
                onChange={(event) => setAgreementDay(event.target.value)}
              />
            </Field>
          </div>
          <Field label="Inicio" required>
            <Input
              type="date"
              value={agreementStart}
              onChange={(event) => setAgreementStart(event.target.value)}
            />
          </Field>
          {createAgreement.error ? (
            <Notice tone="danger">{errorMessage(createAgreement.error)}</Notice>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setAgreementOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              disabled={
                !agreementCustomer ||
                !agreementAmount ||
                createAgreement.isPending
              }
              type="button"
              onClick={() => createAgreement.mutate()}
            >
              Criar contrato
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
