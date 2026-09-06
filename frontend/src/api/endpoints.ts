import { apiDownload, apiRequest, toQueryString } from "./client";
import type {
  Billing,
  CatalogItem,
  Customer,
  Dashboard,
  Equipment,
  EquipmentComponent,
  FinanceDashboard,
  MaintenanceItem,
  Paginated,
  Payment,
  Quote,
  QuoteItem,
  Receivable,
  ServiceAgreement,
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
    apiRequest<{ access: string }>("/token/", {
      method: "POST",
      body,
      skipAuth: true,
    }),
  logout: () =>
    apiRequest<void>("/token/logout/", {
      method: "POST",
      skipAuth: true,
      keepalive: true,
    }),
  me: () => apiRequest<User>("/v1/me/"),
};

export const dashboardApi = {
  get: () => apiRequest<Dashboard>("/v1/dashboard/"),
};

export const financeApi = {
  dashboard: (filters: Filters = {}) =>
    apiRequest<FinanceDashboard>(
      `/v1/finance/dashboard/${toQueryString(filters)}`,
    ),
  receivables: (filters: Filters = {}) =>
    apiRequest<Paginated<Receivable>>(
      `/v1/receivables/${toQueryString(filters)}`,
    ),
  createReceivable: (body: Record<string, unknown>) =>
    apiRequest<Receivable>("/v1/receivables/", { method: "POST", body }),
  addPayment: (id: string, body: Record<string, unknown>) =>
    apiRequest<Payment>(`/v1/receivables/${id}/payments/`, {
      method: "POST",
      body,
    }),
  payments: (filters: Filters = {}) =>
    apiRequest<Paginated<Payment>>(`/v1/payments/${toQueryString(filters)}`),
  voidPayment: (id: string, reason: string) =>
    apiRequest<Payment>(`/v1/payments/${id}/void/`, {
      method: "POST",
      body: { reason },
    }),
  agreements: (filters: Filters = {}) =>
    apiRequest<Paginated<ServiceAgreement>>(
      `/v1/service-agreements/${toQueryString(filters)}`,
    ),
  createAgreement: (body: Record<string, unknown>) =>
    apiRequest<ServiceAgreement>("/v1/service-agreements/", {
      method: "POST",
      body,
    }),
  updateAgreement: (id: string, body: Record<string, unknown>) =>
    apiRequest<ServiceAgreement>(`/v1/service-agreements/${id}/`, {
      method: "PATCH",
      body,
    }),
  generateAgreementReceivable: (id: string, competence: string) =>
    apiRequest<Receivable>(
      `/v1/service-agreements/${id}/generate-receivable/`,
      {
        method: "POST",
        body: { competence },
      },
    ),
};

export const quotesApi = {
  list: (filters: Filters = {}) =>
    apiRequest<Paginated<Quote>>(`/v1/quotes/${toQueryString(filters)}`),
  detail: (id: string) => apiRequest<Quote>(`/v1/quotes/${id}/`),
  create: (body: Record<string, unknown>) =>
    apiRequest<Quote>("/v1/quotes/", { method: "POST", body }),
  update: (id: string, body: Record<string, unknown>) =>
    apiRequest<Quote>(`/v1/quotes/${id}/`, { method: "PATCH", body }),
  addItem: (id: string, body: Record<string, unknown>) =>
    apiRequest<QuoteItem>(`/v1/quotes/${id}/items/`, {
      method: "POST",
      body,
    }),
  updateItem: (id: string, itemId: string, body: Record<string, unknown>) =>
    apiRequest<QuoteItem>(`/v1/quotes/${id}/items/${itemId}/`, {
      method: "PATCH",
      body,
    }),
  removeItem: (id: string, itemId: string) =>
    apiRequest<void>(`/v1/quotes/${id}/items/${itemId}/`, {
      method: "DELETE",
    }),
  submit: (id: string) =>
    apiRequest<Quote>(`/v1/quotes/${id}/submit/`, { method: "POST" }),
  approve: (id: string) =>
    apiRequest<Quote>(`/v1/quotes/${id}/approve/`, { method: "POST" }),
  reject: (id: string) =>
    apiRequest<Quote>(`/v1/quotes/${id}/reject/`, { method: "POST" }),
  expire: (id: string) =>
    apiRequest<Quote>(`/v1/quotes/${id}/expire/`, { method: "POST" }),
  cancel: (id: string) =>
    apiRequest<Quote>(`/v1/quotes/${id}/cancel/`, { method: "POST" }),
  convert: (id: string) =>
    apiRequest<WorkOrder>(`/v1/quotes/${id}/convert/`, { method: "POST" }),
  downloadPdf: (id: string) => apiDownload(`/v1/quotes/${id}/pdf/`),
  issuePdf: (id: string) =>
    apiDownload(`/v1/quotes/${id}/issue-pdf/`, { method: "POST" }),
};

export const customersApi = {
  list: (filters: Filters = {}) =>
    apiRequest<Paginated<Customer>>(`/v1/customers/${toQueryString(filters)}`),
  detail: (id: string) => apiRequest<Customer>(`/v1/customers/${id}/`),
  create: (body: Record<string, unknown>) =>
    apiRequest<Customer>("/v1/customers/", { method: "POST", body }),
  update: (id: string, body: Record<string, unknown>) =>
    apiRequest<Customer>(`/v1/customers/${id}/`, { method: "PATCH", body }),
};

export const equipmentApi = {
  list: (filters: Filters = {}) =>
    apiRequest<Paginated<Equipment>>(`/v1/equipment/${toQueryString(filters)}`),
  detail: (id: string) => apiRequest<Equipment>(`/v1/equipment/${id}/`),
  create: (body: Record<string, unknown>) =>
    apiRequest<Equipment>("/v1/equipment/", { method: "POST", body }),
  update: (id: string, body: Record<string, unknown>) =>
    apiRequest<Equipment>(`/v1/equipment/${id}/`, { method: "PATCH", body }),
  components: (id: string) =>
    apiRequest<EquipmentComponent[]>(`/v1/equipment/${id}/components/`),
  addComponent: (id: string, body: Record<string, unknown>) =>
    apiRequest<EquipmentComponent>(`/v1/equipment/${id}/components/`, {
      method: "POST",
      body,
    }),
  updateComponent: (
    id: string,
    componentId: string,
    body: Record<string, unknown>,
  ) =>
    apiRequest<EquipmentComponent>(
      `/v1/equipment/${id}/components/${componentId}/`,
      { method: "PATCH", body },
    ),
  removeComponent: (id: string, componentId: string) =>
    apiRequest<void>(`/v1/equipment/${id}/components/${componentId}/`, {
      method: "DELETE",
    }),
  maintenance: (id: string) =>
    apiRequest<MaintenanceItem[]>(`/v1/equipment/${id}/maintenance/`),
};

export const workOrdersApi = {
  list: (filters: Filters = {}) =>
    apiRequest<Paginated<WorkOrder>>(
      `/v1/work-orders/${toQueryString(filters)}`,
    ),
  detail: (id: string) => apiRequest<WorkOrder>(`/v1/work-orders/${id}/`),
  create: (body: Record<string, unknown>) =>
    apiRequest<WorkOrder>("/v1/work-orders/", { method: "POST", body }),
  update: (id: string, body: Record<string, unknown>) =>
    apiRequest<WorkOrder>(`/v1/work-orders/${id}/`, {
      method: "PATCH",
      body,
    }),
  changeStatus: (id: string, body: Record<string, unknown>) =>
    apiRequest<WorkOrder>(`/v1/work-orders/${id}/change-status/`, {
      method: "POST",
      body,
    }),
  timeline: (id: string) =>
    apiRequest<WorkOrderTimeline>(`/v1/work-orders/${id}/timeline/`),
  addService: (id: string, body: Record<string, unknown>) =>
    apiRequest<WorkOrderService>(`/v1/work-orders/${id}/services/`, {
      method: "POST",
      body,
    }),
  updateService: (
    id: string,
    serviceId: string,
    body: Record<string, unknown>,
  ) =>
    apiRequest<WorkOrderService>(
      `/v1/work-orders/${id}/services/${serviceId}/`,
      { method: "PATCH", body },
    ),
  removeService: (id: string, serviceId: string) =>
    apiRequest<void>(`/v1/work-orders/${id}/services/${serviceId}/`, {
      method: "DELETE",
    }),
  addPart: (id: string, body: Record<string, unknown>) =>
    apiRequest<WorkOrderPart>(`/v1/work-orders/${id}/parts/`, {
      method: "POST",
      body,
    }),
  updatePart: (id: string, partId: string, body: Record<string, unknown>) =>
    apiRequest<WorkOrderPart>(`/v1/work-orders/${id}/parts/${partId}/`, {
      method: "PATCH",
      body,
    }),
  removePart: (id: string, partId: string) =>
    apiRequest<void>(`/v1/work-orders/${id}/parts/${partId}/`, {
      method: "DELETE",
    }),
  billing: (id: string) =>
    apiRequest<Billing>(`/v1/work-orders/${id}/billing/`),
  updateBilling: (id: string, body: Record<string, unknown>) =>
    apiRequest<Billing>(`/v1/work-orders/${id}/billing/`, {
      method: "PATCH",
      body,
    }),
  downloadPdf: (id: string) => apiDownload(`/v1/work-orders/${id}/pdf/`),
  issuePdf: (id: string) =>
    apiDownload(`/v1/work-orders/${id}/issue-pdf/`, { method: "POST" }),
};

export const catalogApi = {
  list: (resource: string, filters: Filters = {}) =>
    apiRequest<Paginated<CatalogItem>>(
      `/v1/${resource}/${toQueryString(filters)}`,
    ),
  create: (resource: string, body: Record<string, unknown>) =>
    apiRequest<CatalogItem>(`/v1/${resource}/`, { method: "POST", body }),
  update: (resource: string, id: string, body: Record<string, unknown>) =>
    apiRequest<CatalogItem>(`/v1/${resource}/${id}/`, {
      method: "PATCH",
      body,
    }),
};
