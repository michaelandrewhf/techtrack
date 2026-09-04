import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, FileText, Pencil, Plus } from "lucide-react";
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
import { Breadcrumbs } from "../components/Breadcrumbs";
import { CatalogSelect } from "../components/CatalogSelect";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DataTable } from "../components/DataTable";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { ErrorState, PageLoader } from "../components/State";
import {
  Badge,
  Button,
  DescriptionList,
  Field,
  Input,
  Notice,
  Panel,
  Select,
  Textarea,
} from "../components/ui";
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

const editSchema = z.object({
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serial_number: z.string().optional(),
  asset_tag: z.string().optional(),
  operating_system: z.string().optional(),
  status: z.string().min(1),
  notes: z.string().optional(),
});

type ComponentForm = z.infer<typeof componentSchema>;
type EditForm = z.input<typeof editSchema>;

function maintenanceTone(status: MaintenanceItem["status"]) {
  if (status === "overdue") return "danger" as const;
  if (status === "upcoming") return "warning" as const;
  if (status === "ok") return "success" as const;
  return "neutral" as const;
}

function maintenanceLabel(status: MaintenanceItem["status"]) {
  return (
    {
      overdue: "Vencida",
      upcoming: "Proxima",
      ok: "Em dia",
      never_performed: "Nunca realizada",
    }[status] ?? status
  );
}

export function EquipmentDetailPage() {
  const { id = "" } = useParams();
  const [showComponentForm, setShowComponentForm] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const queryClient = useQueryClient();
  const equipment = useQuery({
    queryKey: queryKeys.equipmentDetail(id),
    queryFn: () => equipmentApi.get(id),
  });
  const maintenance = useQuery({
    queryKey: queryKeys.maintenance(id),
    queryFn: () => equipmentApi.maintenance(id),
  });
  const componentForm = useForm<ComponentForm>({
    resolver: zodResolver(componentSchema),
  });
  const editForm = useForm<EditForm>({
    resolver: zodResolver(editSchema),
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.equipmentDetail(id),
      }),
      queryClient.invalidateQueries({ queryKey: ["equipment"] }),
      queryClient.invalidateQueries({ queryKey: ["customers"] }),
    ]);
  };

  const addComponent = useMutation({
    mutationFn: (data: ComponentForm) => equipmentApi.addComponent(id, data),
    onSuccess: async () => {
      componentForm.reset();
      setShowComponentForm(false);
      await invalidate();
    },
  });
  const removeComponent = useMutation({
    mutationFn: (componentId: string) =>
      equipmentApi.removeComponent(id, componentId),
    onSuccess: invalidate,
  });
  const updateEquipment = useMutation({
    mutationFn: (data: EditForm) => equipmentApi.update(id, data),
    onSuccess: async () => {
      setEditOpen(false);
      await invalidate();
    },
  });

  if (equipment.isLoading) return <PageLoader />;
  if (equipment.error || !equipment.data)
    return <ErrorState message="Equipamento nao encontrado." />;

  const item = equipment.data;
  const equipmentName =
    [item.manufacturer, item.model].filter(Boolean).join(" ") ||
    item.equipment_type.name;

  const openEdit = () => {
    editForm.reset({
      manufacturer: item.manufacturer,
      model: item.model,
      serial_number: item.serial_number,
      asset_tag: item.asset_tag,
      operating_system: item.operating_system ?? "",
      status: item.status,
      notes: item.notes ?? "",
    });
    setEditOpen(true);
  };

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Clientes", to: "/customers" },
          {
            label: item.customer.name,
            to: `/customers/${item.customer.id}?tab=equipment`,
          },
          { label: equipmentName },
        ]}
      />
      <PageHeader
        eyebrow={item.equipment_type.name}
        title={equipmentName}
        description={`Patrimonio tecnico de ${item.customer.name}.`}
        meta={
          <Badge tone={item.status === "active" ? "success" : "neutral"}>
            {item.status}
          </Badge>
        }
        action={
          <>
            <Link
              to={`/work-orders/new?customer=${item.customer.id}&equipment=${item.id}`}
            >
              <Button type="button">
                <ClipboardList className="h-4 w-4" />
                Abrir OS
              </Button>
            </Link>
            <Link
              to={`/quotes/new?customer=${item.customer.id}&equipment=${item.id}`}
            >
              <Button type="button" variant="secondary">
                <FileText className="h-4 w-4" />
                Orcamento
              </Button>
            </Link>
            <Button type="button" variant="ghost" onClick={openEdit}>
              <Pencil className="h-4 w-4" />
              Editar
            </Button>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <Panel title="Dados do equipamento">
          <DescriptionList
            items={[
              {
                label: "Cliente",
                value: (
                  <Link
                    className="text-blue-600"
                    to={`/customers/${item.customer.id}`}
                  >
                    {item.customer.name}
                  </Link>
                ),
              },
              { label: "Tipo", value: item.equipment_type.name },
              { label: "Serial", value: item.serial_number || "-" },
              { label: "Patrimonio", value: item.asset_tag || "-" },
              { label: "Sistema", value: item.operating_system || "-" },
              { label: "Status", value: item.status },
              { label: "Observacoes", value: item.notes || "Sem observacoes." },
            ]}
          />
        </Panel>

        <Panel
          title="Manutencao preventiva"
          subtitle="Prazos derivados do historico real de servicos concluidos."
        >
          {maintenance.isLoading ? <PageLoader /> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            {(maintenance.data ?? []).map((row) => (
              <div
                className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
                key={row.service_type.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="font-medium text-slate-950 dark:text-white">
                    {row.service_type.name}
                  </div>
                  <Badge tone={maintenanceTone(row.status)}>
                    {maintenanceLabel(row.status)}
                  </Badge>
                </div>
                <dl className="mt-3 grid gap-2 text-sm text-slate-500 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs uppercase tracking-wide">Ultima</dt>
                    <dd>{formatDateTime(row.last_performed_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide">Proxima</dt>
                    <dd>{formatDateTime(row.next_due_at)}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs uppercase tracking-wide">
                      Intervalo recomendado
                    </dt>
                    <dd>
                      {row.recommended_interval_value ?? "-"}{" "}
                      {row.recommended_interval_unit}
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
            {!maintenance.isLoading && !maintenance.data?.length ? (
              <p className="text-sm text-slate-500">
                Nenhuma regra preventiva aplicavel a este equipamento.
              </p>
            ) : null}
          </div>
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Panel
          title="Componentes"
          subtitle="Configuracao atual do equipamento, preservando historico de remocoes."
          action={
            <Button
              size="sm"
              type="button"
              variant="secondary"
              onClick={() => setShowComponentForm((value) => !value)}
            >
              <Plus className="h-4 w-4" />
              Adicionar
            </Button>
          }
        >
          {showComponentForm ? (
            <form
              className="mb-5 grid gap-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-950 sm:grid-cols-2"
              onSubmit={componentForm.handleSubmit((data) =>
                addComponent.mutate(data),
              )}
            >
              <Controller
                control={componentForm.control}
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
                <Input {...componentForm.register("manufacturer")} />
              </Field>
              <Field label="Modelo">
                <Input {...componentForm.register("model")} />
              </Field>
              <Field label="Capacidade">
                <Input {...componentForm.register("capacity")} />
              </Field>
              <Field label="Serial">
                <Input {...componentForm.register("serial_number")} />
              </Field>
              <Field label="Instalado em">
                <Input
                  type="date"
                  {...componentForm.register("installed_at")}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Notas">
                  <Textarea {...componentForm.register("notes")} />
                </Field>
              </div>
              {addComponent.error ? (
                <div className="sm:col-span-2">
                  <Notice tone="danger">
                    {errorMessage(addComponent.error)}
                  </Notice>
                </div>
              ) : null}
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowComponentForm(false)}
                >
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

        <Panel
          title="Ordens de servico"
          subtitle="Atendimentos recentes deste equipamento."
          action={
            <Link
              to={`/work-orders/new?customer=${item.customer.id}&equipment=${item.id}`}
            >
              <Button size="sm" type="button">
                <Plus className="h-4 w-4" />
                Nova OS
              </Button>
            </Link>
          }
        >
          <DataTable<WorkOrder>
            empty="Nenhuma OS para este equipamento."
            getRowKey={(row) => row.id}
            rows={item.recent_work_orders ?? []}
            columns={[
              {
                header: "OS",
                cell: (row) => (
                  <Link
                    className="font-semibold text-blue-700 dark:text-blue-300"
                    to={`/work-orders/${row.id}`}
                  >
                    {row.display_number}
                  </Link>
                ),
              },
              { header: "Titulo", cell: (row) => row.title },
              {
                header: "Status",
                cell: (row) => <Badge>{row.status.name}</Badge>,
              },
              {
                header: "Abertura",
                cell: (row) => formatDateTime(row.opened_at),
              },
            ]}
          />
        </Panel>
      </div>

      <Modal
        open={editOpen}
        title="Editar equipamento"
        description="Atualize os dados do patrimonio sem sair do historico tecnico."
        size="lg"
        onClose={() => setEditOpen(false)}
      >
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={editForm.handleSubmit((data) =>
            updateEquipment.mutate(data),
          )}
        >
          <Field label="Fabricante">
            <Input {...editForm.register("manufacturer")} />
          </Field>
          <Field label="Modelo">
            <Input {...editForm.register("model")} />
          </Field>
          <Field label="Serial">
            <Input {...editForm.register("serial_number")} />
          </Field>
          <Field label="Patrimonio">
            <Input {...editForm.register("asset_tag")} />
          </Field>
          <Field label="Sistema operacional">
            <Input {...editForm.register("operating_system")} />
          </Field>
          <Field label="Status">
            <Select {...editForm.register("status")}>
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
              <option value="under_maintenance">Em manutencao</option>
              <option value="retired">Baixado</option>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Observacoes">
              <Textarea {...editForm.register("notes")} />
            </Field>
          </div>
          {updateEquipment.error ? (
            <div className="sm:col-span-2">
              <Notice tone="danger">
                {errorMessage(updateEquipment.error)}
              </Notice>
            </div>
          ) : null}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditOpen(false)}
            >
              Cancelar
            </Button>
            <Button disabled={updateEquipment.isPending} type="submit">
              Salvar alteracoes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
