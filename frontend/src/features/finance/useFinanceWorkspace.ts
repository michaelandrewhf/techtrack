import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { financeApi } from "../../api/endpoints";
import type { FinanceTabId } from "./types";

export function useFinanceWorkspace(
  activeTab: FinanceTabId,
  paymentOpen: boolean,
) {
  const dashboard = useQuery({
    queryKey: ["finance", "dashboard"],
    queryFn: financeApi.dashboard,
  });

  const activeAgreementSummary = useQuery({
    queryKey: ["finance", "agreements", "active-summary"],
    queryFn: () =>
      financeApi.agreements({ status: "active", ordering: "customer__name", page_size: 1 }),
  });

  const receivables = useQuery({
    queryKey: ["finance", "receivables"],
    queryFn: () =>
      financeApi.receivables({ ordering: "due_date", page_size: 100 }),
    enabled: activeTab === "receivables" || paymentOpen,
  });

  const payments = useQuery({
    queryKey: ["finance", "payments"],
    queryFn: () =>
      financeApi.payments({ ordering: "-paid_at", page_size: 100 }),
    enabled: activeTab === "payments",
  });

  const agreements = useQuery({
    queryKey: ["finance", "agreements"],
    queryFn: () =>
      financeApi.agreements({ ordering: "customer__name", page_size: 100 }),
    enabled: activeTab === "agreements",
  });

  const openReceivables = useMemo(
    () =>
      receivables.data?.results.filter(
        (item) => item.status !== "paid" && item.status !== "cancelled",
      ) ?? [],
    [receivables.data?.results],
  );

  return {
    dashboard,
    activeAgreementSummary,
    receivables,
    payments,
    agreements,
    openReceivables,
  };
}

export type FinanceWorkspace = ReturnType<typeof useFinanceWorkspace>;
