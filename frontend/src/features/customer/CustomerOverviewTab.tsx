import {
  ClipboardList,
  Laptop,
  Pencil,
  Plus,
  UserRound,
  WalletCards,
} from "lucide-react";
import { Link } from "react-router-dom";

import type {
  Customer,
  Quote,
  ServiceAgreement,
  WorkOrder,
} from "../../api/types";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import {
  Badge,
  Button,
  DescriptionList,
  MetricCard,
  Panel,
} from "../../components/ui";
import { formatDate, formatDateTime, formatMoney } from "../../utils/format";
import { customerStatusLabel, quoteTone } from "./detail";

export function CustomerOverviewTab({
  customer,
  activeAgreement,
  equipmentCount,
  workOrders,
  quotes,
  pending,
  overdue,
  onEdit,
  onOpenAgreement,
  onEndAgreement,
  onSelectTab,
}: {
  customer: Customer;
  activeAgreement?: ServiceAgreement;
  equipmentCount: number;
  workOrders: WorkOrder[];
  quotes: Quote[];
  pending: number;
  overdue: number;
  onEdit: () => void;
  onOpenAgreement: () => void;
  onEndAgreement: (agreement: ServiceAgreement) => void;
  onSelectTab: (tab: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<UserRound className="h-5 w-5" />}
          label="Relacionamento"
          tone={activeAgreement ? "info" : "neutral"}
          value={activeAgreement ? "Mensalista" : "Avulso"}
          hint={
            activeAgreement
              ? `${formatMoney(activeAgreement.amount)} / mes · vence dia ${activeAgreement.billing_day}`
              : "Sem contrato recorrente ativo"
          }
        />
        <MetricCard
          icon={<Laptop className="h-5 w-5" />}
          label="Equipamentos"
          value={equipmentCount}
          hint="Patrimonio vinculado ao cliente"
        />
        <MetricCard
          icon={<ClipboardList className="h-5 w-5" />}
          label="OS abertas"
          tone={
            (customer.active_work_order_count ?? 0) > 0 ? "warning" : "neutral"
          }
          value={customer.active_work_order_count ?? 0}
          hint={`Ultima OS: ${formatDateTime(customer.latest_work_order_at)}`}
        />
        <MetricCard
          icon={<WalletCards className="h-5 w-5" />}
          label="Saldo pendente"
          tone={overdue > 0 ? "danger" : pending > 0 ? "warning" : "success"}
          value={formatMoney(pending)}
          hint={
            overdue > 0
              ? `${formatMoney(overdue)} em atraso`
              : "Sem atraso identificado"
          }
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1.4fr]">
        <Panel
          title="Cadastro e contato"
          action={
            <Button size="sm" type="button" variant="ghost" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
              Editar
            </Button>
          }
        >
          <DescriptionList
            items={[
              { label: "Telefone", value: customer.phone || "-" },
              { label: "WhatsApp", value: customer.whatsapp || "-" },
              { label: "E-mail", value: customer.email || "-" },
              {
                label: "Cliente desde",
                value: formatDate(customer.customer_since),
              },
              {
                label: "Status",
                value: customerStatusLabel(customer.status),
              },
              {
                label: "Observacoes",
                value: customer.notes || "Sem observacoes.",
              },
            ]}
          />
        </Panel>

        <Panel
          title="Contrato / mensalidade"
          subtitle="O perfil avulso ou mensalista e derivado do contrato vigente, sem duplicar estado no cadastro."
          action={
            !activeAgreement ? (
              <Button size="sm" type="button" onClick={onOpenAgreement}>
                <Plus className="h-4 w-4" />
                Tornar mensalista
              </Button>
            ) : undefined
          }
        >
          {activeAgreement ? (
            <div className="space-y-4">
              <div className="rounded-[var(--tt-radius-md)] bg-[var(--tt-brand-soft)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-[var(--tt-text)]">
                      {activeAgreement.name}
                    </div>
                    <div className="mt-1 text-sm text-[var(--tt-text-muted)]">
                      Desde {formatDate(activeAgreement.starts_on)} ·{" "}
                      {formatMoney(activeAgreement.amount)} por mes · vencimento
                      dia {activeAgreement.billing_day}
                    </div>
                  </div>
                  <Badge tone="success">Ativo</Badge>
                </div>
              </div>
              <ConfirmDialog
                title="Encerrar contrato"
                description="O contrato sera encerrado hoje e permanecera no historico financeiro do cliente."
                confirmLabel="Encerrar contrato"
                onConfirm={() => onEndAgreement(activeAgreement)}
              >
                <Button type="button" variant="secondary">
                  Encerrar mensalidade
                </Button>
              </ConfirmDialog>
            </div>
          ) : (
            <div className="rounded-[var(--tt-radius-md)] border border-dashed border-[var(--tt-border-strong)] bg-[var(--tt-surface-subtle)] p-5 text-center">
              <p className="text-sm text-[var(--tt-text-muted)]">
                Este cliente e atendido como avulso. O historico de contratos
                anteriores continua preservado.
              </p>
              <Button className="mt-4" type="button" onClick={onOpenAgreement}>
                Tornar mensalista
              </Button>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel
          title="Atendimentos recentes"
          action={
            <button
              className="text-sm font-medium text-[var(--tt-brand)] hover:text-[var(--tt-brand-hover)]"
              type="button"
              onClick={() => onSelectTab("work-orders")}
            >
              Ver todas
            </button>
          }
        >
          <div className="space-y-2">
            {workOrders.slice(0, 4).map((row) => (
              <Link
                className="flex items-center justify-between gap-4 rounded-[var(--tt-radius-sm)] border border-[var(--tt-border)] p-3 transition hover:bg-[var(--tt-surface-subtle)]"
                key={row.id}
                to={`/work-orders/${row.id}`}
              >
                <div className="min-w-0">
                  <div className="font-medium text-[var(--tt-text)]">
                    {row.display_number} · {row.title}
                  </div>
                  <div className="mt-1 text-xs text-[var(--tt-text-muted)]">
                    {formatDateTime(row.opened_at)}
                  </div>
                </div>
                <Badge>{row.status.name}</Badge>
              </Link>
            ))}
            {!workOrders.length ? (
              <p className="text-sm text-[var(--tt-text-muted)]">
                Nenhuma OS para este cliente.
              </p>
            ) : null}
          </div>
        </Panel>

        <Panel
          title="Orcamentos recentes"
          action={
            <button
              className="text-sm font-medium text-[var(--tt-brand)] hover:text-[var(--tt-brand-hover)]"
              type="button"
              onClick={() => onSelectTab("quotes")}
            >
              Ver todos
            </button>
          }
        >
          <div className="space-y-2">
            {quotes.slice(0, 4).map((row) => (
              <Link
                className="flex items-center justify-between gap-4 rounded-[var(--tt-radius-sm)] border border-[var(--tt-border)] p-3 transition hover:bg-[var(--tt-surface-subtle)]"
                key={row.id}
                to={`/quotes/${row.id}`}
              >
                <div className="min-w-0">
                  <div className="font-medium text-[var(--tt-text)]">
                    {row.display_number} · {row.title}
                  </div>
                  <div className="mt-1 text-xs text-[var(--tt-text-muted)]">
                    Total {formatMoney(row.total_amount)}
                  </div>
                </div>
                <Badge tone={quoteTone(row.status)}>{row.status}</Badge>
              </Link>
            ))}
            {!quotes.length ? (
              <p className="text-sm text-[var(--tt-text-muted)]">
                Nenhum orcamento para este cliente.
              </p>
            ) : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}
