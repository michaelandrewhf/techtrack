import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { financeApi, workOrdersApi } from "../../../api/endpoints";
import type {
  Receivable,
  WorkOrder,
  WorkOrderChargeMode,
  WorkOrderChargePolicyState,
} from "../../../api/types";
import { ErrorState, PageLoader } from "../../../components/State";
import {
  Button,
  Field,
  Input,
  Notice,
  Panel,
  Select,
} from "../../../components/ui";
import { errorMessage } from "../../../utils/errors";
import { formatDate, formatDateTime, formatMoney } from "../../../utils/format";
import { workOrderTotals } from "./presentation";

export function WorkOrderFinanceHistory({
  workOrder,
  receivables,
  receivablesLoading,
  receivablesError,
  onRetryReceivables,
  chargePolicy,
  chargePolicyLoading,
  chargePolicyError,
  onRetryChargePolicy,
  onChanged,
}: {
  workOrder: WorkOrder;
  receivables: Receivable[];
  receivablesLoading: boolean;
  receivablesError: boolean;
  onRetryReceivables: () => void;
  chargePolicy?: WorkOrderChargePolicyState;
  chargePolicyLoading: boolean;
  chargePolicyError: boolean;
  onRetryChargePolicy: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const isClosed = workOrder.status.kind !== "active";
  const { technicalTotal } = workOrderTotals(workOrder);
  const [chargeAmount, setChargeAmount] = useState("");
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [agreementId, setAgreementId] = useState("");

  const agreements = chargePolicy?.active_agreements ?? [];
  const policy = chargePolicy?.policy ?? null;
  const hasAgreement = Boolean(chargePolicy?.has_active_agreement);

  useEffect(() => {
    setAgreementId(
      chargePolicy?.policy?.service_agreement ??
        chargePolicy?.active_agreements?.[0]?.id ??
        "",
    );
  }, [
    chargePolicy?.policy?.service_agreement,
    chargePolicy?.active_agreements,
  ]);

  const savePolicy = useMutation({
    mutationFn: (mode: WorkOrderChargeMode) =>
      workOrdersApi.saveChargePolicy(workOrder.id, {
        mode,
        service_agreement_id: agreementId || agreements[0]?.id || null,
      }),
    onSuccess: async () => {
      await onChanged();
    },
  });

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
        notes:
          policy?.mode === "agreement_extra"
            ? "Cobranca adicional ao plano mensal."
            : "",
      }),
    onSuccess: async () => {
      setChargeAmount("");
      await onChanged();
    },
  });

  const canCreateCharge = !hasAgreement || policy?.mode === "agreement_extra";

  return (
    <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <Panel
        title="Financeiro da OS"
        subtitle="Resumo comercial do atendimento e cobrancas relacionadas."
      >
        {chargePolicyLoading ? (
          <div className="mb-4">
            <PageLoader label="Verificando plano mensal" />
          </div>
        ) : chargePolicyError ? (
          <div className="mb-4">
            <ErrorState
              message="Nao foi possivel verificar se esta OS pertence a um plano mensal."
              onRetry={onRetryChargePolicy}
            />
          </div>
        ) : hasAgreement ? (
          <div className="mb-5 rounded-[var(--radius-lg)] border border-[var(--primary)]/25 bg-[var(--primary-soft)] p-4">
            <div className="font-semibold text-[var(--text)]">
              Cliente mensalista
            </div>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Defina explicitamente como este atendimento entra no financeiro
              antes de criar uma cobranca avulsa.
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {agreements.length > 1 ? (
                <Field label="Contrato">
                  <Select
                    value={agreementId}
                    disabled={savePolicy.isPending}
                    onChange={(event) => setAgreementId(event.target.value)}
                  >
                    {agreements.map((agreement) => (
                      <option key={agreement.id} value={agreement.id}>
                        {agreement.name} · {formatMoney(agreement.amount)}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : (
                <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm">
                  <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                    Contrato ativo
                  </div>
                  <div className="mt-1 font-medium text-[var(--text)]">
                    {agreements[0]?.name ?? "Plano mensal"}
                  </div>
                  {agreements[0] ? (
                    <div className="mt-1 text-xs text-[var(--text-muted)]">
                      {formatMoney(agreements[0].amount)}
                    </div>
                  ) : null}
                </div>
              )}

              <Field label="Tratamento desta OS">
                <Select
                  aria-label="Tratamento financeiro da OS"
                  value={policy?.mode ?? ""}
                  disabled={savePolicy.isPending || !agreementId}
                  onChange={(event) => {
                    if (event.target.value) {
                      savePolicy.mutate(
                        event.target.value as WorkOrderChargeMode,
                      );
                    }
                  }}
                >
                  <option value="">Selecione</option>
                  <option value="agreement_included">
                    Inclusa no plano mensal
                  </option>
                  <option value="agreement_extra">Cobrar a parte</option>
                </Select>
              </Field>
            </div>

            <div className="mt-3">
              {policy?.mode === "agreement_included" ? (
                <Notice tone="success">
                  Esta OS esta inclusa no plano mensal e nao deve gerar cobranca
                  adicional.
                </Notice>
              ) : policy?.mode === "agreement_extra" ? (
                <Notice tone="warning">
                  Esta OS sera cobrada a parte, alem da mensalidade do contrato.
                </Notice>
              ) : (
                <Notice tone="warning">
                  Selecione se a OS esta inclusa no plano ou se sera cobrada a
                  parte.
                </Notice>
              )}
            </div>

            {savePolicy.error ? (
              <div className="mt-3">
                <Notice tone="danger">{errorMessage(savePolicy.error)}</Notice>
              </div>
            ) : null}
          </div>
        ) : null}

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
                    Vence {formatDate(receivable.due_date)} ·{" "}
                    {receivable.status}
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

        {!isClosed && canCreateCharge ? (
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
                disabled={
                  !chargeAmount || !dueDate || createReceivable.isPending
                }
                type="button"
                onClick={() => createReceivable.mutate()}
              >
                Criar cobranca
              </Button>
            </div>
          </div>
        ) : null}

        {!isClosed && hasAgreement && !policy ? (
          <p className="mt-4 text-sm text-[var(--text-muted)]">
            A criacao de cobranca fica disponivel depois que o tratamento da OS
            for definido.
          </p>
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
                {formatDateTime(event.changed_at)} ·{" "}
                {event.changed_by?.username ?? "-"}
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
