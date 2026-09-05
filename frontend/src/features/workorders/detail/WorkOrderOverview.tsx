import { Pencil } from "lucide-react";
import { Link } from "react-router-dom";

import type { WorkOrder } from "../../../api/types";
import {
  Button,
  DescriptionList,
  MetricCard,
  Panel,
} from "../../../components/ui";
import { formatDateTime, formatMoney } from "../../../utils/format";
import {
  equipmentName,
  priorityLabel,
  workOrderTotals,
} from "./presentation";

export function WorkOrderOverview({
  workOrder,
  openBalance,
  onEditTechnical,
}: {
  workOrder: WorkOrder;
  openBalance: number;
  onEditTechnical: () => void;
}) {
  const isClosed = workOrder.status.kind !== "active";
  const totals = workOrderTotals(workOrder);
  const equipment = equipmentName(workOrder);

  return (
    <>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Mao de obra" value={formatMoney(totals.laborTotal)} />
        <MetricCard label="Pecas" value={formatMoney(totals.partsTotal)} />
        <MetricCard
          label="Valor tecnico"
          value={formatMoney(totals.technicalTotal)}
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
                    className="font-medium text-[var(--primary)] hover:underline"
                    to={`/customers/${workOrder.customer.id}`}
                  >
                    {workOrder.customer.name}
                  </Link>
                ),
              },
              {
                label: "Equipamento",
                value: (
                  <Link
                    className="font-medium text-[var(--primary)] hover:underline"
                    to={`/equipment/${workOrder.equipment.id}`}
                  >
                    {equipment}
                  </Link>
                ),
              },
              { label: "Abertura", value: formatDateTime(workOrder.opened_at) },
              {
                label: "Conclusao",
                value: formatDateTime(workOrder.completed_at),
              },
              {
                label: "Responsavel",
                value: workOrder.responsible_user?.username ?? "Nao definido",
              },
              {
                label: "Prioridade",
                value: priorityLabel(workOrder.priority),
              },
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
                onClick={onEditTechnical}
              >
                <Pencil className="h-4 w-4" />
                Editar
              </Button>
            ) : undefined
          }
        >
          <div className="grid gap-5 md:grid-cols-2">
            {[
              ["Problema relatado", workOrder.problem_description],
              ["Diagnostico", workOrder.diagnosis],
              ["Servico / execucao", workOrder.service_description],
              ["Solucao", workOrder.solution],
            ].map(([label, value]) => (
              <div key={label}>
                <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  {label}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--text)]">
                  {value || "-"}
                </p>
              </div>
            ))}

            <div className="rounded-[var(--radius-lg)] bg-[var(--warning-soft)] p-3 md:col-span-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--warning)]">
                Notas internas
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--text)]">
                {workOrder.internal_notes || "Sem notas internas."}
              </p>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Conteudo interno: nao e incluido no PDF entregue ao cliente.
              </p>
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}
