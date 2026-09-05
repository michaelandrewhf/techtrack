import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { equipmentApi } from "../../../api/endpoints";
import type { Equipment, EquipmentComponent } from "../../../api/types";
import { CatalogSelect } from "../../../components/CatalogSelect";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { DataTable } from "../../../components/DataTable";
import { Button, Field, Input, Notice, Panel, Textarea } from "../../../components/ui";
import { errorMessage } from "../../../utils/errors";
import { formatDate } from "../../../utils/format";

const componentSchema = z.object({
  component_type_id: z.string().min(1, "Selecione o tipo."),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serial_number: z.string().optional(),
  capacity: z.string().optional(),
  installed_at: z.string().optional(),
  notes: z.string().optional(),
});

type ComponentForm = z.infer<typeof componentSchema>;

export function EquipmentComponents({
  equipment,
  onChanged,
}: {
  equipment: Equipment;
  onChanged: () => Promise<void> | void;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const form = useForm<ComponentForm>({ resolver: zodResolver(componentSchema) });

  const addComponent = useMutation({
    mutationFn: (data: ComponentForm) => equipmentApi.addComponent(equipment.id, data),
    onSuccess: async () => {
      form.reset();
      setFormOpen(false);
      await onChanged();
    },
  });

  const removeComponent = useMutation({
    mutationFn: (componentId: string) =>
      equipmentApi.removeComponent(equipment.id, componentId),
    onSuccess: onChanged,
  });

  return (
    <Panel
      title="Componentes"
      subtitle="Configuracao atual do equipamento, preservando historico de remocoes."
      action={
        <Button
          size="sm"
          type="button"
          variant="secondary"
          onClick={() => setFormOpen((value) => !value)}
        >
          <Plus className="h-4 w-4" />
          Adicionar
        </Button>
      }
    >
      {formOpen ? (
        <form
          className="mb-5 grid gap-3 rounded-[var(--radius-lg)] bg-[var(--surface-subtle)] p-4 sm:grid-cols-2"
          onSubmit={form.handleSubmit((data) => addComponent.mutate(data))}
        >
          <Controller
            control={form.control}
            name="component_type_id"
            render={({ field }) => (
              <CatalogSelect
                label="Tipo"
                resource="component-types"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <Field label="Fabricante">
            <Input {...form.register("manufacturer")} />
          </Field>
          <Field label="Modelo">
            <Input {...form.register("model")} />
          </Field>
          <Field label="Capacidade">
            <Input {...form.register("capacity")} />
          </Field>
          <Field label="Serial">
            <Input {...form.register("serial_number")} />
          </Field>
          <Field label="Instalado em">
            <Input type="date" {...form.register("installed_at")} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notas">
              <Textarea {...form.register("notes")} />
            </Field>
          </div>
          {addComponent.error ? (
            <div className="sm:col-span-2">
              <Notice tone="danger">{errorMessage(addComponent.error)}</Notice>
            </div>
          ) : null}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={addComponent.isPending} type="submit">
              Salvar componente
            </Button>
          </div>
        </form>
      ) : null}

      <DataTable<EquipmentComponent>
        empty="Nenhum componente atual."
        getRowKey={(row) => row.id}
        rows={equipment.current_components ?? []}
        columns={[
          { header: "Tipo", cell: (row) => row.component_type.name },
          {
            header: "Descricao",
            cell: (row) =>
              [row.manufacturer, row.model, row.capacity].filter(Boolean).join(" ") || "-",
          },
          { header: "Serial", cell: (row) => row.serial_number || "-" },
          { header: "Instalado", cell: (row) => formatDate(row.installed_at) },
          {
            header: "Acao",
            cell: (row) => (
              <ConfirmDialog
                title="Remover componente"
                description="O componente sera marcado como removido sem excluir o historico."
                confirmLabel="Remover"
                onConfirm={() => removeComponent.mutate(row.id)}
              >
                <Button size="sm" variant="ghost" type="button">
                  Remover
                </Button>
              </ConfirmDialog>
            ),
          },
        ]}
      />
    </Panel>
  );
}
