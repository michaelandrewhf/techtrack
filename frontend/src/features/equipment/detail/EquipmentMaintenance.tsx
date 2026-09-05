import type { MaintenanceItem } from "../../../api/types";
import { ErrorState, PageLoader } from "../../../components/State";
import { Badge, Panel } from "../../../components/ui";
import { formatDateTime } from "../../../utils/format";
import { maintenanceLabel, maintenanceTone } from "./presentation";

export function EquipmentMaintenance({
  items,
  loading,
  error,
  onRetry,
}: {
  items: MaintenanceItem[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  if (loading) return <PageLoader label="Carregando manutencao preventiva" />;
  if (error)
    return (
      <ErrorState
        message="Nao foi possivel carregar a manutencao preventiva."
        onRetry={onRetry}
      />
    );

  return (
    <Panel
      title="Manutencao preventiva"
      subtitle="Prazos derivados do historico real de servicos concluidos."
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((row) => (
          <div
            className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4"
            key={row.service_type.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="font-medium text-[var(--text)]">
                {row.service_type.name}
              </div>
              <Badge tone={maintenanceTone(row.status)}>
                {maintenanceLabel(row.status)}
              </Badge>
            </div>
            <dl className="mt-3 grid gap-2 text-sm text-[var(--text-muted)] sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide">Ultima</dt>
                <dd>{formatDateTime(row.last_performed_at)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide">Proxima</dt>
                <dd>{formatDateTime(row.next_due_at)}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase tracking-wide">
                  Intervalo recomendado
                </dt>
                <dd>
                  {row.recommended_interval_value ?? "-"}{" "}
                  {row.recommended_interval_unit}
                </dd>
              </div>
            </dl>
          </div>
        ))}
        {!items.length ? (
          <p className="text-sm text-[var(--text-muted)]">
            Nenhuma regra preventiva aplicavel a este equipamento.
          </p>
        ) : null}
      </div>
    </Panel>
  );
}
