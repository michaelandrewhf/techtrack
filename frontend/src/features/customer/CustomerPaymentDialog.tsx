import type { CatalogItem, Receivable } from "../../api/types";
import { Modal } from "../../components/Modal";
import { Button, Field, Input, Notice, Select } from "../../components/ui";
import { errorMessage } from "../../utils/errors";
import { formatMoney } from "../../utils/format";

export function CustomerPaymentDialog({
  open,
  openReceivables,
  paymentMethods,
  selectedReceivable,
  paymentAmount,
  paymentMethod,
  pending,
  error,
  onSelectedReceivableChange,
  onPaymentAmountChange,
  onPaymentMethodChange,
  onSubmit,
  onClose,
}: {
  open: boolean;
  openReceivables: Receivable[];
  paymentMethods: CatalogItem[];
  selectedReceivable: string;
  paymentAmount: string;
  paymentMethod: string;
  pending: boolean;
  error: unknown;
  onSelectedReceivableChange: (value: string) => void;
  onPaymentAmountChange: (value: string) => void;
  onPaymentMethodChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      title="Registrar pagamento"
      description="Baixa contextual sem precisar abrir o Financeiro consolidado."
      onClose={onClose}
    >
      <div className="space-y-4">
        <Field label="Conta a receber" required>
          <Select
            value={selectedReceivable}
            onChange={(event) => onSelectedReceivableChange(event.target.value)}
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
            onChange={(event) => onPaymentAmountChange(event.target.value)}
          />
        </Field>
        <Field label="Metodo de pagamento" required>
          <Select
            value={paymentMethod}
            onChange={(event) => onPaymentMethodChange(event.target.value)}
          >
            <option value="">Selecione</option>
            {paymentMethods.map((method) => (
              <option key={method.id} value={method.id}>
                {method.name}
              </option>
            ))}
          </Select>
        </Field>
        {error ? <Notice tone="danger">{errorMessage(error)}</Notice> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={
              !selectedReceivable || !paymentAmount || !paymentMethod || pending
            }
            type="button"
            onClick={onSubmit}
          >
            Registrar pagamento
          </Button>
        </div>
      </div>
    </Modal>
  );
}
