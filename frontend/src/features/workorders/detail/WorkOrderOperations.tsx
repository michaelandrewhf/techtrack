import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { workOrdersApi } from "../../../api/endpoints";
import type {
  WorkOrder,
  WorkOrderPart,
  WorkOrderService,
} from "../../../api/types";
import { CatalogSelect } from "../../../components/CatalogSelect";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { DataTable } from "../../../components/DataTable";
import {
  Badge,
  Button,
  Field,
  Input,
  Notice,
  Panel,
  Textarea,
} from "../../../components/ui";
import { errorMessage } from "../../../utils/errors";
import { formatDateTime, formatMoney } from "../../../utils/format";

const serviceSchema = z.object({
  service_type_id: z.string().min(1, "Selecione o servico."),
  performed_at: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  labor_price: z.string().optional(),
});

const partSchema = z.object({
  description: z.string().min(1, "Informe a descricao."),
  quantity: z.string().min(1, "Informe a quantidade."),
  unit_cost: z.string().optional(),
  unit_price: z.string().optional(),
  serial_number: z.string().optional(),
  warranty_until: z.string().optional(),
});

type ServiceForm = z.infer<typeof serviceSchema>;
type PartForm = z.infer<typeof partSchema>;

export function WorkOrderOperations({
  workOrder,
  onChanged,
}: {
  workOrder: WorkOrder;
  onChanged: () => Promise<void> | void;
}) {
  const isClosed = workOrder.status.kind !== "active";
  const [serviceFormOpen, setServiceFormOpen] = useState(false);
  const [partFormOpen, setPartFormOpen] = useState(false);

  const serviceForm = useForm<ServiceForm>({
    resolver: zodResolver(serviceSchema),
  });
  const partForm = useForm<PartForm>({
    resolver: zodResolver(partSchema),
    defaultValues: { quantity: "1.00" },
  });

  const addService = useMutation({
    mutationFn: (data: ServiceForm) =>
      workOrdersApi.addService(workOrder.id, data),
    onSuccess: async () => {
      serviceForm.reset();
      setServiceFormOpen(false);
      await onChanged();
    },
  });
  const addPart = useMutation({
    mutationFn: (data: PartForm) => workOrdersApi.addPart(workOrder.id, data),
    onSuccess: async () => {
      partForm.reset({ quantity: "1.00" });
      setPartFormOpen(false);
      await onChanged();
    },
  });
  const voidService = useMutation({
    mutationFn: (serviceId: string) =>
      workOrdersApi.voidService(
        workOrder.id,
        serviceId,
        "Invalidado pelo painel.",
      ),
    onSuccess: onChanged,
  });
  const voidPart = useMutation({
    mutationFn: (partId: string) =>
      workOrdersApi.voidPart(workOrder.id, partId, "Invalidado pelo painel."),
    onSuccess: onChanged,
  });

  return (
    <div className="mt-5 grid gap-5 xl:grid-cols-2">
      <Panel
        title="Servicos realizados"
        subtitle="Lancamentos tecnicos que alimentam historico e manutencao preventiva."
        action={
          !isClosed ? (
            <Button
              size="sm"
              type="button"
              onClick={() => setServiceFormOpen((value) => !value)}
            >
              <Plus className="h-4 w-4" />
              Adicionar
            </Button>
          ) : undefined
        }
      >
        {serviceFormOpen ? (
          <form
            className="mb-5 grid gap-3 rounded-[var(--radius-lg)] bg-[var(--surface-subtle)] p-4 md:grid-cols-2"
            onSubmit={serviceForm.handleSubmit((data) =>
              addService.mutate(data),
            )}
          >
            <Controller
              control={serviceForm.control}
              name="service_type_id"
              render={({ field }) => (
                <CatalogSelect
                  label="Servico"
                  resource="service-types"
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            <Field label="Valor">
              <Input
                inputMode="decimal"
                {...serviceForm.register("labor_price")}
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Descricao">
                <Textarea {...serviceForm.register("description")} />
              </Field>
            </div>
            {addService.error ? (
              <div className="md:col-span-2">
                <Notice tone="danger">{errorMessage(addService.error)}</Notice>
              </div>
            ) : null}
            <div className="flex justify-end gap-2 md:col-span-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setServiceFormOpen(false)}
              >
                Cancelar
              </Button>
              <Button disabled={addService.isPending} type="submit">
                Salvar servico
              </Button>
            </div>
          </form>
        ) : null}

        <DataTable<WorkOrderService>
          empty="Nenhum servico registrado."
          getRowKey={(row) => row.id}
          rows={workOrder.services ?? []}
          columns={[
            { header: "Servico", cell: (row) => row.service_type.name },
            {
              header: "Data",
              cell: (row) => formatDateTime(row.performed_at),
            },
            { header: "Valor", cell: (row) => formatMoney(row.labor_price) },
            {
              header: "Situacao",
              cell: (row) => (
                <Badge tone={row.voided_at ? "danger" : "success"}>
                  {row.voided_at ? "Invalidado" : "Valido"}
                </Badge>
              ),
            },
            {
              header: "Acao",
              cell: (row) =>
                row.voided_at || isClosed ? (
                  "-"
                ) : (
                  <ConfirmDialog
                    title="Invalidar servico"
                    description="O lancamento sera preservado no historico como invalidado."
                    onConfirm={() => voidService.mutate(row.id)}
                  >
                    <Button size="sm" variant="ghost" type="button">
                      Invalidar
                    </Button>
                  </ConfirmDialog>
                ),
            },
          ]}
        />
      </Panel>

      <Panel
        title="Pecas utilizadas"
        subtitle="Materiais e componentes consumidos no atendimento."
        action={
          !isClosed ? (
            <Button
              size="sm"
              type="button"
              onClick={() => setPartFormOpen((value) => !value)}
            >
              <Plus className="h-4 w-4" />
              Adicionar
            </Button>
          ) : undefined
        }
      >
        {partFormOpen ? (
          <form
            className="mb-5 grid gap-3 rounded-[var(--radius-lg)] bg-[var(--surface-subtle)] p-4 md:grid-cols-2"
            onSubmit={partForm.handleSubmit((data) => addPart.mutate(data))}
          >
            <Field
              label="Descricao"
              error={partForm.formState.errors.description?.message}
            >
              <Input {...partForm.register("description")} />
            </Field>
            <Field label="Quantidade">
              <Input inputMode="decimal" {...partForm.register("quantity")} />
            </Field>
            <Field label="Custo">
              <Input inputMode="decimal" {...partForm.register("unit_cost")} />
            </Field>
            <Field label="Preco">
              <Input inputMode="decimal" {...partForm.register("unit_price")} />
            </Field>
            <Field label="Serial">
              <Input {...partForm.register("serial_number")} />
            </Field>
            <Field label="Garantia ate">
              <Input type="date" {...partForm.register("warranty_until")} />
            </Field>
            {addPart.error ? (
              <div className="md:col-span-2">
                <Notice tone="danger">{errorMessage(addPart.error)}</Notice>
              </div>
            ) : null}
            <div className="flex justify-end gap-2 md:col-span-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setPartFormOpen(false)}
              >
                Cancelar
              </Button>
              <Button disabled={addPart.isPending} type="submit">
                Salvar peca
              </Button>
            </div>
          </form>
        ) : null}

        <DataTable<WorkOrderPart>
          empty="Nenhuma peca registrada."
          getRowKey={(row) => row.id}
          rows={workOrder.parts ?? []}
          columns={[
            { header: "Descricao", cell: (row) => row.description },
            { header: "Qtd.", cell: (row) => row.quantity },
            { header: "Preco", cell: (row) => formatMoney(row.unit_price) },
            {
              header: "Situacao",
              cell: (row) => (
                <Badge tone={row.voided_at ? "danger" : "success"}>
                  {row.voided_at ? "Invalidada" : "Valida"}
                </Badge>
              ),
            },
            {
              header: "Acao",
              cell: (row) =>
                row.voided_at || isClosed ? (
                  "-"
                ) : (
                  <ConfirmDialog
                    title="Invalidar peca"
                    description="O lancamento sera preservado no historico como invalidado."
                    onConfirm={() => voidPart.mutate(row.id)}
                  >
                    <Button size="sm" variant="ghost" type="button">
                      Invalidar
                    </Button>
                  </ConfirmDialog>
                ),
            },
          ]}
        />
      </Panel>
    </div>
  );
}
