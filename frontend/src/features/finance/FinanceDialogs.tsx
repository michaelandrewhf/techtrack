import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { catalogApi, financeApi } from "../../api/endpoints";
import {
  CustomerCombobox,
  ReceivableCombobox,
} from "../../components/EntityComboboxes";
import { Modal } from "../../components/Modal";
import { Button, Field, Input, Notice, Select } from "../../components/ui";
import { errorMessage } from "../../utils/errors";

export function FinanceDialogs({
  paymentOpen,
  agreementOpen,
  onClosePayment,
  onCloseAgreement,
  onChanged,
}: {
  paymentOpen: boolean;
  agreementOpen: boolean;
  onClosePayment: () => void;
  onCloseAgreement: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const [selectedReceivable, setSelectedReceivable] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [agreementCustomer, setAgreementCustomer] = useState("");
  const [agreementName, setAgreementName] = useState("Suporte mensal");
  const [agreementAmount, setAgreementAmount] = useState("");
  const [agreementDay, setAgreementDay] = useState("10");
  const [agreementStart, setAgreementStart] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [agreementBillingMode, setAgreementBillingMode] = useState<
    "receive_now" | "next_month"
  >("next_month");
  const [agreementPaymentMethod, setAgreementPaymentMethod] = useState("");

  const paymentMethods = useQuery({
    queryKey: ["catalog", "payment-methods", "finance"],
    queryFn: () =>
      catalogApi("payment-methods").list({ is_active: true, page_size: 100 }),
    enabled: paymentOpen || agreementOpen,
  });

  useEffect(() => {
    if (paymentOpen) return;
    setSelectedReceivable("");
    setPaymentAmount("");
    setPaymentMethod("");
  }, [paymentOpen]);

  useEffect(() => {
    if (agreementOpen) return;
    setAgreementCustomer("");
    setAgreementName("Suporte mensal");
    setAgreementAmount("");
    setAgreementDay("10");
    setAgreementStart(new Date().toISOString().slice(0, 10));
    setAgreementBillingMode("next_month");
    setAgreementPaymentMethod("");
  }, [agreementOpen]);

  const addPayment = useMutation({
    mutationFn: () =>
      financeApi.addPayment(selectedReceivable, {
        amount: paymentAmount,
        payment_method: paymentMethod,
      }),
    onSuccess: async () => {
      onClosePayment();
      await onChanged();
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
        first_billing_mode: agreementBillingMode,
        first_payment_method:
          agreementBillingMode === "receive_now"
            ? agreementPaymentMethod
            : undefined,
      }),
    onSuccess: async () => {
      onCloseAgreement();
      await onChanged();
    },
  });

  return (
    <>
      <Modal
        open={paymentOpen}
        title="Registrar pagamento"
        description="Busque uma conta em aberto e registre a baixa total ou parcial."
        onClose={onClosePayment}
      >
        <div className="space-y-4">
          <Field label="Conta a receber" required>
            <ReceivableCombobox
              value={selectedReceivable}
              onChange={(value, receivable) => {
                setSelectedReceivable(value);
                setPaymentAmount(receivable?.balance ?? "");
              }}
            />
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
              onClick={onClosePayment}
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
        onClose={onCloseAgreement}
      >
        <div className="space-y-4">
          <Field label="Cliente" required>
            <CustomerCombobox
              value={agreementCustomer}
              onChange={setAgreementCustomer}
            />
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
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] p-4">
            <div className="font-medium text-[var(--text)]">
              Primeira mensalidade
            </div>
            <div className="mt-3 space-y-3">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  className="mt-1"
                  checked={agreementBillingMode === "receive_now"}
                  type="radio"
                  onChange={() => setAgreementBillingMode("receive_now")}
                />
                <span>
                  <strong className="block text-sm">Receber agora</strong>
                  <span className="text-xs text-[var(--text-muted)]">
                    Gera a primeira mensalidade hoje e registra a baixa como
                    paga.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  className="mt-1"
                  checked={agreementBillingMode === "next_month"}
                  type="radio"
                  onChange={() => setAgreementBillingMode("next_month")}
                />
                <span>
                  <strong className="block text-sm">
                    Cobrar no proximo mes
                  </strong>
                  <span className="text-xs text-[var(--text-muted)]">
                    Nao gera cobranca agora; o primeiro vencimento usa o dia
                    cadastrado no proximo mes.
                  </span>
                </span>
              </label>
            </div>
          </div>
          {agreementBillingMode === "receive_now" ? (
            <Field label="Metodo da primeira mensalidade" required>
              <Select
                value={agreementPaymentMethod}
                onChange={(event) =>
                  setAgreementPaymentMethod(event.target.value)
                }
              >
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
            {agreementBillingMode === "receive_now"
              ? "A primeira mensalidade entra como recebida hoje; o ciclo recorrente passa a seguir o vencimento no proximo mes."
              : "A primeira mensalidade sera gerada somente no proximo mes."}
          </Notice>
          {createAgreement.error ? (
            <Notice tone="danger">
              {errorMessage(createAgreement.error)}
            </Notice>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onCloseAgreement}
            >
              Cancelar
            </Button>
            <Button
              disabled={
                !agreementCustomer ||
                !agreementAmount ||
                (agreementBillingMode === "receive_now" &&
                  !agreementPaymentMethod) ||
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
    </>
  );
}
