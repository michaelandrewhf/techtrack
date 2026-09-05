import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { equipmentApi } from "../../../api/endpoints";
import type { Equipment } from "../../../api/types";
import { Modal } from "../../../components/Modal";
import { Button, Field, Input, Notice, Select, Textarea } from "../../../components/ui";
import { errorMessage } from "../../../utils/errors";

const editSchema = z.object({
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serial_number: z.string().optional(),
  asset_tag: z.string().optional(),
  operating_system: z.string().optional(),
  status: z.string().min(1),
  notes: z.string().optional(),
});

type EditForm = z.input<typeof editSchema>;

export function EquipmentEditDialog({
  equipment,
  open,
  onClose,
  onChanged,
}: {
  equipment: Equipment;
  open: boolean;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const form = useForm<EditForm>({ resolver: zodResolver(editSchema) });

  useEffect(() => {
    if (!open) return;
    form.reset({
      manufacturer: equipment.manufacturer,
      model: equipment.model,
      serial_number: equipment.serial_number,
      asset_tag: equipment.asset_tag,
      operating_system: equipment.operating_system ?? "",
      status: equipment.status,
      notes: equipment.notes ?? "",
    });
  }, [equipment, form, open]);

  const updateEquipment = useMutation({
    mutationFn: (data: EditForm) => equipmentApi.update(equipment.id, data),
    onSuccess: async () => {
      onClose();
      await onChanged();
    },
  });

  return (
    <Modal
      open={open}
      title="Editar equipamento"
      description="Atualize os dados do patrimonio sem sair do historico tecnico."
      size="lg"
      onClose={onClose}
    >
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={form.handleSubmit((data) => updateEquipment.mutate(data))}
      >
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
        <Field label="Sistema operacional">
          <Input {...form.register("operating_system")} />
        </Field>
        <Field label="Status">
          <Select {...form.register("status")}>
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
            <option value="under_maintenance">Em manutencao</option>
            <option value="retired">Baixado</option>
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Observacoes">
            <Textarea {...form.register("notes")} />
          </Field>
        </div>
        {updateEquipment.error ? (
          <div className="sm:col-span-2">
            <Notice tone="danger">{errorMessage(updateEquipment.error)}</Notice>
          </div>
        ) : null}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={updateEquipment.isPending} type="submit">
            Salvar alteracoes
          </Button>
        </div>
      </form>
    </Modal>
  );
}
