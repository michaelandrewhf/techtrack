import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileCheck2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { catalogApi, quotesApi } from "../api/endpoints";
import { saveBlob } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { Badge, Button, Field, Input, Panel, Select } from "../components/ui";
import { formatDate, formatDateTime, formatMoney } from "../utils/format";

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

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["quote", id] }),
      queryClient.invalidateQueries({ queryKey: ["quotes"] }),
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

  async function downloadPdf(issue = false) {
    const result = issue
      ? await quotesApi.issuePdf(id)
      : await quotesApi.previewPdf(id);
    saveBlob(
      result.blob,
      result.filename ?? `orcamento-${quote.data?.number ?? ""}.pdf`,
    );
    if (issue) await invalidate();
  }

  if (quote.isLoading) return <p>Carregando...</p>;
  if (quote.isError || !quote.data)
    return <p className="text-red-600">Orcamento nao encontrado.</p>;
  const data = quote.data;
  const editable = data.status === "draft" || data.status === "sent";

  return (
    <div>
      <PageHeader
        title={data.display_number}
        description={`${data.customer_name} · ${data.title}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => downloadPdf(false)}
            >
              <Download className="h-4 w-4" />
              Preview PDF
            </Button>
            <Button type="button" onClick={() => downloadPdf(true)}>
              <FileCheck2 className="h-4 w-4" />
              Emitir PDF
            </Button>
          </div>
        }
      />

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <Panel title="Resumo">
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-slate-500">Cliente</dt>
              <dd>{data.customer_name}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Equipamento</dt>
              <dd>{data.equipment_label || "Nao definido"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd>
                <Badge
                  tone={
                    data.status === "approved"
                      ? "success"
                      : data.status === "rejected" ||
                          data.status === "cancelled"
                        ? "danger"
                        : data.status === "sent"
                          ? "warning"
                          : "neutral"
                  }
                >
                  {data.status}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Validade</dt>
              <dd>{formatDate(data.valid_until)}</dd>
            </div>
            {data.work_order ? (
              <div>
                <dt className="text-slate-500">OS</dt>
                <dd>
                  <Link
                    className="text-blue-600"
                    to={`/work-orders/${data.work_order}`}
                  >
                    OS #{String(data.work_order_number).padStart(6, "0")}
                  </Link>
                </dd>
              </div>
            ) : null}
          </dl>
        </Panel>
        <Panel title="Valores">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Itens</span>
              <strong>{formatMoney(data.items_total)}</strong>
            </div>
            <div className="flex justify-between">
              <span>Desconto</span>
              <strong>{formatMoney(data.discount)}</strong>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-lg dark:border-slate-700">
              <span>Total</span>
              <strong>{formatMoney(data.total_amount)}</strong>
            </div>
          </div>
        </Panel>
        <Panel title="Workflow">
          <div className="flex flex-wrap gap-2">
            {data.status === "draft" ? (
              <Button
                type="button"
                onClick={() => actionMutation.mutate("sent")}
              >
                Marcar enviado
              </Button>
            ) : null}
            {editable ? (
              <Button
                type="button"
                onClick={() => actionMutation.mutate("approve")}
              >
                Aprovar
              </Button>
            ) : null}
            {editable ? (
              <Button
                type="button"
                variant="danger"
                onClick={() => actionMutation.mutate("reject")}
              >
                Rejeitar
              </Button>
            ) : null}
            {editable ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => actionMutation.mutate("cancel")}
              >
                Cancelar
              </Button>
            ) : null}
            {data.status === "approved" ? (
              <Button
                type="button"
                onClick={() => actionMutation.mutate("work-order")}
              >
                {data.work_order ? "Abrir OS vinculada" : "Criar OS"}
              </Button>
            ) : null}
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Panel title="Itens do orcamento">
          <div className="space-y-2">
            {data.items?.map((item) => (
              <div
                key={item.id}
                className="grid gap-2 rounded-md border border-slate-200 p-3 dark:border-slate-800 md:grid-cols-[1fr_auto]"
              >
                <div>
                  <div className="font-medium">{item.description}</div>
                  <div className="text-xs text-slate-500">
                    {item.item_type} · {item.quantity} x{" "}
                    {formatMoney(item.unit_price)}
                  </div>
                </div>
                <div className="font-semibold">{formatMoney(item.total)}</div>
              </div>
            ))}
            {!data.items?.length ? (
              <p className="text-sm text-slate-500">Nenhum item adicionado.</p>
            ) : null}
          </div>
        </Panel>

        <Panel title="Adicionar item">
          <div className="space-y-3">
            {!editable ? (
              <p className="text-sm text-amber-600">
                Orcamento fechado: itens nao podem mais ser alterados.
              </p>
            ) : null}
            <Field label="Tipo">
              <Select
                disabled={!editable}
                value={itemType}
                onChange={(event) => {
                  setItemType(event.target.value);
                  setCatalogId("");
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
              <Field label="Valor unit.">
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
            <Button
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
              {addItem.isPending ? "Adicionando..." : "Adicionar item"}
            </Button>
          </div>
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title="Descricao">
          <p className="whitespace-pre-wrap text-sm">
            {data.description || "-"}
          </p>
        </Panel>
        <Panel title="Documentos emitidos">
          <div className="space-y-2">
            {data.documents?.map((document) => (
              <div
                key={document.id}
                className="flex items-center justify-between text-sm"
              >
                <span>Versao {document.version}</span>
                <span className="text-slate-500">
                  {formatDateTime(document.generated_at)}
                </span>
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
    </div>
  );
}
