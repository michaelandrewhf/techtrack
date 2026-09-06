import { useQueryClient } from "@tanstack/react-query";
import { ClipboardList, FileText, Pencil } from "lucide-react";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { queryKeys } from "../../../api/queryKeys";
import { Breadcrumbs } from "../../../components/Breadcrumbs";
import { PageHeader } from "../../../components/PageHeader";
import { ErrorState, PageLoader } from "../../../components/State";
import { TabPanel, Tabs } from "../../../components/Tabs";
import { Badge, Button } from "../../../components/ui";
import { EquipmentComponents } from "./EquipmentComponents";
import { EquipmentEditDialog } from "./EquipmentEditDialog";
import { EquipmentMaintenance } from "./EquipmentMaintenance";
import { EquipmentOverview } from "./EquipmentOverview";
import { EquipmentWorkOrders } from "./EquipmentWorkOrders";
import {
  equipmentName,
  equipmentStatusLabel,
  equipmentStatusTone,
} from "./presentation";
import type { EquipmentTabId } from "./types";
import { useEquipmentWorkspace } from "./useEquipmentWorkspace";

const EQUIPMENT_TABS_ID = "equipment-detail-tabs";

const tabItems: Array<{ id: EquipmentTabId; label: string }> = [
  { id: "overview", label: "Visao geral" },
  { id: "components", label: "Componentes" },
  { id: "maintenance", label: "Manutencao" },
  { id: "work-orders", label: "Ordens de servico" },
];

function isEquipmentTab(value: string): value is EquipmentTabId {
  return tabItems.some((tab) => tab.id === value);
}

export function EquipmentDetailPage() {
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const requestedTab = params.get("tab") ?? "overview";
  const activeTab: EquipmentTabId = isEquipmentTab(requestedTab)
    ? requestedTab
    : "overview";
  const [editOpen, setEditOpen] = useState(false);
  const queryClient = useQueryClient();
  const workspace = useEquipmentWorkspace(id, activeTab);

  const refreshEquipment = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.equipmentDetail(id),
      }),
      queryClient.invalidateQueries({ queryKey: ["equipment"] }),
      queryClient.invalidateQueries({ queryKey: ["customers"] }),
    ]);
  };

  const selectTab = (value: EquipmentTabId) => {
    const next = new URLSearchParams(params);
    if (value === "overview") next.delete("tab");
    else next.set("tab", value);
    setParams(next, { replace: true });
  };

  if (workspace.equipment.isLoading)
    return <PageLoader label="Carregando equipamento" />;
  if (workspace.equipment.error || !workspace.equipment.data)
    return (
      <ErrorState
        message="Equipamento nao encontrado."
        onRetry={workspace.equipment.refetch}
      />
    );

  const equipment = workspace.equipment.data;
  const name = equipmentName(equipment);
  const tabs = tabItems.map((tab) => ({
    ...tab,
    count:
      tab.id === "components"
        ? equipment.current_components?.length
        : tab.id === "work-orders"
          ? equipment.recent_work_orders?.length
          : undefined,
  }));

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Clientes", to: "/customers" },
          {
            label: equipment.customer.name,
            to: `/customers/${equipment.customer.id}?tab=equipment`,
          },
          { label: name },
        ]}
      />

      <PageHeader
        eyebrow={equipment.equipment_type.name}
        title={name}
        description={`Patrimonio tecnico de ${equipment.customer.name}.`}
        meta={
          <Badge tone={equipmentStatusTone(equipment.status)}>
            {equipmentStatusLabel(equipment.status)}
          </Badge>
        }
        action={
          <>
            <Link
              to={`/work-orders/new?customer=${equipment.customer.id}&equipment=${equipment.id}`}
            >
              <Button type="button">
                <ClipboardList className="h-4 w-4" />
                Abrir OS
              </Button>
            </Link>
            <Link
              to={`/quotes/new?customer=${equipment.customer.id}&equipment=${equipment.id}`}
            >
              <Button type="button" variant="secondary">
                <FileText className="h-4 w-4" />
                Orcamento
              </Button>
            </Link>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="h-4 w-4" />
              Editar
            </Button>
          </>
        }
      />

      <Tabs
        id={EQUIPMENT_TABS_ID}
        items={tabs}
        value={activeTab}
        onChange={(value) => selectTab(value as EquipmentTabId)}
      />

      <TabPanel
        className="mt-5"
        tabId={activeTab}
        tabsId={EQUIPMENT_TABS_ID}
      >
        {activeTab === "overview" ? (
          <EquipmentOverview equipment={equipment} />
        ) : null}
        {activeTab === "components" ? (
          <EquipmentComponents
            equipment={equipment}
            onChanged={refreshEquipment}
          />
        ) : null}
        {activeTab === "maintenance" ? (
          <EquipmentMaintenance
            error={Boolean(workspace.maintenance.error)}
            items={workspace.maintenance.data ?? []}
            loading={workspace.maintenance.isLoading}
            onRetry={() => {
              void workspace.maintenance.refetch();
            }}
          />
        ) : null}
        {activeTab === "work-orders" ? (
          <EquipmentWorkOrders equipment={equipment} />
        ) : null}
      </TabPanel>

      <EquipmentEditDialog
        equipment={equipment}
        open={editOpen}
        onChanged={refreshEquipment}
        onClose={() => setEditOpen(false)}
      />
    </div>
  );
}
