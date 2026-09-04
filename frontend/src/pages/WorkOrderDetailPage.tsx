import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle,
  CircleX,
  Download,
  FileCheck2,
  Pencil,
  Plus,
} from "lucide-react";
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
  MetricCard,
  Notice,
  Panel,
  Select,
  Textarea,
} from "../components/ui";
import { errorMessage } from "../utils/errors";
import { formatDate, formatDateTime, formatMoney } from "../utils/format";

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

const technicalSchema = z.object({
  title: z.string().min(1, "Informe o titulo."),
  problem_description: z.string().min(1, "Informe o problema relatado."),
  priority: z.string().min(1),
  diagnosis: z.string().optional(),
  service_description: z.string().optional(),
  solution: z.string().optional(),
  internal_notes: z.string().optional(),
});

type ServiceForm = z.infer<typeof serviceSchema>;
type PartForm = z.infer<typeof partSchema>;
type TechnicalForm = z.input<typeof technicalSchema>;

function priorityTone(priority: string) {
  if (priority === "urgent") return "danger" as const;
  if (priority === "high") return "warning" as const;
  return "neutral" as const;
}

function priorityLabel(priority: string) {
  return (
    {
      low: "Baixa",
      normal: "Normal",
      high: "Alta",
      urgent: "Urgente",
    }[priority] ?? priority
  );
}

export function WorkOrderDetailPage() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const [chargeAmount, setChargeAmount] = useState("");
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [serviceFormOpen, setServiceFormOpen] = useState(false);
  const [partFormOpen, setPartFormOpen] = useState(false);
  const [technicalOpen, setTechnicalOpen] = useState(false);

  const workOrder = useQuery({
    queryKey: queryKeys.workOrder(id),
    queryFn: () => workOrdersApi.get(id),
  });
  const statuses = useQuery({
    queryKey: queryKeys.catalog("work-order-statuses", { is_active: true }),
    queryFn: () =>
      catalogApi("work-order-statuses").list({
        is_active: true,
        page_size: 100,
      }),
  });
  const receivables = useQuery({
    queryKey: ["finance", "work-order", id],
    queryFn: () =>
      financeApi.receivables({
        work_order: id,
        ordering: "due_date",
        page_size: 100,
      }),
    enabled: Boolean(id),
  });
  const serviceForm = useForm<ServiceForm>({
    resolver: zodResolver(serviceSchema),
  });
  const partForm = useForm<PartForm>({
    resolver: zodResolver(partSchema),
    defaultValues: { quantity: "1.00" },
  });
  const technicalForm = useForm<TechnicalForm>({
    resolver: zodResolver(technicalSchema),
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.workOrder(id) }),
      queryClient.invalidateQueries({ queryKey: ["work-orders"] }),
      queryClient.invalidateQueries({ queryKey: ["finance"] }),
      queryClient.invalidateQueries({ queryKey: ["customers"] }),
      queryClient.invalidateQueries({ queryKey: ["equipment"] }),
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
  const updateTechnical = useMutation({
    mutationFn: (data: TechnicalForm) => workOrdersApi.update(id, data),
    onSuccess: async () => {
      setTechnicalOpen(false);
      await invalidate();
    },
  });
  const addService = useMutation({
    mutationFn: (data: ServiceForm) => workOrdersApi.addService(id, data),
    onSuccess: async () => {
      serviceForm.reset();
      setServiceFormOpen(false);
      await invalidate();
    },
  });
  const addPart = useMutation({
    mutationFn: (data: PartForm) => workOrdersApi.addPart(id, data),
    onSuccess: async () => {
      partForm.reset({ quantity: "1.00" });
      setPartFormOpen(false);
      await invalidate();
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

  if (workOrder.isLoading)
    return <PageLoader label="Carregando ordem de servico" />;
  if (workOrder.error || !workOrder.data)
    return (
      <ErrorState message="OS nao encontrada." onRetry={workOrder.refetch} />
    );

  const item = workOrder.data;
  const isClosed = item.status.kind !== "active";
  const activeServices = (item.services ?? []).filter(
    (service) => !service.voided_at,
  );
  const activeParts = (item.parts ?? []).filter((part) => !part.voided_at);
  const laborTotal = activeServices.reduce(
    (total, service) => total + Number(service.labor_price ?? 0),
    0,
  );
  const partsTotal = activeParts.reduce(
    (total, part) =>
      total + Number(part.quantity) * Number(part.unit_price ?? 0),
    0,
  );
  const technicalTotal = laborTotal + partsTotal;
  const openBalance =
    receivables.data?.results.reduce(
      (total, receivable) =>
        receivable.status === "cancelled"
          ? total
          : total + Number(receivable.balance),
      0,
    ) ?? 0;
  const equipmentName =
    [item.equipment.manufacturer, item.equipment.model]
      .filter(Boolean)
      .join(" ") || item.equipment.equipment_type.name;

  const openTechnicalEdit = () => {
    technicalForm.reset({
      title: item.title,
      problem_description: item.problem_description ?? "",
      priority: item.priority,
      diagnosis: item.diagnosis ?? "",
      service_description: item.service_description ?? "",
      solution: item.solution ?? "",
      internal_notes: item.internal_notes ?? "",
    });
    setTechnicalOpen(true);
  };

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Clientes", to: "/customers" },
          {
            label: item.customer.name,
            to: `/customers/${item.customer.id}?tab=work-orders`,
          },
          { label: equipmentName, to: `/equipment/${item.equipment.id}` },
          { label: item.display_number },
        ]}
      />
      <PageHeader
        eyebrow="Ordem de servico"
        title={item.display_number}
        description={item.title}
        meta={
          <div className="flex flex-wrap gap-2">
            <Badge tone={isClosed ? "neutral" : "info"}>
              {item.status.name}
            </Badge>
            <Badge tone={priorityTone(item.priority)}>
              {priorityLabel(item.priority)}
            </Badge>
          </div>
        }
        action={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => downloadPdf(false)}
            >
              <Download className="h-4 w-4" />
              Preview
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => downloadPdf(true)}
            >
              <FileCheck2 className="h-4 w-4" />
              Emitir PDF
            </Button>
          </>
        }
      />

      <Panel
        className="mb-5 border-blue-200 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-950/20"
        title="Fluxo da OS"
        subtitle="Acoes de estado ficam separadas do conteudo tecnico e dos documentos."
      >
        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Alterar status"
            className="w-auto min-w-48"
            disabled={isClosed || changeStatus.isPending}
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
            description="A conclusao sera registrada no historico e encerra o fluxo de edicao comum."
            onConfirm={() => complete.mutate()}
          >
            <Button disabled={isClosed || complete.isPending} type="button">
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
            <Button
              disabled={isClosed || cancel.isPending}
              variant="danger"
              type="button"
            >
              <CircleX className="h-4 w-4" />
              Cancelar
            </Button>
          </ConfirmDialog>
          {isClosed ? (
            <span className="text-sm text-slate-600 dark:text-slate-300">
              Esta OS esta encerrada para alteracoes operacionais comuns.
            </span>
          ) : null}
        </div>
      </Panel>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Mao de obra" value={formatMoney(laborTotal)} />
        <MetricCard label="Pecas" value={formatMoney(partsTotal)} />
        <MetricCard
          label="Valor tecnico"
          value={formatMoney(technicalTotal)}
          tone="info"
        />
        <MetricCard
          label="Saldo financeiro"
          value={formatMoney(openBalance)}
          tone={openBalance > 0 ? "warning" : "success"}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <Panel title="Contexto do atendimento">
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
              {
                label: "Equipamento",
                value: (
                  <Link
                    className="text-blue-600"
                    to={`/equipment/${item.equipment.id}`}
                  >
                    {equipmentName}
                  </Link>
                ),
              },
              { label: "Abertura", value: formatDateTime(item.opened_at) },
              { label: "Conclusao", value: formatDateTime(item.completed_at) },
              {
                label: "Responsavel",
                value: item.responsible_user?.username ?? "Nao definido",
              },
              { label: "Prioridade", value: priorityLabel(item.priority) },
            ]}
          />
        </Panel>

        <Panel
          title="Conteudo tecnico"
          subtitle="Problema relatado, diagnostico, execucao e solucao."
          action={
            !isClosed ? (
              <Button
                size="sm"
                type="button"
                variant="ghost"
                onClick={openTechnicalEdit}
              >
                <Pencil className="h-4 w-4" />
                Editar
              </Button>
            ) : undefined
          }
        >
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Problema relatado
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200">
                {item.problem_description || "-"}
              </p>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Diagnostico
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200">
                {item.diagnosis || "-"}
              </p>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Servico / execucao
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200">
                {item.service_description || "-"}
              </p>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Solucao
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200">
                {item.solution || "-"}
              </p>
            </div>
            <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-950/30 md:col-span-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                Notas internas
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-amber-900 dark:text-amber-100">
                {item.internal_notes || "Sem notas internas."}
              </p>
              <p className="mt-2 text-xs text-amber-700/80 dark:text-amber-300/80">
                Conteudo interno: nao e incluido no PDF entregue ao cliente.
              </p>
            </div>
          </div>
        </Panel>
      </div>

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
              className="mb-5 grid gap-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-950 md:grid-cols-2"
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
                  <Notice tone="danger">
                    {errorMessage(addService.error)}
                  </Notice>
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
            rows={item.services ?? []}
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
              className="mb-5 grid gap-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-950 md:grid-cols-2"
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
                <Input
                  inputMode="decimal"
                  {...partForm.register("unit_cost")}
                />
              </Field>
              <Field label="Preco">
                <Input
                  inputMode="decimal"
                  {...partForm.register("unit_price")}
                />
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
            rows={item.parts ?? []}
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

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel
          title="Financeiro da OS"
          subtitle="Resumo comercial do atendimento e cobrancas relacionadas."
        >
          <div className="space-y-3">
            {(receivables.data?.results ?? []).map((receivable) => (
              <Link
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                key={receivable.id}
                to={`/customers/${item.customer.id}?tab=finance`}
              >
                <div>
                  <div className="font-medium">{receivable.description}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Vence {formatDate(receivable.due_date)} ·{" "}
                    {receivable.status}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">
                    {formatMoney(receivable.amount)}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Saldo {formatMoney(receivable.balance)}
                  </div>
                </div>
              </Link>
            ))}
            {!receivables.data?.results.length ? (
              <p className="text-sm text-slate-500">
                Nenhuma cobranca vinculada a esta OS.
              </p>
            ) : null}
          </div>
          {!isClosed ? (
            <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 dark:border-slate-800 sm:grid-cols-[1fr_170px_auto]">
              <Field label="Valor da cobranca">
                <Input
                  inputMode="decimal"
                  placeholder={technicalTotal.toFixed(2)}
                  value={chargeAmount}
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
                  disabled={
                    !chargeAmount || !dueDate || createReceivable.isPending
                  }
                  type="button"
                  onClick={() => createReceivable.mutate()}
                >
                  Criar cobranca
                </Button>
              </div>
            </div>
          ) : null}
          {createReceivable.error ? (
            <div className="mt-3">
              <Notice tone="danger">
                {errorMessage(createReceivable.error)}
              </Notice>
            </div>
          ) : null}
        </Panel>

        <Panel
          title="Historico de status"
          subtitle="Linha do tempo imutavel das transicoes da OS."
        >
          <div className="space-y-4">
            {(item.status_history ?? []).map((event: WorkOrderTimeline) => (
              <div
                className="relative border-l-2 border-blue-500 pl-4"
                key={event.id}
              >
                <div className="font-medium text-slate-950 dark:text-white">
                  {event.status.name}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {formatDateTime(event.changed_at)} ·{" "}
                  {event.changed_by?.username ?? "-"}
                </div>
                {event.comment || event.description ? (
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {event.comment || event.description}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Modal
        open={technicalOpen}
        title="Editar conteudo tecnico"
        description="Atualize o atendimento sem misturar notas internas com o documento destinado ao cliente."
        size="xl"
        onClose={() => setTechnicalOpen(false)}
      >
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={technicalForm.handleSubmit((data) =>
            updateTechnical.mutate(data),
          )}
        >
          <div className="md:col-span-2">
            <Field
              label="Titulo"
              required
              error={technicalForm.formState.errors.title?.message}
            >
              <Input {...technicalForm.register("title")} />
            </Field>
          </div>
          <Field label="Prioridade">
            <Select {...technicalForm.register("priority")}>
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
              error={
                technicalForm.formState.errors.problem_description?.message
              }
            >
              <Textarea
                rows={4}
                {...technicalForm.register("problem_description")}
              />
            </Field>
          </div>
          <Field label="Diagnostico">
            <Textarea rows={5} {...technicalForm.register("diagnosis")} />
          </Field>
          <Field label="Servico / execucao">
            <Textarea
              rows={5}
              {...technicalForm.register("service_description")}
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="Solucao">
              <Textarea rows={5} {...technicalForm.register("solution")} />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field
              label="Notas internas"
              hint="Uso interno. Este campo nao entra no PDF da OS."
            >
              <Textarea
                rows={4}
                {...technicalForm.register("internal_notes")}
              />
            </Field>
          </div>
          {updateTechnical.error ? (
            <div className="md:col-span-2">
              <Notice tone="danger">
                {errorMessage(updateTechnical.error)}
              </Notice>
            </div>
          ) : null}
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800 md:col-span-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setTechnicalOpen(false)}
            >
              Cancelar
            </Button>
            <Button disabled={updateTechnical.isPending} type="submit">
              Salvar alteracoes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
