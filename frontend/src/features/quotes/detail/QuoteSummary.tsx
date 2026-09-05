import { Download } from "lucide-react";
import { Link } from "react-router-dom";

import type { Quote } from "../../../api/types";
import { Button, DescriptionList, Panel } from "../../../components/ui";
import { formatDate, formatDateTime, formatMoney } from "../../../utils/format";

export function QuoteSummary({
  quote,
  onDownloadVersion,
}: {
  quote: Quote;
  onDownloadVersion: (version: number) => void;
}) {
  return (
    <>
      <div className="mb-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Contexto da proposta">
          <DescriptionList
            items={[
              {
                label: "Cliente",
                value: (
                  <Link
                    className="font-medium text-[var(--primary)] hover:underline"
                    to={`/customers/${quote.customer}`}
                  >
                    {quote.customer_name}
                  </Link>
                ),
              },
              {
                label: "Equipamento",
                value: quote.equipment ? (
                  <Link
                    className="font-medium text-[var(--primary)] hover:underline"
                    to={`/equipment/${quote.equipment}`}
                  >
                    {quote.equipment_label || "Abrir equipamento"}
                  </Link>
                ) : (
                  "Nao definido"
                ),
              },
              { label: "Criado em", value: formatDateTime(quote.created_at) },
              { label: "Validade", value: formatDate(quote.valid_until) },
              { label: "Enviado em", value: formatDateTime(quote.sent_at) },
              {
                label: "Aprovado em",
                value: formatDateTime(quote.approved_at),
              },
            ]}
          />
        </Panel>

        <Panel title="Valores">
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-muted)]">
                Subtotal dos itens
              </span>
              <strong>{formatMoney(quote.items_total)}</strong>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-muted)]">Desconto geral</span>
              <strong>{formatMoney(quote.discount)}</strong>
            </div>
            <div className="flex items-end justify-between border-t border-[var(--border)] pt-4">
              <span className="font-medium">Total final</span>
              <strong className="text-2xl text-[var(--text)]">
                {formatMoney(quote.total_amount)}
              </strong>
            </div>
          </div>
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Panel title="Descricao e observacoes">
          <div className="space-y-4 text-sm">
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Descricao
              </div>
              <p className="whitespace-pre-wrap leading-6 text-[var(--text)]">
                {quote.description || "-"}
              </p>
            </div>
            <div className="border-t border-[var(--border)] pt-4">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Observacoes
              </div>
              <p className="whitespace-pre-wrap leading-6 text-[var(--text)]">
                {quote.notes || "-"}
              </p>
            </div>
          </div>
        </Panel>

        <Panel
          title="Documentos emitidos"
          subtitle="Cada emissao oficial preserva snapshot, versao e checksum."
        >
          <div className="space-y-2">
            {(quote.documents ?? []).map((document) => (
              <div
                className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] p-3"
                key={document.id}
              >
                <div>
                  <div className="font-medium text-[var(--text)]">
                    Versao {document.version}
                  </div>
                  <div className="mt-1 text-xs text-[var(--text-muted)]">
                    {formatDateTime(document.generated_at)}
                  </div>
                </div>
                <Button
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={() => onDownloadVersion(document.version)}
                >
                  <Download className="h-4 w-4" />
                  Baixar
                </Button>
              </div>
            ))}
            {!quote.documents?.length ? (
              <p className="text-sm text-[var(--text-muted)]">
                Nenhuma revisao oficial emitida.
              </p>
            ) : null}
          </div>
        </Panel>
      </div>
    </>
  );
}
