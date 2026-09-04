import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, CircleX, Plus } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { Link, useParams } from "react-router-dom";
import { z } from "zod";

import { catalogApi, workOrdersApi } from "../api/endpoints";
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
import { formatDateTime, formatMoney } from "../utils/format";

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

const billingSchema = z.object({
  labor_total: z.string().optional(),
  parts_total: z.string().optional(),
  discount: z.string().optional(),
  total_amount: z.string().optional(),
  payment_status: z.string().optional(),
  payment_method_id: z.string().optional(),
  notes: z.string().optional(),
});

type ServiceForm = z.infer<typeof serviceSchema>;
type PartForm = z.infer<typeof partSchema>;
type BillingForm = z.infer<typeof billingSchema>;

export function WorkOrderDetailPage() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const workOrder = useQuery({
    queryKey: queryKeys.workOrder(id),
    queryFn: () => workOrdersApi.get(id),
  });
  const statuses = useQuery({
    queryKey: queryKeys.catalog("work-order-statuses", { is_active: true }),
    queryFn: () => catalogApi("work-order-statuses").list({ is_active: true }),
  });
  const paymentMethods = useQuery({
    queryKey: queryKeys.catalog("payment-methods", { is_active: true }),
    queryFn: () => catalogApi("payment-methods").list({ is_active: true }),
  });
  const serviceForm = useForm<ServiceForm>({
    resolver: zodResolver(serviceSchema),
  });
  const partForm = useForm<PartForm>({
    resolver: zodResolver(partSchema),
    defaultValues: { quantity: "1.00" },
  });
  const billingForm = useForm<BillingForm>({
    resolver: zodResolver(billingSchema),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.workOrder(id) });
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
  const saveBilling = useMutation({
    mutationFn: (data: BillingForm) => workOrdersApi.saveBilling(id, data),
    onSuccess: invalidate,
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

  if (workOrder.isLoading) return <PageLoader />;
  if (workOrder.error || !workOrder.data)
    return <ErrorState message="OS nao encontrada." />;

  const item = workOrder.data;
  const isClosed = item.status.kind !== "active";

  return (
    <div>
      <PageHeader
        action={
          <div className="flex flex-wrap gap-2">
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
        <Panel title="Financeiro">
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={billingForm.handleSubmit((data) =>
              saveBilling.mutate(data),
            )}
          >
            <Field label="Mao de obra">
              <Input
                defaultValue={item.billing?.labor_total ?? ""}
                {...billingForm.register("labor_total")}
              />
            </Field>
            <Field label="Pecas">
              <Input
                defaultValue={item.billing?.parts_total ?? ""}
                {...billingForm.register("parts_total")}
              />
            </Field>
            <Field label="Desconto">
              <Input
                defaultValue={item.billing?.discount ?? ""}
                {...billingForm.register("discount")}
              />
            </Field>
            <Field label="Total">
              <Input
                defaultValue={item.billing?.total_amount ?? ""}
                {...billingForm.register("total_amount")}
              />
            </Field>
            <Field label="Status">
              <Select
                defaultValue={item.billing?.payment_status ?? ""}
                {...billingForm.register("payment_status")}
              >
                <option value="">Selecione</option>
                <option value="pending">Pendente</option>
                <option value="paid">Pago</option>
                <option value="partial">Parcial</option>
                <option value="cancelled">Cancelado</option>
              </Select>
            </Field>
            <Field label="Metodo">
              <Select
                defaultValue={item.billing?.payment_method?.id ?? ""}
                {...billingForm.register("payment_method_id")}
              >
                <option value="">Selecione</option>
                {(paymentMethods.data?.results ?? []).map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="md:col-span-2">
              <Button disabled={saveBilling.isPending} type="submit">
                Salvar financeiro
              </Button>
            </div>
            {item.billing?.total_amount ? (
              <p className="text-sm text-slate-500 md:col-span-2">
                Total atual: {formatMoney(item.billing.total_amount)}
              </p>
            ) : null}
          </form>
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
