import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, CircleX, Download, FileCheck2 } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";

import { saveBlob } from "../../../api/client";
import { catalogApi, financeApi, workOrdersApi } from "../../../api/endpoints";
import { queryKeys } from "../../../api/queryKeys";
import { Breadcrumbs } from "../../../components/Breadcrumbs";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { PageHeader } from "../../../components/PageHeader";
import { ErrorState, PageLoader } from "../../../components/State";
import { Badge, Button, Notice, Panel, Select } from "../../../components/ui";
import { errorMessage } from "../../../utils/errors";
import { WorkOrderFinanceHistory } from "./WorkOrderFinanceHistory";
import { WorkOrderOperations } from "./WorkOrderOperations";
import { WorkOrderOverview } from "./WorkOrderOverview";
import { WorkOrderTechnicalDialog } from "./WorkOrderTechnicalDialog";
import { equipmentName, priorityLabel, priorityTone } from "./presentation";

export function WorkOrderDetailPage() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const [technicalOpen, setTechnicalOpen] = useState(false);

  const workOrder = useQuery({
    queryKey: queryKeys.workOrder(id),
    queryFn: () => workOrdersApi.get(id),
    enabled: Boolean(id),
  });

  const statuses = useQuery({
    queryKey: queryKeys.catalog("work-order-statuses", { is_active: true }),
    queryFn: () =>
      catalogApi("work-order-statuses").list({
        is_active: true,
        page_size: 100,
      }),
    enabled: Boolean(id) && workOrder.data?.status.kind === "active",
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
    mutationFn: (statusId: string) =>
      workOrdersApi.changeStatus(id, { status_id: statusId }),
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

  async function downloadPdf(issue: boolean) {
    const result = issue
      ? await workOrdersApi.issuePdf(id)
      : await workOrdersApi.previewPdf(id);
    saveBlob(
      result.blob,
      result.filename ?? `os-${workOrder.data?.number ?? ""}.pdf`,
    );
  }

  if (workOrder.isLoading) {
    return <PageLoader label="Carregando ordem de servico" />;
  }
  if (workOrder.error || !workOrder.data) {
    return (
      <ErrorState message="OS nao encontrada." onRetry={workOrder.refetch} />
    );
  }

  const item = workOrder.data;
  const isClosed = item.status.kind !== "active";

  if (!isClosed && statuses.isLoading) {
    return <PageLoader label="Carregando fluxo da ordem de servico" />;
  }
  if (!isClosed && statuses.error) {
    return (
      <ErrorState
        message="Nao foi possivel carregar os status disponiveis da OS."
        onRetry={statuses.refetch}
      />
    );
  }

  const equipment = equipmentName(item);
  const rows = receivables.data?.results ?? [];
  const openBalance = rows.reduce(
    (total, receivable) =>
      receivable.status === "cancelled"
        ? total
        : total + Number(receivable.balance),
    0,
  );
  const workflowError = changeStatus.error || complete.error || cancel.error;

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Clientes", to: "/customers" },
          {
            label: item.customer.name,
            to: `/customers/${item.customer.id}?tab=work-orders`,
          },
          { label: equipment, to: `/equipment/${item.equipment.id}` },
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
              onClick={() => void downloadPdf(false)}
            >
              <Download className="h-4 w-4" />
              Preview
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void downloadPdf(true)}
            >
              <FileCheck2 className="h-4 w-4" />
              Emitir PDF
            </Button>
          </>
        }
      />

      <Panel
        className="mb-5 border-[var(--primary)]/25 bg-[var(--primary-soft)]"
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
            <span className="text-sm text-[var(--text-muted)]">
              Esta OS esta encerrada para alteracoes operacionais comuns.
            </span>
          ) : null}
        </div>

        {workflowError ? (
          <div className="mt-3">
            <Notice tone="danger">{errorMessage(workflowError)}</Notice>
          </div>
        ) : null}
      </Panel>

      <WorkOrderOverview
        openBalance={openBalance}
        workOrder={item}
        onEditTechnical={() => setTechnicalOpen(true)}
      />

      <WorkOrderOperations workOrder={item} onChanged={invalidate} />

      <WorkOrderFinanceHistory
        onChanged={invalidate}
        onRetryReceivables={() => {
          void receivables.refetch();
        }}
        receivables={rows}
        receivablesError={Boolean(receivables.error)}
        receivablesLoading={receivables.isLoading}
        workOrder={item}
      />

      <WorkOrderTechnicalDialog
        open={technicalOpen}
        workOrder={item}
        onChanged={invalidate}
        onClose={() => setTechnicalOpen(false)}
      />
    </div>
  );
}
