import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle,
  Download,
  FileCheck2,
  FileText,
  Pencil,
  Plus,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";

import { saveBlob } from "../api/client";
import { catalogApi, quotesApi } from "../api/endpoints";
import type { QuoteItem } from "../api/types";
import { Breadcrumbs } from "../components/Breadcrumbs";
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
import { formatDate, formatDateTime, formatMoney } from "../utils/format";

const editSchema = z.object({
  title: z.string().min(1, "Informe o titulo."),
  description: z.string().optional(),
  valid_until: z.string().optional(),
  notes: z.string().optional(),
  discount: z.string().optional(),
});

type EditForm = z.input<typeof editSchema>;

function statusTone(status: string) {
  if (status === "approved") return "success" as const;
  if (status === "rejected" || status === "cancelled") return "danger" as const;
  if (status === "sent") return "warning" as const;
  return "neutral" as const;
}

function statusLabel(status: string) {
  return (
    {
      draft: "Rascunho",
      sent: "Enviado",
      approved: "Aprovado",
      rejected: "Rejeitado",
      cancelled: "Cancelado",
    }[status] ?? status
  );
}

export function QuoteDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [itemType, setItemType] = useState("service");
  const [catalogId, setCatalogId] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [discount, setDiscount] = useState("0");
  const [editOpen, setEditOpen] = useState(false);

  const quote = useQuery({
    queryKey: ["quote", id],
    queryFn: () => quotesApi.get(id),
    enabled: Boolean(id),
  });
  const serviceTypes = useQuery({
    queryKey: ["catalog", "service-types", "quote"],
    queryFn: () =>
      catalogApi("service-types").list({ is_active: true, page_size: 100 }),
  });
  const parts = useQuery({
    queryKey: ["catalog", "parts", "quote"],
    queryFn: () =>
      catalogApi("parts").list({ is_active: true, page_size: 100 }),
  });
  const editForm = useForm<EditForm>({ resolver: zodResolver(editSchema) });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["quote", id] }),
      queryClient.invalidateQueries({ queryKey: ["quotes"] }),
      queryClient.invalidateQueries({ queryKey: ["customers"] }),
    ]);
  };

  const addItem = useMutation({
    mutationFn: () =>
      quotesApi.addItem(id, {
        item_type: itemType,
        service_type: itemType === "service" ? catalogId : null,
        part: itemType === "part" ? catalogId : null,
        description,
        quantity,
        unit_price: unitPrice,
        discount,
      }),
    onSuccess: async () => {
      setCatalogId("");
      setDescription("");
      setQuantity("1");
      setUnitPrice("");
      setDiscount("0");
      await invalidate();
    },
  });

  const updateQuote = useMutation({
    mutationFn: (data: EditForm) =>
      quotesApi.update(id, {
        title: data.title,
        description: data.description ?? "",
        valid_until: data.valid_until || null,
        notes: data.notes ?? "",
        discount: data.discount || "0",
      }),
    onSuccess: async () => {
      setEditOpen(false);
      await invalidate();
    },
  });

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
      if (action === "work-order" && "id" in result)
        navigate(`/work-orders/${result.id}`);
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
  if (quote.isError || !quote.data)
    return (
      <ErrorState message="Orcamento nao encontrado." onRetry={quote.refetch} />
    );

  const data = quote.data;
  const editable = data.status === "draft" || data.status === "sent";
  const canCreateWorkOrder = data.status === "approved";

  const openEdit = () => {
    editForm.reset({
      title: data.title,
      description: data.description,
      valid_until: data.valid_until ?? "",
      notes: data.notes,
      discount: data.discount,
    });
    setEditOpen(true);
  };

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
          <Badge tone={statusTone(data.status)}>
            {statusLabel(data.status)}
          </Badge>
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
            {editable ? (
              <Button type="button" variant="ghost" onClick={openEdit}>
                <Pencil className="h-4 w-4" />
                Editar
              </Button>
            ) : null}
          </>
        }
      />

      <Panel
        className="mb-5 border-blue-200 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-950/20"
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
              <ClipboardIcon />
              {data.work_order ? "Abrir OS vinculada" : "Criar OS"}
            </Button>
          ) : null}
          {!editable && !canCreateWorkOrder ? (
            <span className="text-sm text-slate-600 dark:text-slate-300">
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

      <div className="mb-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Contexto da proposta">
          <DescriptionList
            items={[
              {
                label: "Cliente",
                value: (
                  <Link
                    className="text-blue-600"
                    to={`/customers/${data.customer}`}
                  >
                    {data.customer_name}
                  </Link>
                ),
              },
              {
                label: "Equipamento",
                value: data.equipment ? (
                  <Link
                    className="text-blue-600"
                    to={`/equipment/${data.equipment}`}
                  >
                    {data.equipment_label || "Abrir equipamento"}
                  </Link>
                ) : (
                  "Nao definido"
                ),
              },
              { label: "Criado em", value: formatDateTime(data.created_at) },
              { label: "Validade", value: formatDate(data.valid_until) },
              { label: "Enviado em", value: formatDateTime(data.sent_at) },
              { label: "Aprovado em", value: formatDateTime(data.approved_at) },
            ]}
          />
        </Panel>
        <Panel title="Valores">
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Subtotal dos itens</span>
              <strong>{formatMoney(data.items_total)}</strong>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Desconto geral</span>
              <strong>{formatMoney(data.discount)}</strong>
            </div>
            <div className="flex items-end justify-between border-t border-slate-200 pt-4 dark:border-slate-800">
              <span className="font-medium">Total final</span>
              <strong className="text-2xl text-slate-950 dark:text-white">
                {formatMoney(data.total_amount)}
              </strong>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.45fr_0.75fr]">
        <Panel
          title="Itens do orcamento"
          subtitle="Servicos, pecas e itens livres apresentados como composicao comercial."
        >
          <DataTable<QuoteItem>
            empty="Nenhum item adicionado."
            getRowKey={(row) => row.id}
            rows={data.items ?? []}
            columns={[
              {
                header: "Descricao",
                cell: (row) => (
                  <span className="font-medium">{row.description}</span>
                ),
              },
              { header: "Tipo", cell: (row) => row.item_type },
              { header: "Qtd.", cell: (row) => row.quantity },
              {
                header: "Valor unit.",
                cell: (row) => formatMoney(row.unit_price),
              },
              { header: "Desconto", cell: (row) => formatMoney(row.discount) },
              {
                header: "Total",
                cell: (row) => <strong>{formatMoney(row.total)}</strong>,
              },
            ]}
          />
        </Panel>

        <Panel
          title="Adicionar item"
          subtitle={
            editable
              ? "Inclua um item sem sair do documento."
              : "Documento fechado para alteracoes."
          }
        >
          {!editable ? (
            <Notice tone="warning">
              Itens nao podem ser alterados no estado atual.
            </Notice>
          ) : null}
          <div className="mt-3 space-y-3">
            <Field label="Tipo">
              <Select
                disabled={!editable}
                value={itemType}
                onChange={(event) => {
                  setItemType(event.target.value);
                  setCatalogId("");
                  setDescription("");
                  setUnitPrice("");
                }}
              >
                <option value="service">Servico</option>
                <option value="part">Peca</option>
                <option value="free">Item livre</option>
              </Select>
            </Field>
            {itemType !== "free" ? (
              <Field label={itemType === "service" ? "Servico" : "Peca"}>
                <Select
                  disabled={!editable}
                  value={catalogId}
                  onChange={(event) => {
                    const value = event.target.value;
                    setCatalogId(value);
                    const source =
                      itemType === "service"
                        ? serviceTypes.data?.results
                        : parts.data?.results;
                    const selected = source?.find(
                      (entry) => entry.id === value,
                    );
                    if (selected) {
                      setDescription(selected.name);
                      setUnitPrice(String(selected.default_price ?? ""));
                    }
                  }}
                >
                  <option value="">Selecione</option>
                  {(itemType === "service"
                    ? serviceTypes.data?.results
                    : parts.data?.results
                  )?.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <Field label="Descricao">
              <Input
                disabled={!editable}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Qtd">
                <Input
                  disabled={!editable}
                  inputMode="decimal"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
              </Field>
              <Field label="Valor">
                <Input
                  disabled={!editable}
                  inputMode="decimal"
                  value={unitPrice}
                  onChange={(event) => setUnitPrice(event.target.value)}
                />
              </Field>
              <Field label="Desconto">
                <Input
                  disabled={!editable}
                  inputMode="decimal"
                  value={discount}
                  onChange={(event) => setDiscount(event.target.value)}
                />
              </Field>
            </div>
            {addItem.error ? (
              <Notice tone="danger">{errorMessage(addItem.error)}</Notice>
            ) : null}
            <Button
              className="w-full"
              type="button"
              disabled={
                !editable ||
                !description ||
                !unitPrice ||
                (itemType !== "free" && !catalogId) ||
                addItem.isPending
              }
              onClick={() => addItem.mutate()}
            >
              <Plus className="h-4 w-4" />
              {addItem.isPending ? "Adicionando..." : "Adicionar item"}
            </Button>
          </div>
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Panel title="Descricao e observacoes">
          <div className="space-y-4 text-sm">
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Descricao
              </div>
              <p className="whitespace-pre-wrap leading-6">
                {data.description || "-"}
              </p>
            </div>
            <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Observacoes
              </div>
              <p className="whitespace-pre-wrap leading-6">
                {data.notes || "-"}
              </p>
            </div>
          </div>
        </Panel>
        <Panel
          title="Documentos emitidos"
          subtitle="Cada emissao oficial preserva snapshot, versao e checksum."
        >
          <div className="space-y-2">
            {(data.documents ?? []).map((document) => (
              <div
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800"
                key={document.id}
              >
                <div>
                  <div className="font-medium">Versao {document.version}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {formatDateTime(document.generated_at)}
                  </div>
                </div>
                <Button
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={() => downloadPdf(false, document.version)}
                >
                  <Download className="h-4 w-4" />
                  Baixar
                </Button>
              </div>
            ))}
            {!data.documents?.length ? (
              <p className="text-sm text-slate-500">
                Nenhuma revisao oficial emitida.
              </p>
            ) : null}
          </div>
        </Panel>
      </div>

      <Modal
        open={editOpen}
        title="Editar orcamento"
        description="Altere os dados comerciais enquanto o workflow permitir edicao."
        size="lg"
        onClose={() => setEditOpen(false)}
      >
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={editForm.handleSubmit((formData) =>
            updateQuote.mutate(formData),
          )}
        >
          <div className="sm:col-span-2">
            <Field
              label="Titulo"
              required
              error={editForm.formState.errors.title?.message}
            >
              <Input {...editForm.register("title")} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Descricao">
              <Textarea rows={5} {...editForm.register("description")} />
            </Field>
          </div>
          <Field label="Validade">
            <Input type="date" {...editForm.register("valid_until")} />
          </Field>
          <Field label="Desconto geral">
            <Input inputMode="decimal" {...editForm.register("discount")} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Observacoes">
              <Textarea rows={4} {...editForm.register("notes")} />
            </Field>
          </div>
          {updateQuote.error ? (
            <div className="sm:col-span-2">
              <Notice tone="danger">{errorMessage(updateQuote.error)}</Notice>
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
            <Button disabled={updateQuote.isPending} type="submit">
              Salvar alteracoes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function ClipboardIcon() {
  return <FileText className="h-4 w-4" />;
}
