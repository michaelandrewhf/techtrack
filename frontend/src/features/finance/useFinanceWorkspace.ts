import { useQuery } from "@tanstack/react-query";

import { financeApi } from "../../api/endpoints";
import type { FinanceTabId } from "./types";

const PAGE_SIZE = 25;

export function useFinanceWorkspace(activeTab: FinanceTabId, page: number) {
  const dashboard = useQuery({
    queryKey: ["finance", "dashboard"],
    queryFn: () => financeApi.dashboard(),
  });

  const activeAgreementSummary = useQuery({
    queryKey: ["finance", "agreements", "active-summary"],
    queryFn: () => financeApi.agreements({ status: "active", page_size: 1 }),
  });

  const receivables = useQuery({
    queryKey: ["finance", "receivables", "open", page],
    queryFn: () =>
      financeApi.receivables({
        open: true,
        ordering: "due_date",
        page,
        page_size: PAGE_SIZE,
      }),
    enabled: activeTab === "receivables",
  });

  const payments = useQuery({
    queryKey: ["finance", "payments", page],
    queryFn: () =>
      financeApi.payments({
        ordering: "-paid_at",
        page,
        page_size: PAGE_SIZE,
      }),
    enabled: activeTab === "payments",
  });

  const agreements = useQuery({
    queryKey: ["finance", "agreements", page],
    queryFn: () =>
      financeApi.agreements({
        ordering: "customer__name",
        page,
        page_size: PAGE_SIZE,
      }),
    enabled: activeTab === "agreements",
  });

  return {
    dashboard,
    activeAgreementSummary,
    receivables,
    payments,
    agreements,
    openReceivables: receivables.data?.results ?? [],
  };
}

export type FinanceWorkspace = ReturnType<typeof useFinanceWorkspace>;
