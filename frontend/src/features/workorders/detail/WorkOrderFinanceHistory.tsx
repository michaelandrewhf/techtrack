import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";

import { financeApi } from "../../../api/endpoints";
import type { Receivable, WorkOrder } from "../../../api/types";
import { ErrorState, PageLoader } from "../../../components/State";
import { Button, Field, Input, Notice, Panel } from "../../../components/ui";
import { errorMessage } from "../../../utils/errors";
import { formatDate, formatDateTime, formatMoney } from "../../../utils/format";
import { workOrderTotals } from "./presentation";

export function WorkOrderFinanceHistory({
  workOrder,
  receivables,
  receivablesLoading,
  receivablesError,
  onRetryReceivables,
  onChanged,
}: {
  workOrder: WorkOrder;
  receivables: Receivable[];
  receivablesLoading: boolean;
  receivablesError: boolean;
  onRetryReceivables: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const isClosed = workOrder.status.kind !== "active";
  const { technicalTotal } = workOrderTotals(workOrder);
  const [chargeAmount, setChargeAmount] = useState("");
  const [dueDate, setDueDate] = useState(
    new Date().toISOString().slice(0, 10),
  );

  const createReceivable = useMutation({
    mutationFn: () =>
      financeApi.createReceivable({
        customer: workOrder.customer.id,
        work_order: workOrder.id,
        service_agreement: null,
        origin: "work_order",
        description: `Cobranca ${workOrder.display_number}`,
        reference: workOrder.display_number,
        issued_at: new Date().toISOString().slice(0, 10),
        due_date: dueDate,
        amount: chargeAmount,
        notes: "",
      }),
    onSuccess: async () => {
      setChargeAmount("");
      await onChanged();
    },
  });

  return (
    <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <Panel
        title="Financeiro da OS"
        subtitle="Resumo comercial do atendimento e cobrancas relacionadas."
      >
        {receivablesLoading ? (
          <PageLoader label="Carregando cobrancas" />
        ) : receivablesError ? (
          <ErrorState
            message="Nao foi possivel carregar as cobrancas desta OS."
            onRetry={onRetryReceivables}
          />
        ) : (
          <div className="space-y-3">
            {receivables.map((receivable) => (
              <Link
                className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] p-3 transition hover:bg-[var(--surface-subtle)]"
                key={receivable.id}
                to={`/customers/${workOrder.customer.id}?tab=finance`}
              >
                <div>
                  <div className="font-medium text-[var(--text)]">
                    {receivable.description}
                  </div>
                  <div className="mt-1 text-xs text-[var(--text-muted)]">
                    Vence {formatDate(receivable.due_date)} · {receivable.status}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium text-[var(--text)]">
                    {formatMoney(receivable.amount)}
                  </div>
                  <div className="mt-1 text-xs text-[var(--text-muted)]">
                    Saldo {formatMoney(receivable.balance)}
                  </div>
                </div>
              </Link>
            ))}
            {!receivables.length ? (
              <p className="text-sm text-[var(--text-muted)]">
                Nenhuma cobranca vinculada a esta OS.
              </p>
            ) : null}
          </div>
        )}

        {!isClosed ? (
          <div className="mt-4 grid gap-3 border-t border-[var(--border)] pt-4 sm:grid-cols-[1fr_170px_auto]">
            <Field label="Valor da cobranca">
              <Input
                inputMode="decimal"
                placeholder={technicalTotal.toFixed(2)}
                value={chargeAmount}
                onChange={(event) => setChargeAmount(event.target.value)}
              />
            </Field>
            <Field label="Vencimento">
              <Input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </Field>
            <div className="self-end">
              <Button
                disabled={!chargeAmount || !dueDate || createReceivable.isPending}
                type="button"
                onClick={() => createReceivable.mutate()}
              >
                Criar cobranca
              </Button>
            </div>
          </div>
        ) : null}

        {createReceivable.error ? (
          <div className="mt-3">
            <Notice tone="danger">
              {errorMessage(createReceivable.error)}
            </Notice>
          </div>
        ) : null}
      </Panel>

      <Panel
        title="Historico de status"
        subtitle="Linha do tempo imutavel das transicoes da OS."
      >
        <div className="space-y-4">
          {(workOrder.status_history ?? []).map((event) => (
            <div
              className="relative border-l-2 border-[var(--primary)] pl-4"
              key={event.id}
            >
              <div className="font-medium text-[var(--text)]">
                {event.status.name}
              </div>
              <div className="mt-1 text-xs text-[var(--text-muted)]">
                {formatDateTime(event.changed_at)} · {event.changed_by?.username ?? "-"}
              </div>
              {event.comment || event.description ? (
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  {event.comment || event.description}
                </p>
              ) : null}
            </div>
          ))}
          {!workOrder.status_history?.length ? (
            <p className="text-sm text-[var(--text-muted)]">
              Nenhuma transicao registrada.
            </p>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}
