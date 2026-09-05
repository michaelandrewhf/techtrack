import { useQuery } from "@tanstack/react-query";

import { equipmentApi } from "../../../api/endpoints";
import { queryKeys } from "../../../api/queryKeys";
import type { EquipmentTabId } from "./types";

export function useEquipmentWorkspace(id: string, activeTab: EquipmentTabId) {
  const equipment = useQuery({
    queryKey: queryKeys.equipmentDetail(id),
    queryFn: () => equipmentApi.get(id),
    enabled: Boolean(id),
  });

  const maintenance = useQuery({
    queryKey: queryKeys.maintenance(id),
    queryFn: () => equipmentApi.maintenance(id),
    enabled: Boolean(id) && activeTab === "maintenance",
  });

  return { equipment, maintenance };
}
