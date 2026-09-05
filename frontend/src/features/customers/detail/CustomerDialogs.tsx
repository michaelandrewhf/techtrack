import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import {
  catalogApi,
  customersApi,
  equipmentApi,
  financeApi,
} from "../../../api/endpoints";
import type { Customer, Receivable } from "../../../api/types";
import { CatalogSelect } from "../../../components/CatalogSelect";
import { Modal } from "../../../components/Modal";
import {
  Button,
  Field,
  Input,
  Notice,
  Select,
  Textarea,
} from "../../../components/ui";
import { errorMessage } from "../../../utils/errors";
import { formatMoney } from "../../../utils/format";
import type { CustomerModalName } from "./types";

const customerSchema = z.object({
  name: z.string().min(1, "Informe o nome."),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email("E-mail invalido.").or(z.literal("")).optional(),
  notes: z.string().optional(),
  status: z.string().min(1),
});

const equipmentSchema = z.object({
  equipment_type_id: z.string().min(1, "Selecione o tipo."),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serial_number: z.string().optional(),
  asset_tag: z.string().optional(),
  operating_system: z.string().optional(),
  notes: z.string().optional(),
  status: z.string().default("active"),
});

const agreementSchema = z
  .object({
    name: z.string().min(1, "Informe o nome do contrato."),
    description: z.string().optional(),
    amount: z.string().min(1, "Informe o valor mensal."),
    billing_day: z.string().min(1, "Informe o dia de vencimento."),
    starts_on: z.string().min(1, "Informe a data de inicio."),
    first_billing_mode: z.enum(["receive_now", "next_month"]),
    first_payment_method: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.first_billing_mode === "receive_now" &&
      !data.first_payment_method
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["first_payment_method"],
        message: "Selecione o metodo de pagamento.",
      });
    }
  });

type CustomerForm = z.input<typeof customerSchema>;
type EquipmentForm = z.input<typeof equipmentSchema>;
type AgreementForm = z.input<typeof agreementSchema>;

function agreementDefaults(): AgreementForm {
  return {
    name: "Suporte mensal",
    description: "",
    amount: "",
    billing_day: "10",
    starts_on: new Date().toISOString().slice(0, 10),
    first_billing_mode: "next_month",
    first_payment_method: "",
  };
}

export function CustomerDialogs({
  customer,
  customerId,
  modal,
  openReceivables,
  onClose,
  onChanged,
}: {
  customer: Customer;
  customerId: string;
  modal: CustomerModalName;
  openReceivables: Receivable[];
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const [selectedReceivable, setSelectedReceivable] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");

  const paymentMethods = useQuery({
    queryKey: ["catalog", "payment-methods", "customer-workspace"],
    queryFn: () =>
      catalogApi("payment-methods").list({ is_active: true, page_size: 100 }),
    enabled: modal === "payment" || modal === "agreement",
  });

  const customerForm = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
  });
  const equipmentForm = useForm<EquipmentForm>({
    resolver: zodResolver(equipmentSchema),
    defaultValues: { status: "active" },
  });
  const agreementForm = useForm<AgreementForm>({
    resolver: zodResolver(agreementSchema),
    defaultValues: agreementDefaults(),
  });
  const firstBillingMode = agreementForm.watch("first_billing_mode");

  useEffect(() => {
    if (modal !== "edit") return;
    customerForm.reset({
      name: customer.name,
      phone: customer.phone,
      whatsapp: customer.whatsapp,
      email: customer.email,
      notes: customer.notes ?? "",
      status: customer.status,
    });
  }, [customer, customerForm, modal]);

  useEffect(() => {
    if (modal === "payment") return;
    setSelectedReceivable("");
    setPaymentAmount("");
    setPaymentMethod("");
  }, [modal]);

  const updateCustomer = useMutation({
    mutationFn: (data: CustomerForm) => customersApi.update(customerId, data),
    onSuccess: async () => {
      onClose();
      await onChanged();
    },
  });

  const addEquipment = useMutation({
    mutationFn: (data: EquipmentForm) =>
      equipmentApi.create({ ...data, customer_id: customerId }),
    onSuccess: async () => {
      equipmentForm.reset({ status: "active" });
      onClose();
      await onChanged();
    },
  });

  const createAgreement = useMutation({
    mutationFn: (data: AgreementForm) =>
      financeApi.createAgreement({
        customer: customerId,
        name: data.name,
        description: data.description ?? "",
        amount: data.amount,
        billing_day: Number(data.billing_day),
        starts_on: data.starts_on,
        ends_on: null,
        billing_frequency: "monthly",
        status: "active",
        first_billing_mode: data.first_billing_mode,
        first_payment_method:
          data.first_billing_mode === "receive_now"
            ? data.first_payment_method
            : undefined,
        notes: "",
      }),
    onSuccess: async () => {
      agreementForm.reset(agreementDefaults());
      onClose();
      await onChanged();
    },
  });

  const addPayment = useMutation({
    mutationFn: () =>
      financeApi.addPayment(selectedReceivable, {
        amount: paymentAmount,
        payment_method: paymentMethod,
      }),
    onSuccess: async () => {
      setSelectedReceivable("");
      setPaymentAmount("");
      setPaymentMethod("");
      onClose();
      await onChanged();
    },
  });

  return (
    <>
      <Modal
        open={modal === "edit"}
        title="Editar cliente"
        description="Atualize os dados sem sair do contexto do cliente."
        onClose={onClose}
      >
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={customerForm.handleSubmit((data) =>
            updateCustomer.mutate(data),
          )}
        >
          <Field
            label="Nome"
            required
            error={customerForm.formState.errors.name?.message}
          >
            <Input
              aria-invalid={Boolean(customerForm.formState.errors.name)}
              {...customerForm.register("name")}
            />
          </Field>
          <Field label="Status">
            <Select {...customerForm.register("status")}>
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
              <option value="prospect">Prospect</option>
              <option value="blocked">Bloqueado</option>
            </Select>
          </Field>
          <Field label="Telefone">
            <Input {...customerForm.register("phone")} />
          </Field>
          <Field label="WhatsApp">
            <Input {...customerForm.register("whatsapp")} />
          </Field>
          <div className="sm:col-span-2">
            <Field
              label="E-mail"
              error={customerForm.formState.errors.email?.message}
            >
              <Input
                aria-invalid={Boolean(customerForm.formState.errors.email)}
                {...customerForm.register("email")}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Observacoes">
              <Textarea {...customerForm.register("notes")} />
            </Field>
          </div>
          {updateCustomer.error ? (
            <div className="sm:col-span-2">
              <Notice tone="danger">
                {errorMessage(updateCustomer.error)}
              </Notice>
            </div>
          ) : null}
          <DialogActions
            pending={updateCustomer.isPending}
            submitLabel="Salvar alteracoes"
            onClose={onClose}
          />
        </form>
      </Modal>

      <Modal
        open={modal === "equipment"}
        title="Adicionar equipamento"
        description={`Novo patrimonio para ${customer.name}.`}
        size="lg"
        onClose={onClose}
      >
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={equipmentForm.handleSubmit((data) =>
            addEquipment.mutate(data),
          )}
        >
          <Controller
            control={equipmentForm.control}
            name="equipment_type_id"
            render={({ field }) => (
              <CatalogSelect
                label="Tipo"
                resource="equipment-types"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <Field label="Status">
            <Select {...equipmentForm.register("status")}>
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
              <option value="under_maintenance">Em manutencao</option>
              <option value="retired">Baixado</option>
            </Select>
          </Field>
          <Field label="Fabricante">
            <Input {...equipmentForm.register("manufacturer")} />
          </Field>
          <Field label="Modelo">
            <Input {...equipmentForm.register("model")} />
          </Field>
          <Field label="Serial">
            <Input {...equipmentForm.register("serial_number")} />
          </Field>
          <Field label="Patrimonio">
            <Input {...equipmentForm.register("asset_tag")} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Sistema operacional">
              <Input {...equipmentForm.register("operating_system")} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Observacoes">
              <Textarea {...equipmentForm.register("notes")} />
            </Field>
          </div>
          {addEquipment.error ? (
            <div className="sm:col-span-2">
              <Notice tone="danger">{errorMessage(addEquipment.error)}</Notice>
            </div>
          ) : null}
          <DialogActions
            pending={addEquipment.isPending}
            submitLabel="Salvar equipamento"
            onClose={onClose}
          />
        </form>
      </Modal>

      <Modal
        open={modal === "agreement"}
        title="Tornar cliente mensalista"
        description="Crie um contrato recorrente sem alterar o cadastro base do cliente."
        onClose={onClose}
      >
        <form
          className="space-y-4"
          onSubmit={agreementForm.handleSubmit((data) =>
            createAgreement.mutate(data),
          )}
        >
          <Field
            label="Nome do contrato"
            required
            error={agreementForm.formState.errors.name?.message}
          >
            <Input {...agreementForm.register("name")} />
          </Field>
          <Field label="Descricao">
            <Textarea {...agreementForm.register("description")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Valor mensal"
              required
              error={agreementForm.formState.errors.amount?.message}
            >
              <Input
                inputMode="decimal"
                {...agreementForm.register("amount")}
              />
            </Field>
            <Field
              label="Dia de vencimento"
              required
              error={agreementForm.formState.errors.billing_day?.message}
            >
              <Input
                max={31}
                min={1}
                type="number"
                {...agreementForm.register("billing_day")}
              />
            </Field>
          </div>
          <Field
            label="Inicio"
            required
            error={agreementForm.formState.errors.starts_on?.message}
          >
            <Input type="date" {...agreementForm.register("starts_on")} />
          </Field>
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] p-4">
            <div className="font-medium text-[var(--text)]">
              Primeira mensalidade
            </div>
            <div className="mt-3 space-y-3">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  className="mt-1"
                  type="radio"
                  value="receive_now"
                  {...agreementForm.register("first_billing_mode")}
                />
                <span>
                  <strong className="block text-sm">Receber agora</strong>
                  <span className="text-xs text-[var(--text-muted)]">
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
                  {...agreementForm.register("first_billing_mode")}
                />
                <span>
                  <strong className="block text-sm">
                    Cobrar no proximo mes
                  </strong>
                  <span className="text-xs text-[var(--text-muted)]">
                    Nao gera cobranca no mes atual; o primeiro vencimento segue
                    o dia cadastrado no proximo mes.
                  </span>
                </span>
              </label>
            </div>
          </div>
          {firstBillingMode === "receive_now" ? (
            <Field
              label="Metodo de pagamento da primeira mensalidade"
              required
              error={
                agreementForm.formState.errors.first_payment_method?.message
              }
            >
              <Select {...agreementForm.register("first_payment_method")}>
                <option value="">Selecione</option>
                {(paymentMethods.data?.results ?? []).map((method) => (
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
          {createAgreement.error ? (
            <Notice tone="danger">{errorMessage(createAgreement.error)}</Notice>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button disabled={createAgreement.isPending} type="submit">
              Criar contrato
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={modal === "payment"}
        title="Registrar pagamento"
        description="Baixa contextual sem precisar abrir o Financeiro consolidado."
        onClose={onClose}
      >
        <div className="space-y-4">
          <Field label="Conta a receber" required>
            <Select
              value={selectedReceivable}
              onChange={(event) => {
                const value = event.target.value;
                setSelectedReceivable(value);
                const row = openReceivables.find(
                  (candidate) => candidate.id === value,
                );
                setPaymentAmount(row?.balance ?? "");
              }}
            >
              <option value="">Selecione</option>
              {openReceivables.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.description} · {formatMoney(row.balance)}
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
          <Field label="Metodo de pagamento" required>
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
            <Button type="button" variant="secondary" onClick={onClose}>
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
    </>
  );
}

function DialogActions({
  pending,
  submitLabel,
  onClose,
}: {
  pending: boolean;
  submitLabel: string;
  onClose: () => void;
}) {
  return (
    <div className="flex justify-end gap-2 sm:col-span-2">
      <Button type="button" variant="secondary" onClick={onClose}>
        Cancelar
      </Button>
      <Button disabled={pending} type="submit">
        {submitLabel}
      </Button>
    </div>
  );
}
