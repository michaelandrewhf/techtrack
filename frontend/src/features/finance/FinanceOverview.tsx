import { Link } from "react-router-dom";

import type { FinanceDashboard } from "../../api/types";
import { MetricCard, Panel } from "../../components/ui";
import { formatDate, formatDateTime, formatMoney } from "../../utils/format";

export function FinanceMetrics({
  dashboard,
  activeAgreementCount,
}: {
  dashboard: FinanceDashboard;
  activeAgreementCount: number;
}) {
  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        label="A receber"
        value={formatMoney(dashboard.pending_total)}
        tone="warning"
      />
      <MetricCard
        label="Recebido no mes"
        value={formatMoney(dashboard.received_this_month)}
        tone="success"
      />
      <MetricCard
        label="Em atraso"
        value={formatMoney(dashboard.overdue_total)}
        tone={Number(dashboard.overdue_total) > 0 ? "danger" : "success"}
      />
      <MetricCard
        label="Contratos ativos"
        value={activeAgreementCount}
        tone="info"
      />
    </div>
  );
}

export function FinanceOverview({
  dashboard,
}: {
  dashboard: FinanceDashboard;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Panel
        title="Proximos vencimentos"
        subtitle="Contas abertas com vencimento mais proximo."
      >
        <div className="space-y-2">
          {dashboard.upcoming.map((item) => (
            <Link
              className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] p-3 transition hover:bg-[var(--surface-subtle)]"
              key={item.id}
              to={`/customers/${item.customer}?tab=finance`}
            >
              <div>
                <div className="font-medium text-[var(--text)]">
                  {item.customer_name}
                </div>
                <div className="mt-1 text-xs text-[var(--text-muted)]">
                  {item.description} · vence {formatDate(item.due_date)}
                </div>
              </div>
              <strong className="text-[var(--text)]">
                {formatMoney(item.balance)}
              </strong>
            </Link>
          ))}
          {!dashboard.upcoming.length ? (
            <p className="text-sm text-[var(--text-muted)]">
              Nenhum vencimento futuro em aberto.
            </p>
          ) : null}
        </div>
      </Panel>

      <Panel
        title="Recebimentos recentes"
        subtitle="Ultimas baixas registradas no sistema."
      >
        <div className="space-y-2">
          {dashboard.recent_payments.map((payment) => (
            <div
              className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] p-3"
              key={payment.id}
            >
              <div>
                <div className="font-medium text-[var(--text)]">
                  {formatMoney(payment.amount)}
                </div>
                <div className="mt-1 text-xs text-[var(--text-muted)]">
                  {payment.payment_method_name}
                </div>
              </div>
              <div className="text-xs text-[var(--text-muted)]">
                {formatDateTime(payment.paid_at)}
              </div>
            </div>
          ))}
          {!dashboard.recent_payments.length ? (
            <p className="text-sm text-[var(--text-muted)]">
              Nenhum recebimento recente.
            </p>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}
