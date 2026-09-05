import { Controller, type UseFormReturn } from "react-hook-form";

import { CatalogSelect } from "../../components/CatalogSelect";
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
import type { EquipmentForm } from "./detail";

export function CustomerEquipmentDialog({
  open,
  customerName,
  form,
  pending,
  error,
  onSubmit,
  onClose,
}: {
  open: boolean;
  customerName: string;
  form: UseFormReturn<EquipmentForm>;
  pending: boolean;
  error: unknown;
  onSubmit: (data: EquipmentForm) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      title="Adicionar equipamento"
      description={`Novo patrimonio para ${customerName}.`}
      size="lg"
      onClose={onClose}
    >
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <Controller
          control={form.control}
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
          <Select {...form.register("status")}>
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
            <option value="under_maintenance">Em manutencao</option>
            <option value="retired">Baixado</option>
          </Select>
        </Field>
        <Field label="Fabricante">
          <Input {...form.register("manufacturer")} />
        </Field>
        <Field label="Modelo">
          <Input {...form.register("model")} />
        </Field>
        <Field label="Serial">
          <Input {...form.register("serial_number")} />
        </Field>
        <Field label="Patrimonio">
          <Input {...form.register("asset_tag")} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Sistema operacional">
            <Input {...form.register("operating_system")} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Observacoes">
            <Textarea {...form.register("notes")} />
          </Field>
        </div>
        {error ? (
          <div className="sm:col-span-2">
            <Notice tone="danger">{errorMessage(error)}</Notice>
          </div>
        ) : null}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={pending} type="submit">
            Salvar equipamento
          </Button>
        </div>
      </form>
    </Modal>
  );
}
