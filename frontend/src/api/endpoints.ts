import { apiRequest, toQueryString } from "./client";
import type {
  Billing,
  CatalogItem,
  Customer,
  Dashboard,
  Equipment,
  EquipmentComponent,
  MaintenanceItem,
  Paginated,
  User,
  WorkOrder,
  WorkOrderPart,
  WorkOrderService,
  WorkOrderTimeline,
} from "./types";

export type Filters = Record<
  string,
  string | number | boolean | undefined | null
>;

export const authApi = {
  login: (body: { username: string; password: string }) =>
    apiRequest<{ access: string; refresh: string }>("/token/", {
      method: "POST",
      body,
      skipAuth: true,
    }),
  me: () => apiRequest<User>("/v1/me/"),
};

export const dashboardApi = {
  get: () => apiRequest<Dashboard>("/v1/dashboard/"),
};

export const customersApi = {
  list: (filters: Filters = {}) =>
    apiRequest<Paginated<Customer>>(`/v1/customers/${toQueryString(filters)}`),
  get: (id: string) => apiRequest<Customer>(`/v1/customers/${id}/`),
  create: (body: Partial<Customer>) =>
    apiRequest<Customer>("/v1/customers/", { method: "POST", body }),
  update: (id: string, body: Partial<Customer>) =>
    apiRequest<Customer>(`/v1/customers/${id}/`, { method: "PATCH", body }),
  remove: (id: string) =>
    apiRequest<null>(`/v1/customers/${id}/`, { method: "DELETE" }),
  equipment: (id: string) =>
    apiRequest<Paginated<Equipment>>(`/v1/customers/${id}/equipment/`),
  workOrders: (id: string) =>
    apiRequest<Paginated<WorkOrder>>(`/v1/customers/${id}/work-orders/`),
};

export const equipmentApi = {
  list: (filters: Filters = {}) =>
    apiRequest<Paginated<Equipment>>(`/v1/equipment/${toQueryString(filters)}`),
  get: (id: string) => apiRequest<Equipment>(`/v1/equipment/${id}/`),
  create: (body: Record<string, unknown>) =>
    apiRequest<Equipment>("/v1/equipment/", { method: "POST", body }),
  update: (id: string, body: Record<string, unknown>) =>
    apiRequest<Equipment>(`/v1/equipment/${id}/`, { method: "PATCH", body }),
  components: (id: string) =>
    apiRequest<Paginated<EquipmentComponent>>(
      `/v1/equipment/${id}/components/`,
    ),
  addComponent: (id: string, body: Record<string, unknown>) =>
    apiRequest<EquipmentComponent>(`/v1/equipment/${id}/components/`, {
      method: "POST",
      body,
    }),
  removeComponent: (id: string, componentId: string) =>
    apiRequest<EquipmentComponent>(
      `/v1/equipment/${id}/components/${componentId}/remove/`,
      {
        method: "POST",
        body: {},
      },
    ),
  maintenance: (id: string) =>
    apiRequest<MaintenanceItem[]>(`/v1/equipment/${id}/maintenance/`),
};

export const workOrdersApi = {
  list: (filters: Filters = {}) =>
    apiRequest<Paginated<WorkOrder>>(
      `/v1/work-orders/${toQueryString(filters)}`,
    ),
  get: (id: string) => apiRequest<WorkOrder>(`/v1/work-orders/${id}/`),
  create: (body: Record<string, unknown>) =>
    apiRequest<WorkOrder>("/v1/work-orders/", { method: "POST", body }),
  update: (id: string, body: Record<string, unknown>) =>
    apiRequest<WorkOrder>(`/v1/work-orders/${id}/`, { method: "PATCH", body }),
  timeline: (id: string) =>
    apiRequest<Paginated<WorkOrderTimeline>>(`/v1/work-orders/${id}/timeline/`),
  changeStatus: (
    id: string,
    body: { status_id: string; comment?: string; description?: string },
  ) =>
    apiRequest<WorkOrder>(`/v1/work-orders/${id}/change-status/`, {
      method: "POST",
      body,
    }),
  complete: (id: string, body: Record<string, unknown>) =>
    apiRequest<WorkOrder>(`/v1/work-orders/${id}/complete/`, {
      method: "POST",
      body,
    }),
  cancel: (id: string, body: { comment?: string; description?: string }) =>
    apiRequest<WorkOrder>(`/v1/work-orders/${id}/cancel/`, {
      method: "POST",
      body,
    }),
  addService: (id: string, body: Record<string, unknown>) =>
    apiRequest<WorkOrderService>(`/v1/work-orders/${id}/services/`, {
      method: "POST",
      body,
    }),
  voidService: (id: string, serviceId: string, reason: string) =>
    apiRequest<WorkOrderService>(
      `/v1/work-orders/${id}/services/${serviceId}/void/`,
      {
        method: "POST",
        body: { reason },
      },
    ),
  addPart: (id: string, body: Record<string, unknown>) =>
    apiRequest<WorkOrderPart>(`/v1/work-orders/${id}/parts/`, {
      method: "POST",
      body,
    }),
  voidPart: (id: string, partId: string, reason: string) =>
    apiRequest<WorkOrderPart>(`/v1/work-orders/${id}/parts/${partId}/void/`, {
      method: "POST",
      body: { reason },
    }),
  getBilling: (id: string) =>
    apiRequest<Billing>(`/v1/work-orders/${id}/billing/`),
  saveBilling: (id: string, body: Record<string, unknown>) =>
    apiRequest<Billing>(`/v1/work-orders/${id}/billing/`, {
      method: "PUT",
      body,
    }),
};

export function catalogApi(resource: string) {
  return {
    list: (filters: Filters = {}) =>
      apiRequest<Paginated<CatalogItem>>(
        `/v1/${resource}/${toQueryString(filters)}`,
      ),
    create: (body: Record<string, unknown>) =>
      apiRequest<CatalogItem>(`/v1/${resource}/`, { method: "POST", body }),
    update: (id: string, body: Record<string, unknown>) =>
      apiRequest<CatalogItem>(`/v1/${resource}/${id}/`, {
        method: "PATCH",
        body,
      }),
  };
}
