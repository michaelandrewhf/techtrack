export type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type User = {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  is_staff: boolean;
};

export type CatalogItem = {
  id: string;
  name: string;
  slug?: string;
  code?: string;
  description?: string;
  is_active: boolean;
  kind?: string;
  sort_order?: number;
  is_initial?: boolean;
  is_recurring?: boolean;
  recommended_interval_value?: number | null;
  recommended_interval_unit?: string;
  category?: CatalogItem | null;
  brand?: string;
  model?: string;
  default_cost?: string | null;
  default_price?: string | null;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  whatsapp: string;
  email: string;
  notes?: string;
  status: string;
  customer_since?: string | null;
  equipment_count?: number;
  active_work_order_count?: number;
  latest_work_order_at?: string | null;
};

export type Equipment = {
  id: string;
  customer: Customer;
  equipment_type: CatalogItem;
  manufacturer: string;
  model: string;
  serial_number: string;
  asset_tag: string;
  operating_system?: string;
  notes?: string;
  status: string;
  current_components?: EquipmentComponent[];
  recent_work_orders?: WorkOrder[];
};

export type EquipmentComponent = {
  id: string;
  component_type: CatalogItem;
  manufacturer: string;
  model: string;
  serial_number: string;
  capacity: string;
  installed_at: string | null;
  removed_at: string | null;
  notes: string;
};

export type WorkOrderStatus = {
  id: string;
  name: string;
  code: string;
  kind: string;
  is_active: boolean;
};

export type WorkOrder = {
  id: string;
  number: number;
  display_number: string;
  customer: Customer;
  equipment: Equipment;
  status: WorkOrderStatus;
  priority: string;
  responsible_user?: User | null;
  title: string;
  problem_description?: string;
  diagnosis?: string;
  service_description?: string;
  solution?: string;
  internal_notes?: string;
  opened_at: string;
  completed_at?: string | null;
  cancelled_at?: string | null;
  status_history?: WorkOrderTimeline[];
  services?: WorkOrderService[];
  parts?: WorkOrderPart[];
  billing?: Billing | null;
};

export type WorkOrderTimeline = {
  id: string;
  status: WorkOrderStatus;
  changed_at: string;
  changed_by: User | null;
  comment: string;
  description: string;
};

export type WorkOrderService = {
  id: string;
  service_type: CatalogItem;
  performed_at: string;
  performed_by: User | null;
  description: string;
  notes: string;
  labor_price: string | null;
  voided_at: string | null;
  void_reason: string;
};

export type WorkOrderPart = {
  id: string;
  description: string;
  quantity: string;
  unit_cost: string | null;
  unit_price: string | null;
  serial_number: string;
  warranty_until: string | null;
  voided_at: string | null;
  void_reason: string;
};

export type Billing = {
  id: string;
  labor_total: string | null;
  parts_total: string | null;
  discount: string | null;
  total_amount: string | null;
  payment_status: string;
  payment_method: CatalogItem | null;
  paid_at: string | null;
  notes: string;
};

export type MaintenanceItem = {
  service_type: { id: string; name: string; slug: string };
  last_performed_at: string | null;
  recommended_interval_value: number | null;
  recommended_interval_unit: string;
  next_due_at: string | null;
  status: "never_performed" | "ok" | "upcoming" | "overdue";
};

export type Dashboard = {
  customers: { active: number };
  equipment: { active: number };
  work_orders: {
    open: number;
    in_progress: number;
    active: number;
    completed: number;
    cancelled: number;
  };
  maintenance: { overdue: number; upcoming: number; never_performed: number };
  recent_work_orders: WorkOrder[];
  awaiting_customer: WorkOrder[];
};
