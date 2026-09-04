import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { catalogApi, customersApi, financeApi } from "../api/endpoints";
import type { Receivable } from "../api/types";
import { PageHeader } from "../components/PageHeader";
import { Badge, Button, Field, Input, Panel, Select } from "../components/ui";
import { formatDate, formatDateTime, formatMoney } from "../utils/format";

function statusTone(receivable: Receivable) {
  if (receivable.is_overdue) return "danger";
  if (receivable.status === "paid") return "success";
  if (receivable.status === "partial") return "warning";
  return "neutral";
}

export function FinancePage() {
  const queryClient = useQueryClient();
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
    queryFn: () => financeApi.receivables({ ordering: "due_date" }),
  });
  const agreements = useQuery({
    queryKey: ["finance", "agreements"],
    queryFn: () => financeApi.agreements({ ordering: "customer__name" }),
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
      await refreshFinance();
    },
  });

  const selected = useMemo(
    () =>
      receivables.data?.results.find((item) => item.id === selectedReceivable),
    [receivables.data?.results, selectedReceivable],
  );

  return (
    <div>
      <PageHeader
        title="Financeiro"
        description="Contas a receber, recebimentos e clientes com acordo recorrente."
      />

      <div className="mb-5 grid gap-3 md:grid-cols-3">
        <Panel title="A receber">
          <div className="text-2xl font-semibold">
            {formatMoney(dashboard.data?.pending_total ?? "0")}
          </div>
        </Panel>
        <Panel title="Recebido no mes">
          <div className="text-2xl font-semibold">
            {formatMoney(dashboard.data?.received_this_month ?? "0")}
          </div>
        </Panel>
        <Panel title="Em atraso">
          <div className="text-2xl font-semibold text-red-600">
            {formatMoney(dashboard.data?.overdue_total ?? "0")}
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
        <Panel title="Contas a receber">
          {receivables.isLoading ? <p>Carregando...</p> : null}
          {receivables.isError ? (
            <p className="text-red-600">
              Nao foi possivel carregar o financeiro.
            </p>
          ) : null}
          <div className="space-y-2">
            {receivables.data?.results.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedReceivable(item.id)}
                className="grid w-full gap-2 rounded-md border border-slate-200 p-3 text-left hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800 md:grid-cols-[1.5fr_1fr_1fr_auto]"
              >
                <div>
                  <div className="font-medium">{item.customer_name}</div>
                  <div className="text-sm text-slate-500">
                    {item.description}
                  </div>
                </div>
                <div className="text-sm">
                  <div>Vence {formatDate(item.due_date)}</div>
                  <div className="text-slate-500">{item.origin}</div>
                </div>
                <div>
                  <div className="font-medium">{formatMoney(item.balance)}</div>
                  <div className="text-xs text-slate-500">
                    de {formatMoney(item.amount)}
                  </div>
                </div>
                <Badge tone={statusTone(item)}>
                  {item.is_overdue ? "vencido" : item.status}
                </Badge>
              </button>
            ))}
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel title="Registrar pagamento">
            <div className="space-y-3">
              <Field label="Conta">
                <Select
                  value={selectedReceivable}
                  onChange={(event) =>
                    setSelectedReceivable(event.target.value)
                  }
                >
                  <option value="">Selecione</option>
                  {receivables.data?.results
                    .filter(
                      (item) =>
                        item.status !== "paid" && item.status !== "cancelled",
                    )
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.customer_name} - {formatMoney(item.balance)}
                      </option>
                    ))}
                </Select>
              </Field>
              {selected ? (
                <p className="text-xs text-slate-500">
                  Saldo atual: {formatMoney(selected.balance)}
                </p>
              ) : null}
              <Field label="Valor">
                <Input
                  value={paymentAmount}
                  onChange={(event) => setPaymentAmount(event.target.value)}
                  inputMode="decimal"
                />
              </Field>
              <Field label="Metodo">
                <Select
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                >
                  <option value="">Selecione</option>
                  {paymentMethods.data?.results.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button
                type="button"
                disabled={
                  !selectedReceivable ||
                  !paymentAmount ||
                  !paymentMethod ||
                  addPayment.isPending
                }
                onClick={() => addPayment.mutate()}
              >
                {addPayment.isPending
                  ? "Registrando..."
                  : "Registrar pagamento"}
              </Button>
              {addPayment.isError ? (
                <p className="text-sm text-red-600">
                  Nao foi possivel registrar o pagamento.
                </p>
              ) : null}
            </div>
          </Panel>

          <Panel title="Novo mensalista">
            <div className="space-y-3">
              <Field label="Cliente">
                <Select
                  value={agreementCustomer}
                  onChange={(event) => setAgreementCustomer(event.target.value)}
                >
                  <option value="">Selecione</option>
                  {customers.data?.results.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Nome do acordo">
                <Input
                  value={agreementName}
                  onChange={(event) => setAgreementName(event.target.value)}
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Valor mensal">
                  <Input
                    value={agreementAmount}
                    onChange={(event) => setAgreementAmount(event.target.value)}
                    inputMode="decimal"
                  />
                </Field>
                <Field label="Dia vencimento">
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={agreementDay}
                    onChange={(event) => setAgreementDay(event.target.value)}
                  />
                </Field>
              </div>
              <Field label="Inicio">
                <Input
                  type="date"
                  value={agreementStart}
                  onChange={(event) => setAgreementStart(event.target.value)}
                />
              </Field>
              <Button
                type="button"
                disabled={
                  !agreementCustomer ||
                  !agreementAmount ||
                  createAgreement.isPending
                }
                onClick={() => createAgreement.mutate()}
              >
                {createAgreement.isPending ? "Salvando..." : "Criar acordo"}
              </Button>
            </div>
          </Panel>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title="Contratos / mensalistas">
          <div className="space-y-2">
            {agreements.data?.results.map((agreement) => (
              <div
                key={agreement.id}
                className="rounded-md border border-slate-200 p-3 dark:border-slate-800"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{agreement.customer_name}</div>
                    <div className="text-sm text-slate-500">
                      {agreement.name}
                    </div>
                  </div>
                  <Badge
                    tone={agreement.status === "active" ? "success" : "neutral"}
                  >
                    {agreement.status}
                  </Badge>
                </div>
                <div className="mt-2 text-sm">
                  {formatMoney(agreement.amount)} · vence dia{" "}
                  {agreement.billing_day}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Recebimentos recentes">
          <div className="space-y-2">
            {dashboard.data?.recent_payments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between rounded-md border border-slate-200 p-3 dark:border-slate-800"
              >
                <div>
                  <div className="font-medium">
                    {formatMoney(payment.amount)}
                  </div>
                  <div className="text-xs text-slate-500">
                    {payment.payment_method_name}
                  </div>
                </div>
                <div className="text-xs text-slate-500">
                  {formatDateTime(payment.paid_at)}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
