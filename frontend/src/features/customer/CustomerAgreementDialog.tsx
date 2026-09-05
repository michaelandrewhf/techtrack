import type { UseFormReturn } from "react-hook-form";

import type { CatalogItem } from "../../api/types";
import { Modal } from "../../components/Modal";
import {
  Button,
  Field,
  Input,
  Notice,
  Select,
  Textarea,
} from "../../components/ui";
import { errorMessage } from "../../utils/errors";
import type { AgreementForm } from "./detail";

export function CustomerAgreementDialog({
  open,
  form,
  firstBillingMode,
  paymentMethods,
  pending,
  error,
  onSubmit,
  onClose,
}: {
  open: boolean;
  form: UseFormReturn<AgreementForm>;
  firstBillingMode: "receive_now" | "next_month";
  paymentMethods: CatalogItem[];
  pending: boolean;
  error: unknown;
  onSubmit: (data: AgreementForm) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      title="Tornar cliente mensalista"
      description="Crie um contrato recorrente sem alterar o cadastro base do cliente."
      onClose={onClose}
    >
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <Field
          label="Nome do contrato"
          required
          error={form.formState.errors.name?.message}
        >
          <Input {...form.register("name")} />
        </Field>
        <Field label="Descricao">
          <Textarea {...form.register("description")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Valor mensal"
            required
            error={form.formState.errors.amount?.message}
          >
            <Input inputMode="decimal" {...form.register("amount")} />
          </Field>
          <Field
            label="Dia de vencimento"
            required
            error={form.formState.errors.billing_day?.message}
          >
            <Input
              max={31}
              min={1}
              type="number"
              {...form.register("billing_day")}
            />
          </Field>
        </div>
        <Field
          label="Inicio"
          required
          error={form.formState.errors.starts_on?.message}
        >
          <Input type="date" {...form.register("starts_on")} />
        </Field>

        <fieldset className="rounded-[var(--tt-radius-md)] border border-[var(--tt-border)] p-4">
          <legend className="px-1 font-medium text-[var(--tt-text)]">
            Primeira mensalidade
          </legend>
          <div className="mt-2 space-y-3">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                className="mt-1"
                type="radio"
                value="receive_now"
                {...form.register("first_billing_mode")}
              />
              <span>
                <strong className="block text-sm text-[var(--tt-text)]">
                  Receber agora
                </strong>
                <span className="text-xs text-[var(--tt-text-muted)]">
                  Cria a primeira mensalidade com vencimento hoje e registra a
                  baixa como paga.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                className="mt-1"
                type="radio"
                value="next_month"
                {...form.register("first_billing_mode")}
              />
              <span>
                <strong className="block text-sm text-[var(--tt-text)]">
                  Cobrar no proximo mes
                </strong>
                <span className="text-xs text-[var(--tt-text-muted)]">
                  Nao gera cobranca no mes atual; o primeiro vencimento segue o
                  dia cadastrado no proximo mes.
                </span>
              </span>
            </label>
          </div>
        </fieldset>

        {firstBillingMode === "receive_now" ? (
          <Field
            label="Metodo de pagamento da primeira mensalidade"
            required
            error={form.formState.errors.first_payment_method?.message}
          >
            <Select {...form.register("first_payment_method")}>
              <option value="">Selecione</option>
              {paymentMethods.map((method) => (
                <option key={method.id} value={method.id}>
                  {method.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        <Notice tone="info">
          {firstBillingMode === "receive_now"
            ? "A entrada sera registrada como recebida hoje. As proximas mensalidades seguirao o dia de vencimento a partir do proximo mes."
            : "A primeira cobranca sera gerada somente no proximo mes, usando o dia de vencimento informado."}
        </Notice>
        {error ? <Notice tone="danger">{errorMessage(error)}</Notice> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={pending} type="submit">
            Criar contrato
          </Button>
        </div>
      </form>
    </Modal>
  );
}
