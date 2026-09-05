import type { WorkOrder } from "../../../api/types";

export function priorityTone(priority: string) {
  if (priority === "urgent") return "danger" as const;
  if (priority === "high") return "warning" as const;
  return "neutral" as const;
}

export function priorityLabel(priority: string) {
  return (
    {
      low: "Baixa",
      normal: "Normal",
      high: "Alta",
      urgent: "Urgente",
    }[priority] ?? priority
  );
}

export function equipmentName(workOrder: WorkOrder) {
  return (
    [workOrder.equipment.manufacturer, workOrder.equipment.model]
      .filter(Boolean)
      .join(" ") || workOrder.equipment.equipment_type.name
  );
}

export function workOrderTotals(workOrder: WorkOrder) {
  const activeServices = (workOrder.services ?? []).filter(
    (service) => !service.voided_at,
  );
  const activeParts = (workOrder.parts ?? []).filter((part) => !part.voided_at);
  const laborTotal = activeServices.reduce(
    (total, service) => total + Number(service.labor_price ?? 0),
    0,
  );
  const partsTotal = activeParts.reduce(
    (total, part) =>
      total + Number(part.quantity) * Number(part.unit_price ?? 0),
    0,
  );

  return {
    laborTotal,
    partsTotal,
    technicalTotal: laborTotal + partsTotal,
  };
}
