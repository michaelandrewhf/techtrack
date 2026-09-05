import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { useState } from "react";

import { catalogApi, quotesApi } from "../../../api/endpoints";
import type { Quote, QuoteItem } from "../../../api/types";
import { DataTable } from "../../../components/DataTable";
import {
  Button,
  Field,
  Input,
  Notice,
  Panel,
  Select,
} from "../../../components/ui";
import { errorMessage } from "../../../utils/errors";
import { formatMoney } from "../../../utils/format";

type ItemType = "service" | "part" | "free";

export function QuoteItems({
  quote,
  editable,
  onChanged,
}: {
  quote: Quote;
  editable: boolean;
  onChanged: () => Promise<void> | void;
}) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [itemType, setItemType] = useState<ItemType>("service");
  const [catalogId, setCatalogId] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [discount, setDiscount] = useState("0");

  const serviceTypes = useQuery({
    queryKey: ["catalog", "service-types", "quote-composer"],
    queryFn: () =>
      catalogApi("service-types").list({ is_active: true, page_size: 100 }),
    enabled: composerOpen && editable && itemType === "service",
  });
  const parts = useQuery({
    queryKey: ["catalog", "parts", "quote-composer"],
    queryFn: () =>
      catalogApi("parts").list({ is_active: true, page_size: 100 }),
    enabled: composerOpen && editable && itemType === "part",
  });

  const resetComposer = () => {
    setCatalogId("");
    setDescription("");
    setQuantity("1");
    setUnitPrice("");
    setDiscount("0");
  };

  const addItem = useMutation({
    mutationFn: () =>
      quotesApi.addItem(quote.id, {
        item_type: itemType,
        service_type: itemType === "service" ? catalogId : null,
        part: itemType === "part" ? catalogId : null,
        description,
        quantity,
        unit_price: unitPrice,
        discount,
      }),
    onSuccess: async () => {
      resetComposer();
      setComposerOpen(false);
      await onChanged();
    },
  });

  const source =
    itemType === "service" ? serviceTypes.data?.results : parts.data?.results;

  return (
    <div className="grid gap-5 xl:grid-cols-[1.45fr_0.75fr]">
      <Panel
        title="Itens do orcamento"
        subtitle="Servicos, pecas e itens livres apresentados como composicao comercial."
      >
        <DataTable<QuoteItem>
          empty="Nenhum item adicionado."
          getRowKey={(row) => row.id}
          rows={quote.items ?? []}
          columns={[
            {
              header: "Descricao",
              cell: (row) => (
                <span className="font-medium text-[var(--text)]">
                  {row.description}
                </span>
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
            ? "Abra o formulario somente quando precisar alterar a composicao."
            : "Documento fechado para alteracoes."
        }
        action={
          editable ? (
            <Button
              size="sm"
              type="button"
              variant={composerOpen ? "ghost" : "secondary"}
              onClick={() => {
                if (composerOpen) resetComposer();
                setComposerOpen((value) => !value);
              }}
            >
              {composerOpen ? (
                <X className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {composerOpen ? "Fechar" : "Novo item"}
            </Button>
          ) : undefined
        }
      >
        {!editable ? (
          <Notice tone="warning">
            Itens nao podem ser alterados no estado atual.
          </Notice>
        ) : null}

        {editable && !composerOpen ? (
          <p className="text-sm text-[var(--text-muted)]">
            Os catalogos de servicos e pecas so sao carregados quando o
            formulario e aberto.
          </p>
        ) : null}

        {editable && composerOpen ? (
          <div className="space-y-3">
            <Field label="Tipo">
              <Select
                value={itemType}
                onChange={(event) => {
                  setItemType(event.target.value as ItemType);
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
                  value={catalogId}
                  onChange={(event) => {
                    const value = event.target.value;
                    setCatalogId(value);
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
                  {(source ?? []).map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}

            <Field label="Descricao">
              <Input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>

            <div className="grid grid-cols-3 gap-2">
              <Field label="Qtd">
                <Input
                  inputMode="decimal"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
              </Field>
              <Field label="Valor">
                <Input
                  inputMode="decimal"
                  value={unitPrice}
                  onChange={(event) => setUnitPrice(event.target.value)}
                />
              </Field>
              <Field label="Desconto">
                <Input
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
        ) : null}
      </Panel>
    </div>
  );
}
