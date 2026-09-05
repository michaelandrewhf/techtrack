import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { workOrdersApi } from "../../../api/endpoints";
import type { WorkOrder } from "../../../api/types";
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

const technicalSchema = z.object({
  title: z.string().min(1, "Informe o titulo."),
  problem_description: z.string().min(1, "Informe o problema relatado."),
  priority: z.string().min(1),
  diagnosis: z.string().optional(),
  service_description: z.string().optional(),
  solution: z.string().optional(),
  internal_notes: z.string().optional(),
});

type TechnicalForm = z.input<typeof technicalSchema>;

export function WorkOrderTechnicalDialog({
  workOrder,
  open,
  onClose,
  onChanged,
}: {
  workOrder: WorkOrder;
  open: boolean;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const form = useForm<TechnicalForm>({
    resolver: zodResolver(technicalSchema),
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      title: workOrder.title,
      problem_description: workOrder.problem_description ?? "",
      priority: workOrder.priority,
      diagnosis: workOrder.diagnosis ?? "",
      service_description: workOrder.service_description ?? "",
      solution: workOrder.solution ?? "",
      internal_notes: workOrder.internal_notes ?? "",
    });
  }, [form, open, workOrder]);

  const updateTechnical = useMutation({
    mutationFn: (data: TechnicalForm) =>
      workOrdersApi.update(workOrder.id, data),
    onSuccess: async () => {
      onClose();
      await onChanged();
    },
  });

  return (
    <Modal
      open={open}
      title="Editar conteudo tecnico"
      description="Atualize o atendimento sem misturar notas internas com o documento destinado ao cliente."
      size="xl"
      onClose={onClose}
    >
      <form
        className="grid gap-4 md:grid-cols-2"
        onSubmit={form.handleSubmit((data) => updateTechnical.mutate(data))}
      >
        <div className="md:col-span-2">
          <Field
            label="Titulo"
            required
            error={form.formState.errors.title?.message}
          >
            <Input {...form.register("title")} />
          </Field>
        </div>
        <Field label="Prioridade">
          <Select {...form.register("priority")}>
            <option value="low">Baixa</option>
            <option value="normal">Normal</option>
            <option value="high">Alta</option>
            <option value="urgent">Urgente</option>
          </Select>
        </Field>
        <div className="md:col-span-2">
          <Field
            label="Problema relatado"
            required
            error={form.formState.errors.problem_description?.message}
          >
            <Textarea rows={4} {...form.register("problem_description")} />
          </Field>
        </div>
        <Field label="Diagnostico">
          <Textarea rows={5} {...form.register("diagnosis")} />
        </Field>
        <Field label="Servico / execucao">
          <Textarea rows={5} {...form.register("service_description")} />
        </Field>
        <div className="md:col-span-2">
          <Field label="Solucao">
            <Textarea rows={5} {...form.register("solution")} />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field
            label="Notas internas"
            hint="Uso interno. Este campo nao entra no PDF da OS."
          >
            <Textarea rows={4} {...form.register("internal_notes")} />
          </Field>
        </div>
        {updateTechnical.error ? (
          <div className="md:col-span-2">
            <Notice tone="danger">{errorMessage(updateTechnical.error)}</Notice>
          </div>
        ) : null}
        <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4 md:col-span-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={updateTechnical.isPending} type="submit">
            Salvar alteracoes
          </Button>
        </div>
      </form>
    </Modal>
  );
}
