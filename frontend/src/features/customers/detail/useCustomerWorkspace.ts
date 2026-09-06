import { useQuery } from "@tanstack/react-query";

import {
  customersApi,
  equipmentApi,
  financeApi,
  quotesApi,
  workOrdersApi,
} from "../../../api/endpoints";
import { queryKeys } from "../../../api/queryKeys";
import type { CustomerTabId } from "./types";

const PAGE_SIZE = 25;

export type CustomerWorkspacePages = {
  resource: number;
  receivables: number;
  agreements: number;
};

export function useCustomerWorkspace(
  id: string,
  activeTab: CustomerTabId,
  pages: CustomerWorkspacePages,
) {
  const customer = useQuery({
    queryKey: queryKeys.customer(id),
    queryFn: () => customersApi.get(id),
    enabled: Boolean(id),
  });

  const equipment = useQuery({
    queryKey: ["equipment", "customer", id, "workspace", pages.resource],
    queryFn: () =>
      equipmentApi.list({
        customer: id,
        ordering: "-created_at",
        page: pages.resource,
        page_size: PAGE_SIZE,
      }),
    enabled: Boolean(id) && activeTab === "equipment",
  });

  const recentWorkOrders = useQuery({
    queryKey: ["work-orders", "customer", id, "recent"],
    queryFn: () =>
      workOrdersApi.list({
        customer: id,
        ordering: "-opened_at",
        page_size: 4,
      }),
    enabled: Boolean(id) && activeTab === "overview",
  });

  const workOrders = useQuery({
    queryKey: ["work-orders", "customer", id, "workspace", pages.resource],
    queryFn: () =>
      workOrdersApi.list({
        customer: id,
        ordering: "-opened_at",
        page: pages.resource,
        page_size: PAGE_SIZE,
      }),
    enabled: Boolean(id) && activeTab === "work-orders",
  });

  const recentQuotes = useQuery({
    queryKey: ["quotes", "customer", id, "recent"],
    queryFn: () =>
      quotesApi.list({ customer: id, ordering: "-created_at", page_size: 4 }),
    enabled: Boolean(id) && activeTab === "overview",
  });

  const quotes = useQuery({
    queryKey: ["quotes", "customer", id, "workspace", pages.resource],
    queryFn: () =>
      quotesApi.list({
        customer: id,
        ordering: "-created_at",
        page: pages.resource,
        page_size: PAGE_SIZE,
      }),
    enabled: Boolean(id) && activeTab === "quotes",
  });

  const activeAgreementSummary = useQuery({
    queryKey: ["finance", "customer", id, "active-agreement"],
    queryFn: () =>
      financeApi.agreements({
        customer: id,
        status: "active",
        ordering: "-starts_on",
        page_size: 1,
      }),
    enabled: Boolean(id),
  });

  const agreements = useQuery({
    queryKey: ["finance", "customer", id, "agreements", pages.agreements],
    queryFn: () =>
      financeApi.agreements({
        customer: id,
        ordering: "-starts_on",
        page: pages.agreements,
        page_size: PAGE_SIZE,
      }),
    enabled: Boolean(id) && activeTab === "finance",
  });

  const financeSummary = useQuery({
    queryKey: ["finance", "customer", id, "summary"],
    queryFn: () => financeApi.dashboard({ customer: id }),
    enabled:
      Boolean(id) && (activeTab === "overview" || activeTab === "finance"),
  });

  const receivables = useQuery({
    queryKey: ["finance", "customer", id, "receivables", pages.receivables],
    queryFn: () =>
      financeApi.receivables({
        customer: id,
        open: true,
        ordering: "due_date",
        page: pages.receivables,
        page_size: PAGE_SIZE,
      }),
    enabled: Boolean(id) && activeTab === "finance",
  });

  const activeAgreement = activeAgreementSummary.data?.results[0];

  return {
    customer,
    equipment,
    recentWorkOrders,
    workOrders,
    recentQuotes,
    quotes,
    activeAgreementSummary,
    agreements,
    financeSummary,
    receivables,
    activeAgreement,
    openReceivables: receivables.data?.results ?? [],
    pending: Number(financeSummary.data?.pending_total ?? 0),
    overdue: Number(financeSummary.data?.overdue_total ?? 0),
  };
}

export type CustomerWorkspace = ReturnType<typeof useCustomerWorkspace>;
