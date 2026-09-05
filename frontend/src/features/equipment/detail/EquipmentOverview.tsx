import { Link } from "react-router-dom";

import type { Equipment } from "../../../api/types";
import { DescriptionList, MetricCard, Panel } from "../../../components/ui";
import { formatDateTime } from "../../../utils/format";
import { equipmentStatusLabel } from "./presentation";

export function EquipmentOverview({ equipment }: { equipment: Equipment }) {
  const activeComponents = equipment.current_components?.length ?? 0;
  const recentWorkOrders = equipment.recent_work_orders?.length ?? 0;
  const latestWorkOrder = equipment.recent_work_orders?.[0];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Componentes atuais" value={activeComponents} />
        <MetricCard label="OS recentes" value={recentWorkOrders} tone="info" />
        <MetricCard
          label="Status"
          value={equipmentStatusLabel(equipment.status)}
          tone={equipment.status === "active" ? "success" : "neutral"}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Dados do equipamento">
          <DescriptionList
            items={[
              {
                label: "Cliente",
                value: (
                  <Link
                    className="font-medium text-[var(--primary)]"
                    to={`/customers/${equipment.customer.id}`}
                  >
                    {equipment.customer.name}
                  </Link>
                ),
              },
              { label: "Tipo", value: equipment.equipment_type.name },
              { label: "Fabricante", value: equipment.manufacturer || "-" },
              { label: "Modelo", value: equipment.model || "-" },
              { label: "Serial", value: equipment.serial_number || "-" },
              { label: "Patrimonio", value: equipment.asset_tag || "-" },
              { label: "Sistema", value: equipment.operating_system || "-" },
              {
                label: "Status",
                value: equipmentStatusLabel(equipment.status),
              },
            ]}
          />
        </Panel>

        <Panel
          title="Contexto tecnico"
          subtitle="Resumo do patrimonio e do atendimento mais recente."
        >
          <div className="space-y-4 text-sm">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Observacoes
              </div>
              <p className="mt-1 whitespace-pre-wrap leading-6 text-[var(--text)]">
                {equipment.notes || "Sem observacoes."}
              </p>
            </div>
            <div className="border-t border-[var(--border)] pt-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Ultima OS carregada
              </div>
              {latestWorkOrder ? (
                <div className="mt-2">
                  <Link
                    className="font-medium text-[var(--primary)]"
                    to={`/work-orders/${latestWorkOrder.id}`}
                  >
                    {latestWorkOrder.display_number} · {latestWorkOrder.title}
                  </Link>
                  <div className="mt-1 text-xs text-[var(--text-muted)]">
                    {formatDateTime(latestWorkOrder.opened_at)} ·{" "}
                    {latestWorkOrder.status.name}
                  </div>
                </div>
              ) : (
                <p className="mt-1 text-[var(--text-muted)]">
                  Nenhuma ordem de servico recente.
                </p>
              )}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
