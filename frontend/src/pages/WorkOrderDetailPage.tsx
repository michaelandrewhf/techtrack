import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, CircleX, Download, FileCheck2, Plus } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link, useParams } from "react-router-dom";
import { z } from "zod";

import { saveBlob } from "../api/client";
import { catalogApi, financeApi, workOrdersApi } from "../api/endpoints";
import { queryKeys } from "../api/queryKeys";
import type {
  WorkOrderPart,
  WorkOrderService,
  WorkOrderTimeline,
} from "../api/types";
import { CatalogSelect } from "../components/CatalogSelect";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DataTable } from "../components/DataTable";
import { PageHeader } from "../components/PageHeader";
import { ErrorState, PageLoader } from "../components/State";
import {
  Badge,
  Button,
  Field,
  Input,
  Panel,
  Select,
  Textarea,
} from "../components/ui";
import { errorMessage } from "../utils/errors";
import { formatDate, formatDateTime, formatMoney } from "../utils/format";

const serviceSchema = z.object({
  service_type_id: z.string().min(1),
  performed_at: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  labor_price: z.string().optional(),
});

const partSchema = z.object({
  description: z.string().min(1),
  quantity: z.string().min(1),
  unit_cost: z.string().optional(),
  unit_price: z.string().optional(),
  serial_number: z.string().optional(),
  warranty_until: z.string().optional(),
});

type ServiceForm = z.infer<typeof serviceSchema>;
type PartForm = z.infer<typeof partSchema>;

export function WorkOrderDetailPage() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const [chargeAmount, setChargeAmount] = useState("");
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));

  const workOrder = useQuery({
    queryKey: queryKeys.workOrder(id),
    queryFn: () => workOrdersApi.get(id),
  });
  const statuses = useQuery({
    queryKey: queryKeys.catalog("work-order-statuses", { is_active: true }),
    queryFn: () => catalogApi("work-order-statuses").list({ is_active: true }),
  });
  const receivables = useQuery({
    queryKey: ["finance", "work-order", id],
    queryFn: () =>
      financeApi.receivables({ work_order: id, ordering: "due_date" }),
    enabled: Boolean(id),
  });
  const serviceForm = useForm<ServiceForm>({
    resolver: zodResolver(serviceSchema),
  });
  const partForm = useForm<PartForm>({
    resolver: zodResolver(partSchema),
    defaultValues: { quantity: "1.00" },
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.workOrder(id) }),
      queryClient.invalidateQueries({ queryKey: ["finance"] }),
    ]);
  };

  const changeStatus = useMutation({
    mutationFn: (status_id: string) =>
      workOrdersApi.changeStatus(id, { status_id }),
    onSuccess: invalidate,
  });
  const complete = useMutation({
    mutationFn: () => workOrdersApi.complete(id, {}),
    onSuccess: invalidate,
  });
  const cancel = useMutation({
    mutationFn: () =>
      workOrdersApi.cancel(id, { comment: "Cancelada pelo painel." }),
    onSuccess: invalidate,
  });
  const addService = useMutation({
    mutationFn: (data: ServiceForm) => workOrdersApi.addService(id, data),
    onSuccess: () => {
      serviceForm.reset();
      invalidate();
    },
  });
  const addPart = useMutation({
    mutationFn: (data: PartForm) => workOrdersApi.addPart(id, data),
    onSuccess: () => {
      partForm.reset({ quantity: "1.00" });
      invalidate();
    },
  });
  const voidService = useMutation({
    mutationFn: (serviceId: string) =>
      workOrdersApi.voidService(id, serviceId, "Invalidado pelo painel."),
    onSuccess: invalidate,
  });
  const voidPart = useMutation({
    mutationFn: (partId: string) =>
      workOrdersApi.voidPart(id, partId, "Invalidado pelo painel."),
    onSuccess: invalidate,
  });

  const createReceivable = useMutation({
    mutationFn: () => {
      if (!workOrder.data) throw new Error("OS nao carregada");
      return financeApi.createReceivable({
        customer: workOrder.data.customer.id,
        work_order: workOrder.data.id,
        service_agreement: null,
        origin: "work_order",
        description: `Cobranca ${workOrder.data.display_number}`,
        reference: workOrder.data.display_number,
        issued_at: new Date().toISOString().slice(0, 10),
        due_date: dueDate,
        amount: chargeAmount,
        notes: "",
      });
    },
    onSuccess: async () => {
      setChargeAmount("");
      await invalidate();
    },
  });

  async function downloadPdf(issue: boolean) {
    const result = issue
      ? await workOrdersApi.issuePdf(id)
      : await workOrdersApi.previewPdf(id);
    saveBlob(
      result.blob,
      result.filename ?? `os-${workOrder.data?.number ?? ""}.pdf`,
    );
  }

  if (workOrder.isLoading) return <PageLoader />;
  if (workOrder.error || !workOrder.data)
    return <ErrorState message="OS nao encontrada." />;

  const item = workOrder.data;
  const isClosed = item.status.kind !== "active";
  const laborTotal = (item.services ?? [])
    .filter((service) => !service.voided_at)
    .reduce((total, service) => total + Number(service.labor_price ?? 0), 0);
  const partsTotal = (item.parts ?? [])
    .filter((part) => !part.voided_at)
    .reduce(
      (total, part) =>
        total + Number(part.quantity) * Number(part.unit_price ?? 0),
      0,
    );
  const technicalTotal = laborTotal + partsTotal;

  return (
    <div>
      <PageHeader
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              type="button"
              onClick={() => downloadPdf(false)}
            >
              <Download className="h-4 w-4" />
              Preview PDF
            </Button>
            <Button
              variant="secondary"
              type="button"
              onClick={() => downloadPdf(true)}
            >
              <FileCheck2 className="h-4 w-4" />
              Emitir PDF
            </Button>
            <Select
              aria-label="Alterar status"
              disabled={isClosed}
              onChange={(event) =>
                event.target.value && changeStatus.mutate(event.target.value)
              }
            >
              <option value="">Alterar status</option>
              {(statuses.data?.results ?? []).map((status) => (
                <option key={status.id} value={status.id}>
                  {status.name}
                </option>
              ))}
            </Select>
            <ConfirmDialog
              title="Concluir OS"
              description="A conclusao sera registrada no historico."
              onConfirm={() => complete.mutate()}
            >
              <Button disabled={isClosed} type="button">
                <CheckCircle className="h-4 w-4" />
                Concluir
              </Button>
            </ConfirmDialog>
            <ConfirmDialog
              title="Cancelar OS"
              description="O cancelamento sera registrado no historico."
              confirmLabel="Cancelar OS"
              onConfirm={() => cancel.mutate()}
            >
              <Button disabled={isClosed} variant="danger" type="button">
                <CircleX className="h-4 w-4" />
                Cancelar
              </Button>
            </ConfirmDialog>
          </div>
        }
        title={item.display_number}
        description={item.title}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Resumo">
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-slate-500">Cliente</dt>
              <dd>
                <Link
                  className="text-blue-700 dark:text-blue-300"
                  to={`/customers/${item.customer.id}`}
                >
                  {item.customer.name}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Equipamento</dt>
              <dd>
                <Link
                  className="text-blue-700 dark:text-blue-300"
                  to={`/equipment/${item.equipment.id}`}
                >
                  {[item.equipment.manufacturer, item.equipment.model]
                    .filter(Boolean)
                    .join(" ") || item.equipment.equipment_type.name}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd>
                <Badge>{item.status.name}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Prioridade</dt>
              <dd>{item.priority}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Abertura</dt>
              <dd>{formatDateTime(item.opened_at)}</dd>
            </div>
          </dl>
        </Panel>
        <div className="lg:col-span-2">
          <Panel title="Problema, diagnostico e solucao">
            <div className="grid gap-3 text-sm md:grid-cols-2">
              <div>
                <div className="font-medium">Problema</div>
                <p className="text-slate-600 dark:text-slate-300">
                  {item.problem_description || "-"}
                </p>
              </div>
              <div>
                <div className="font-medium">Diagnostico</div>
                <p className="text-slate-600 dark:text-slate-300">
                  {item.diagnosis || "-"}
                </p>
              </div>
              <div>
                <div className="font-medium">Solucao</div>
                <p className="text-slate-600 dark:text-slate-300">
                  {item.solution || "-"}
                </p>
              </div>
              <div>
                <div className="font-medium">Notas internas</div>
                <p className="text-slate-600 dark:text-slate-300">
                  {item.internal_notes || "-"}
                </p>
              </div>
            </div>
          </Panel>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title="Timeline">
          <div className="space-y-3">
            {(item.status_history ?? []).map((event: WorkOrderTimeline) => (
              <div className="border-l-2 border-blue-500 pl-3" key={event.id}>
                <div className="font-medium">{event.status.name}</div>
                <div className="text-xs text-slate-500">
                  {formatDateTime(event.changed_at)} por{" "}
                  {event.changed_by?.username ?? "-"}
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {event.comment || event.description || "-"}
                </p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Financeiro da OS">
          <div className="mb-4 grid grid-cols-3 gap-2 rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-950">
            <div>
              <div className="text-slate-500">Mao de obra</div>
              <strong>{formatMoney(laborTotal)}</strong>
            </div>
            <div>
              <div className="text-slate-500">Pecas</div>
              <strong>{formatMoney(partsTotal)}</strong>
            </div>
            <div>
              <div className="text-slate-500">Valor tecnico</div>
              <strong>{formatMoney(technicalTotal)}</strong>
            </div>
          </div>
          <div className="space-y-2">
            {receivables.data?.results.map((receivable) => (
              <div
                key={receivable.id}
                className="flex items-center justify-between rounded-md border border-slate-200 p-3 text-sm dark:border-slate-800"
              >
                <div>
                  <div className="font-medium">{receivable.description}</div>
                  <div className="text-xs text-slate-500">
                    Vence {formatDate(receivable.due_date)} ·{" "}
                    {receivable.status}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">
                    {formatMoney(receivable.amount)}
                  </div>
                  <div className="text-xs text-slate-500">
                    Saldo {formatMoney(receivable.balance)}
                  </div>
                </div>
              </div>
            ))}
            {!receivables.data?.results.length ? (
              <p className="text-sm text-slate-500">
                Nenhuma cobranca vinculada a esta OS.
              </p>
            ) : null}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_160px_auto]">
            <Field label="Valor da cobranca">
              <Input
                inputMode="decimal"
                value={chargeAmount}
                placeholder={String(technicalTotal.toFixed(2))}
                onChange={(event) => setChargeAmount(event.target.value)}
              />
            </Field>
            <Field label="Vencimento">
              <Input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </Field>
            <div className="self-end">
              <Button
                type="button"
                disabled={
                  !chargeAmount || !dueDate || createReceivable.isPending
                }
                onClick={() => createReceivable.mutate()}
              >
                Criar cobranca
              </Button>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Pagamentos e baixas ficam no modulo Financeiro. O fechamento
            financeiro antigo da OS foi mantido apenas para compatibilidade
            historica.
          </p>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title="Servicos realizados">
          <form
            className="mb-4 grid gap-3 md:grid-cols-2"
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
              <Input {...serviceForm.register("labor_price")} />
            </Field>
            <div className="md:col-span-2">
              <Field label="Descricao">
                <Textarea {...serviceForm.register("description")} />
              </Field>
            </div>
            {addService.error ? (
              <p className="text-sm text-red-600 md:col-span-2">
                {errorMessage(addService.error)}
              </p>
            ) : null}
            <div className="md:col-span-2">
              <Button disabled={isClosed || addService.isPending} type="submit">
                <Plus className="h-4 w-4" />
                Adicionar servico
              </Button>
            </div>
          </form>
          <DataTable<WorkOrderService>
            empty="Nenhum servico registrado."
            rows={item.services ?? []}
            columns={[
              { header: "Servico", cell: (row) => row.service_type.name },
              {
                header: "Data",
                cell: (row) => formatDateTime(row.performed_at),
              },
              { header: "Valor", cell: (row) => formatMoney(row.labor_price) },
              {
                header: "Acao",
                cell: (row) => (
                  <ConfirmDialog
                    title="Invalidar servico"
                    description="O lancamento sera preservado como invalidado."
                    onConfirm={() => voidService.mutate(row.id)}
                  >
                    <Button variant="secondary" type="button">
                      Invalidar
                    </Button>
                  </ConfirmDialog>
                ),
              },
            ]}
          />
        </Panel>
        <Panel title="Pecas">
          <form
            className="mb-4 grid gap-3 md:grid-cols-2"
            onSubmit={partForm.handleSubmit((data) => addPart.mutate(data))}
          >
            <Field label="Descricao">
              <Input {...partForm.register("description")} />
            </Field>
            <Field label="Quantidade">
              <Input {...partForm.register("quantity")} />
            </Field>
            <Field label="Custo">
              <Input {...partForm.register("unit_cost")} />
            </Field>
            <Field label="Preco">
              <Input {...partForm.register("unit_price")} />
            </Field>
            <Field label="Serial">
              <Input {...partForm.register("serial_number")} />
            </Field>
            <Field label="Garantia ate">
              <Input type="date" {...partForm.register("warranty_until")} />
            </Field>
            <div className="md:col-span-2">
              <Button disabled={isClosed || addPart.isPending} type="submit">
                <Plus className="h-4 w-4" />
                Adicionar peca
              </Button>
            </div>
          </form>
          <DataTable<WorkOrderPart>
            empty="Nenhuma peca registrada."
            rows={item.parts ?? []}
            columns={[
              { header: "Descricao", cell: (row) => row.description },
              { header: "Qtd.", cell: (row) => row.quantity },
              { header: "Preco", cell: (row) => formatMoney(row.unit_price) },
              {
                header: "Acao",
                cell: (row) => (
                  <ConfirmDialog
                    title="Invalidar peca"
                    description="O lancamento sera preservado como invalidado."
                    onConfirm={() => voidPart.mutate(row.id)}
                  >
                    <Button variant="secondary" type="button">
                      Invalidar
                    </Button>
                  </ConfirmDialog>
                ),
              },
            ]}
          />
        </Panel>
      </div>
    </div>
  );
}
