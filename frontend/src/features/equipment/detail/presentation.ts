import type { Equipment, MaintenanceItem } from "../../../api/types";

export function equipmentName(equipment: Equipment) {
  return (
    [equipment.manufacturer, equipment.model].filter(Boolean).join(" ") ||
    equipment.equipment_type.name
  );
}

export function equipmentStatusLabel(status: string) {
  return (
    {
      active: "Ativo",
      inactive: "Inativo",
      under_maintenance: "Em manutencao",
      retired: "Baixado",
    }[status] ?? status
  );
}

export function equipmentStatusTone(status: string) {
  if (status === "active") return "success" as const;
  if (status === "under_maintenance") return "warning" as const;
  return "neutral" as const;
}

export function maintenanceTone(status: MaintenanceItem["status"]) {
  if (status === "overdue") return "danger" as const;
  if (status === "upcoming") return "warning" as const;
  if (status === "ok") return "success" as const;
  return "neutral" as const;
}

export function maintenanceLabel(status: MaintenanceItem["status"]) {
  return (
    {
      overdue: "Vencida",
      upcoming: "Proxima",
      ok: "Em dia",
      never_performed: "Nunca realizada",
    }[status] ?? status
  );
}
