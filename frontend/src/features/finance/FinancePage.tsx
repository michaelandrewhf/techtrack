import { useQueryClient } from "@tanstack/react-query";
import { CircleDollarSign, Plus } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { PageHeader } from "../../components/PageHeader";
import { ErrorState, PageLoader } from "../../components/State";
import { Tabs } from "../../components/Tabs";
import { Button } from "../../components/ui";
import { FinanceDialogs } from "./FinanceDialogs";
import { FinanceMetrics, FinanceOverview } from "./FinanceOverview";
import { FinanceTabs } from "./FinanceTabs";
import type { FinanceTabId } from "./types";
import { useFinanceWorkspace } from "./useFinanceWorkspace";

const tabItems: Array<{ id: FinanceTabId; label: string }> = [
  { id: "overview", label: "Visao geral" },
  { id: "receivables", label: "Contas a receber" },
  { id: "payments", label: "Recebimentos" },
  { id: "agreements", label: "Contratos" },
];

function isFinanceTab(value: string): value is FinanceTabId {
  return tabItems.some((tab) => tab.id === value);
}

export function FinancePage() {
  const [params, setParams] = useSearchParams();
  const requestedTab = params.get("tab") ?? "overview";
  const activeTab: FinanceTabId = isFinanceTab(requestedTab)
    ? requestedTab
    : "overview";
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [agreementOpen, setAgreementOpen] = useState(false);
  const queryClient = useQueryClient();
  const workspace = useFinanceWorkspace(activeTab, paymentOpen);

  const refreshFinance = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["finance"] }),
      queryClient.invalidateQueries({ queryKey: ["customers"] }),
    ]);
  };

  const selectTab = (value: FinanceTabId) => {
    const next = new URLSearchParams(params);
    if (value === "overview") next.delete("tab");
    else next.set("tab", value);
    setParams(next, { replace: true });
  };

  if (
    workspace.dashboard.isLoading ||
    workspace.activeAgreementSummary.isLoading
  )
    return <PageLoader label="Carregando financeiro" />;

  if (
    workspace.dashboard.error ||
    workspace.activeAgreementSummary.error ||
    !workspace.dashboard.data
  ) {
    return (
      <ErrorState
        message="Nao foi possivel carregar o resumo financeiro."
        onRetry={() => {
          void workspace.dashboard.refetch();
          void workspace.activeAgreementSummary.refetch();
        }}
      />
    );
  }

  const tabs = tabItems.map((tab) => ({
    ...tab,
    count:
      tab.id === "receivables"
        ? workspace.receivables.data
          ? workspace.openReceivables.length
          : undefined
        : tab.id === "payments"
          ? workspace.payments.data?.count
          : tab.id === "agreements"
            ? workspace.agreements.data?.count
            : undefined,
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Gestao"
        title="Financeiro"
        description="Visao consolidada de contas a receber, recebimentos e contratos. Operacoes ligadas a um cliente tambem podem ser feitas dentro do proprio cliente."
        action={
          <>
            <Button type="button" onClick={() => setPaymentOpen(true)}>
              <CircleDollarSign className="h-4 w-4" />
              Registrar pagamento
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setAgreementOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Novo contrato
            </Button>
          </>
        }
      />

      <FinanceMetrics
        activeAgreementCount={workspace.activeAgreementSummary.data?.count ?? 0}
        dashboard={workspace.dashboard.data}
      />

      <Tabs
        items={tabs}
        value={activeTab}
        onChange={(value) => selectTab(value as FinanceTabId)}
      />

      <div className="mt-5">
        {activeTab === "overview" ? (
          <FinanceOverview dashboard={workspace.dashboard.data} />
        ) : (
          <FinanceTabs
            activeTab={activeTab}
            workspace={workspace}
            onOpenAgreement={() => setAgreementOpen(true)}
            onOpenPayment={() => setPaymentOpen(true)}
          />
        )}
      </div>

      <FinanceDialogs
        agreementOpen={agreementOpen}
        openReceivables={workspace.openReceivables}
        paymentOpen={paymentOpen}
        receivablesError={Boolean(workspace.receivables.error)}
        receivablesLoading={workspace.receivables.isLoading}
        onChanged={refreshFinance}
        onCloseAgreement={() => setAgreementOpen(false)}
        onClosePayment={() => setPaymentOpen(false)}
        onRetryReceivables={() => {
          void workspace.receivables.refetch();
        }}
      />
    </div>
  );
}
