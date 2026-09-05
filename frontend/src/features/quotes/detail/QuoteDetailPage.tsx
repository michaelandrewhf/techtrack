import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle,
  Download,
  FileCheck2,
  FileText,
  Pencil,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { saveBlob } from "../../../api/client";
import { quotesApi } from "../../../api/endpoints";
import { Breadcrumbs } from "../../../components/Breadcrumbs";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { PageHeader } from "../../../components/PageHeader";
import { ErrorState, PageLoader } from "../../../components/State";
import { Badge, Button, Notice, Panel } from "../../../components/ui";
import { errorMessage } from "../../../utils/errors";
import { QuoteEditDialog } from "./QuoteEditDialog";
import { QuoteItems } from "./QuoteItems";
import { QuoteSummary } from "./QuoteSummary";
import { quoteStatusLabel, quoteStatusTone } from "./presentation";

export function QuoteDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const quote = useQuery({
    queryKey: ["quote", id],
    queryFn: () => quotesApi.get(id),
    enabled: Boolean(id),
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["quote", id] }),
      queryClient.invalidateQueries({ queryKey: ["quotes"] }),
      queryClient.invalidateQueries({ queryKey: ["customers"] }),
    ]);
  };

  const actionMutation = useMutation({
    mutationFn: async (
      action: "sent" | "approve" | "reject" | "cancel" | "work-order",
    ) => {
      if (action === "sent") return quotesApi.markSent(id);
      if (action === "approve") return quotesApi.approve(id);
      if (action === "reject") return quotesApi.reject(id);
      if (action === "cancel") return quotesApi.cancel(id);
      return quotesApi.createWorkOrder(id);
    },
    onSuccess: async (result, action) => {
      await invalidate();
      if (action === "work-order" && "id" in result) {
        navigate(`/work-orders/${result.id}`);
      }
    },
  });

  async function downloadPdf(issue = false, version?: number) {
    const result = issue
      ? await quotesApi.issuePdf(id)
      : await quotesApi.previewPdf(id, version);
    saveBlob(
      result.blob,
      result.filename ?? `orcamento-${quote.data?.number ?? ""}.pdf`,
    );
    if (issue) await invalidate();
  }

  if (quote.isLoading) return <PageLoader label="Carregando orcamento" />;
  if (quote.isError || !quote.data) {
    return (
      <ErrorState message="Orcamento nao encontrado." onRetry={quote.refetch} />
    );
  }

  const data = quote.data;
  const editable = data.status === "draft" || data.status === "sent";
  const canCreateWorkOrder = data.status === "approved";

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Clientes", to: "/customers" },
          {
            label: data.customer_name,
            to: `/customers/${data.customer}?tab=quotes`,
          },
          { label: data.display_number },
        ]}
      />

      <PageHeader
        eyebrow="Orcamento"
        title={data.display_number}
        description={data.title}
        meta={
          <Badge tone={quoteStatusTone(data.status)}>
            {quoteStatusLabel(data.status)}
          </Badge>
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
            {editable ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="h-4 w-4" />
                Editar
              </Button>
            ) : null}
          </>
        }
      />

      <Panel
        className="mb-5 border-[var(--primary)]/25 bg-[var(--primary-soft)]"
        title="Proxima acao"
        subtitle="O workflow aparece no contexto do documento, com destaque apenas para as decisoes validas no estado atual."
      >
        <div className="flex flex-wrap items-center gap-2">
          {data.status === "draft" ? (
            <Button
              disabled={actionMutation.isPending}
              type="button"
              onClick={() => actionMutation.mutate("sent")}
            >
              <FileText className="h-4 w-4" />
              Marcar como enviado
            </Button>
          ) : null}

          {editable ? (
            <ConfirmDialog
              title="Aprovar orcamento"
              description="O orcamento sera fechado para edicao e podera gerar uma ordem de servico."
              confirmLabel="Aprovar"
              onConfirm={() => actionMutation.mutate("approve")}
            >
              <Button type="button">
                <CheckCircle className="h-4 w-4" />
                Aprovar
              </Button>
            </ConfirmDialog>
          ) : null}

          {editable ? (
            <ConfirmDialog
              title="Rejeitar orcamento"
              description="O status sera registrado como rejeitado e a proposta deixara de ser editavel."
              confirmLabel="Rejeitar"
              onConfirm={() => actionMutation.mutate("reject")}
            >
              <Button type="button" variant="danger">
                <XCircle className="h-4 w-4" />
                Rejeitar
              </Button>
            </ConfirmDialog>
          ) : null}

          {editable ? (
            <ConfirmDialog
              title="Cancelar orcamento"
              description="Use cancelamento quando a proposta nao deve mais seguir no fluxo."
              confirmLabel="Cancelar"
              onConfirm={() => actionMutation.mutate("cancel")}
            >
              <Button type="button" variant="ghost">
                Cancelar proposta
              </Button>
            </ConfirmDialog>
          ) : null}

          {canCreateWorkOrder ? (
            <Button
              disabled={actionMutation.isPending}
              type="button"
              onClick={() => actionMutation.mutate("work-order")}
            >
              <FileText className="h-4 w-4" />
              {data.work_order ? "Abrir OS vinculada" : "Criar OS"}
            </Button>
          ) : null}

          {!editable && !canCreateWorkOrder ? (
            <span className="text-sm text-[var(--text-muted)]">
              Este orcamento esta encerrado no workflow.
            </span>
          ) : null}
        </div>

        {actionMutation.error ? (
          <div className="mt-3">
            <Notice tone="danger">{errorMessage(actionMutation.error)}</Notice>
          </div>
        ) : null}
      </Panel>

      <QuoteSummary
        quote={data}
        onDownloadVersion={(version) => void downloadPdf(false, version)}
      />

      <div className="mt-5">
        <QuoteItems quote={data} editable={editable} onChanged={invalidate} />
      </div>

      <QuoteEditDialog
        open={editOpen}
        quote={data}
        onChanged={invalidate}
        onClose={() => setEditOpen(false)}
      />
    </div>
  );
}
