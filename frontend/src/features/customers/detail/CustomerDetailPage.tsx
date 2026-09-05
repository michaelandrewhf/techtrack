import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, FileText, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { financeApi } from "../../../api/endpoints";
import type { ServiceAgreement } from "../../../api/types";
import { Breadcrumbs } from "../../../components/Breadcrumbs";
import { PageHeader } from "../../../components/PageHeader";
import { ErrorState, PageLoader } from "../../../components/State";
import { Tabs } from "../../../components/Tabs";
import { Badge, Button } from "../../../components/ui";
import { CustomerDialogs } from "./CustomerDialogs";
import { CustomerOverview } from "./CustomerOverview";
import { CustomerTabs } from "./CustomerTabs";
import { customerStatusLabel } from "./presentation";
import type { CustomerModalName, CustomerTabId } from "./types";
import { useCustomerWorkspace } from "./useCustomerWorkspace";

const tabs: Array<{ id: CustomerTabId; label: string }> = [
  { id: "overview", label: "Visao geral" },
  { id: "equipment", label: "Equipamentos" },
  { id: "work-orders", label: "Ordens de servico" },
  { id: "quotes", label: "Orcamentos" },
  { id: "finance", label: "Financeiro" },
];

function isCustomerTab(value: string): value is CustomerTabId {
  return tabs.some((tab) => tab.id === value);
}

export function CustomerDetailPage() {
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const requestedTab = params.get("tab") ?? "overview";
  const activeTab: CustomerTabId = isCustomerTab(requestedTab)
    ? requestedTab
    : "overview";
  const [modal, setModal] = useState<CustomerModalName>(null);
  const queryClient = useQueryClient();
  const workspace = useCustomerWorkspace(id, activeTab, modal);

  const invalidateCustomerWorkspace = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["customers"] }),
      queryClient.invalidateQueries({ queryKey: ["equipment"] }),
      queryClient.invalidateQueries({ queryKey: ["work-orders"] }),
      queryClient.invalidateQueries({ queryKey: ["quotes"] }),
      queryClient.invalidateQueries({ queryKey: ["finance"] }),
    ]);
  };

  const endAgreement = useMutation({
    mutationFn: (agreement: ServiceAgreement) =>
      financeApi.updateAgreement(agreement.id, {
        status: "ended",
        ends_on: new Date().toISOString().slice(0, 10),
      }),
    onSuccess: invalidateCustomerWorkspace,
  });

  if (workspace.customer.isLoading) return <PageLoader />;
  if (workspace.customer.error || !workspace.customer.data)
    return <ErrorState message="Cliente nao encontrado." />;

  const customer = workspace.customer.data;

  const selectTab = (value: CustomerTabId) => {
    const next = new URLSearchParams(params);
    if (value === "overview") next.delete("tab");
    else next.set("tab", value);
    setParams(next, { replace: true });
  };

  const tabItems = tabs.map((tab) => ({
    ...tab,
    count:
      tab.id === "equipment"
        ? customer.equipment_count
        : tab.id === "work-orders"
          ? (workspace.workOrders.data?.count ??
            workspace.recentWorkOrders.data?.count)
          : tab.id === "quotes"
            ? (workspace.quotes.data?.count ?? workspace.recentQuotes.data?.count)
            : undefined,
  }));

  const overviewLoading =
    activeTab === "overview" &&
    (workspace.agreements.isLoading ||
      workspace.receivables.isLoading ||
      workspace.recentWorkOrders.isLoading ||
      workspace.recentQuotes.isLoading);

  const overviewError =
    activeTab === "overview" &&
    (workspace.agreements.error ||
      workspace.receivables.error ||
      workspace.recentWorkOrders.error ||
      workspace.recentQuotes.error);

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Clientes", to: "/customers" },
          { label: customer.name },
        ]}
      />
      <PageHeader
        eyebrow={
          workspace.agreements.isLoading
            ? "Relacionamento"
            : workspace.activeAgreement
              ? "Cliente mensalista"
              : "Cliente avulso"
        }
        title={customer.name}
        description="Dados, patrimonio tecnico, atendimentos, orcamentos e financeiro em um unico contexto."
        meta={
          <div className="flex flex-wrap gap-2">
            <Badge
              tone={customer.status === "active" ? "success" : "neutral"}
            >
              {customerStatusLabel(customer.status)}
            </Badge>
            {!workspace.agreements.isLoading ? (
              <Badge tone={workspace.activeAgreement ? "info" : "neutral"}>
                {workspace.activeAgreement ? "Mensalista" : "Avulso"}
              </Badge>
            ) : null}
          </div>
        }
        action={
          <>
            <Link to={`/work-orders/new?customer=${id}`}>
              <Button type="button">
                <ClipboardList className="h-4 w-4" />
                Nova OS
              </Button>
            </Link>
            <Link to={`/quotes/new?customer=${id}`}>
              <Button type="button" variant="secondary">
                <FileText className="h-4 w-4" />
                Novo orcamento
              </Button>
            </Link>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModal("equipment")}
            >
              <Plus className="h-4 w-4" />
              Equipamento
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setModal("edit")}
            >
              <Pencil className="h-4 w-4" />
              Editar
            </Button>
          </>
        }
      />

      <Tabs items={tabItems} value={activeTab} onChange={(value) => selectTab(value as CustomerTabId)} />

      <div className="mt-5">
        {activeTab === "overview" ? (
          overviewLoading ? (
            <PageLoader label="Carregando resumo do cliente" />
          ) : overviewError ? (
            <ErrorState
              message="Nao foi possivel carregar todo o resumo do cliente."
              onRetry={() => {
                void workspace.agreements.refetch();
                void workspace.receivables.refetch();
                void workspace.recentWorkOrders.refetch();
                void workspace.recentQuotes.refetch();
              }}
            />
          ) : (
            <CustomerOverview
              activeAgreement={workspace.activeAgreement}
              customer={customer}
              overdue={workspace.overdue}
              pending={workspace.pending}
              recentQuotes={workspace.recentQuotes.data?.results ?? []}
              recentWorkOrders={workspace.recentWorkOrders.data?.results ?? []}
              onCreateAgreement={() => setModal("agreement")}
              onEdit={() => setModal("edit")}
              onEndAgreement={(agreement) => endAgreement.mutate(agreement)}
              onSelectTab={selectTab}
            />
          )
        ) : (
          <CustomerTabs
            activeTab={activeTab}
            customerId={id}
            workspace={workspace}
            onAddEquipment={() => setModal("equipment")}
            onCreateAgreement={() => setModal("agreement")}
            onOpenPayment={() => setModal("payment")}
          />
        )}
      </div>

      <CustomerDialogs
        customer={customer}
        customerId={id}
        modal={modal}
        openReceivables={workspace.openReceivables}
        onChanged={invalidateCustomerWorkspace}
        onClose={() => setModal(null)}
      />
    </div>
  );
}
