import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link, useParams } from "react-router-dom";
import { z } from "zod";

import { equipmentApi } from "../api/endpoints";
import { queryKeys } from "../api/queryKeys";
import type {
  EquipmentComponent,
  MaintenanceItem,
  WorkOrder,
} from "../api/types";
import { CatalogSelect } from "../components/CatalogSelect";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DataTable } from "../components/DataTable";
import { PageHeader } from "../components/PageHeader";
import { ErrorState, PageLoader } from "../components/State";
import { Badge, Button, Field, Input, Panel, Textarea } from "../components/ui";
import { errorMessage } from "../utils/errors";
import { formatDate, formatDateTime } from "../utils/format";

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

function maintenanceTone(status: MaintenanceItem["status"]) {
  if (status === "overdue") return "danger";
  if (status === "upcoming") return "warning";
  if (status === "ok") return "success";
  return "neutral";
}

export function EquipmentDetailPage() {
  const { id = "" } = useParams();
  const [showComponentForm, setShowComponentForm] = useState(false);
  const queryClient = useQueryClient();
  const equipment = useQuery({
    queryKey: queryKeys.equipmentDetail(id),
    queryFn: () => equipmentApi.get(id),
  });
  const maintenance = useQuery({
    queryKey: queryKeys.maintenance(id),
    queryFn: () => equipmentApi.maintenance(id),
  });
  const form = useForm<ComponentForm>({
    resolver: zodResolver(componentSchema),
  });
  const addComponent = useMutation({
    mutationFn: (data: ComponentForm) => equipmentApi.addComponent(id, data),
    onSuccess: async () => {
      form.reset();
      setShowComponentForm(false);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.equipmentDetail(id),
      });
    },
  });
  const removeComponent = useMutation({
    mutationFn: (componentId: string) =>
      equipmentApi.removeComponent(id, componentId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.equipmentDetail(id),
      }),
  });

  if (equipment.isLoading) return <PageLoader />;
  if (equipment.error || !equipment.data)
    return <ErrorState message="Equipamento nao encontrado." />;

  const item = equipment.data;
  return (
    <div>
      <PageHeader
        action={
          <Link
            to={`/work-orders/new?customer=${item.customer.id}&equipment=${item.id}`}
          >
            <Button type="button">Abrir OS</Button>
          </Link>
        }
        title={
          [item.manufacturer, item.model].filter(Boolean).join(" ") ||
          item.equipment_type.name
        }
        description={`${item.customer.name} - ${item.equipment_type.name}`}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Dados gerais">
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-slate-500">Serial</dt>
              <dd>{item.serial_number || "-"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Patrimonio</dt>
              <dd>{item.asset_tag || "-"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Sistema</dt>
              <dd>{item.operating_system || "-"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd>
                <Badge>{item.status}</Badge>
              </dd>
            </div>
          </dl>
        </Panel>
        <div className="lg:col-span-2">
          <Panel title="Manutencao preventiva">
            {maintenance.isLoading ? <PageLoader /> : null}
            <div className="grid gap-3 md:grid-cols-2">
              {(maintenance.data ?? []).map((row) => (
                <div
                  className="rounded-md border border-slate-200 p-3 dark:border-slate-800"
                  key={row.service_type.id}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-slate-950 dark:text-white">
                      {row.service_type.name}
                    </div>
                    <Badge tone={maintenanceTone(row.status)}>
                      {row.status}
                    </Badge>
                  </div>
                  <div className="mt-2 text-sm text-slate-500">
                    Ultima: {formatDateTime(row.last_performed_at)}
                    <br />
                    Intervalo: {row.recommended_interval_value ?? "-"}{" "}
                    {row.recommended_interval_unit}
                    <br />
                    Proxima: {formatDateTime(row.next_due_at)}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title="Componentes">
          <div className="mb-3">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setShowComponentForm((value) => !value)}
            >
              <Plus className="h-4 w-4" />
              Adicionar componente
            </Button>
          </div>
          {showComponentForm ? (
            <form
              className="mb-4 grid gap-3 md:grid-cols-2"
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
              <div className="md:col-span-2">
                <Field label="Notas">
                  <Textarea {...form.register("notes")} />
                </Field>
              </div>
              {addComponent.error ? (
                <p className="text-sm text-red-600 md:col-span-2">
                  {errorMessage(addComponent.error)}
                </p>
              ) : null}
              <div className="md:col-span-2">
                <Button disabled={addComponent.isPending} type="submit">
                  Salvar componente
                </Button>
              </div>
            </form>
          ) : null}
          <DataTable<EquipmentComponent>
            empty="Nenhum componente atual."
            rows={item.current_components ?? []}
            columns={[
              { header: "Tipo", cell: (row) => row.component_type.name },
              {
                header: "Descricao",
                cell: (row) =>
                  [row.manufacturer, row.model, row.capacity]
                    .filter(Boolean)
                    .join(" ") || "-",
              },
              { header: "Serial", cell: (row) => row.serial_number || "-" },
              {
                header: "Instalado",
                cell: (row) => formatDate(row.installed_at),
              },
              {
                header: "Acao",
                cell: (row) => (
                  <ConfirmDialog
                    title="Remover componente"
                    description="O componente sera marcado como removido, sem exclusao fisica."
                    confirmLabel="Remover"
                    onConfirm={() => removeComponent.mutate(row.id)}
                  >
                    <Button variant="secondary" type="button">
                      Remover
                    </Button>
                  </ConfirmDialog>
                ),
              },
            ]}
          />
        </Panel>
        <Panel title="Ordens de Servico">
          <DataTable<WorkOrder>
            empty="Nenhuma OS para este equipamento."
            rows={item.recent_work_orders ?? []}
            columns={[
              {
                header: "OS",
                cell: (row) => (
                  <Link
                    className="text-blue-700 dark:text-blue-300"
                    to={`/work-orders/${row.id}`}
                  >
                    {row.display_number}
                  </Link>
                ),
              },
              { header: "Titulo", cell: (row) => row.title },
              { header: "Status", cell: (row) => row.status.name },
              {
                header: "Abertura",
                cell: (row) => formatDateTime(row.opened_at),
              },
            ]}
          />
        </Panel>
      </div>
    </div>
  );
}
