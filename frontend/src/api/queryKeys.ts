import type { Filters } from "./endpoints";

export const queryKeys = {
  dashboard: ["dashboard"] as const,
  me: ["me"] as const,
  customers: (filters: Filters = {}) => ["customers", filters] as const,
  customer: (id: string) => ["customer", id] as const,
  customerEquipment: (id: string) => ["customer-equipment", id] as const,
  customerWorkOrders: (id: string) => ["customer-work-orders", id] as const,
  equipment: (filters: Filters = {}) => ["equipment", filters] as const,
  equipmentDetail: (id: string) => ["equipment-detail", id] as const,
  maintenance: (id: string) => ["equipment-maintenance", id] as const,
  workOrders: (filters: Filters = {}) => ["work-orders", filters] as const,
  workOrder: (id: string) => ["work-order", id] as const,
  catalog: (resource: string, filters: Filters = {}) =>
    ["catalog", resource, filters] as const,
};
