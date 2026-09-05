import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import {
  customersApi,
  equipmentApi,
  financeApi,
  quotesApi,
  workOrdersApi,
} from "../../../api/endpoints";
import { queryKeys } from "../../../api/queryKeys";
import type { CustomerModalName, CustomerTabId } from "./types";

export function useCustomerWorkspace(
  id: string,
  activeTab: CustomerTabId,
  modal: CustomerModalName,
) {
  const customer = useQuery({
    queryKey: queryKeys.customer(id),
    queryFn: () => customersApi.get(id),
    enabled: Boolean(id),
  });

  const equipment = useQuery({
    queryKey: ["equipment", "customer", id, "workspace"],
    queryFn: () =>
      equipmentApi.list({
        customer: id,
        ordering: "-created_at",
        page_size: 100,
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
    queryKey: ["work-orders", "customer", id, "workspace"],
    queryFn: () =>
      workOrdersApi.list({
        customer: id,
        ordering: "-opened_at",
        page_size: 100,
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
    queryKey: ["quotes", "customer", id, "workspace"],
    queryFn: () =>
      quotesApi.list({ customer: id, ordering: "-created_at", page_size: 100 }),
    enabled: Boolean(id) && activeTab === "quotes",
  });

  const agreements = useQuery({
    queryKey: ["finance", "customer", id, "agreements"],
    queryFn: () =>
      financeApi.agreements({
        customer: id,
        ordering: "-starts_on",
        page_size: 100,
      }),
    enabled: Boolean(id),
  });

  const receivables = useQuery({
    queryKey: ["finance", "customer", id, "receivables"],
    queryFn: () =>
      financeApi.receivables({
        customer: id,
        ordering: "-due_date",
        page_size: 100,
      }),
    enabled:
      Boolean(id) &&
      (activeTab === "overview" ||
        activeTab === "finance" ||
        modal === "payment"),
  });

  const activeAgreement = useMemo(
    () =>
      agreements.data?.results.find(
        (agreement) => agreement.status === "active",
      ),
    [agreements.data?.results],
  );

  const openReceivables = useMemo(
    () =>
      receivables.data?.results.filter(
        (row) => row.status !== "paid" && row.status !== "cancelled",
      ) ?? [],
    [receivables.data?.results],
  );

  const pending = openReceivables.reduce(
    (total, row) => total + Number(row.balance),
    0,
  );
  const overdue = openReceivables.reduce(
    (total, row) => total + (row.is_overdue ? Number(row.balance) : 0),
    0,
  );

  return {
    customer,
    equipment,
    recentWorkOrders,
    workOrders,
    recentQuotes,
    quotes,
    agreements,
    receivables,
    activeAgreement,
    openReceivables,
    pending,
    overdue,
  };
}

export type CustomerWorkspace = ReturnType<typeof useCustomerWorkspace>;
