import { customersApi, equipmentApi } from "../api/endpoints";
import type { Customer, Equipment } from "../api/types";
import {
  AsyncEntityCombobox,
  type AsyncEntityOption,
} from "./AsyncEntityCombobox";

function customerOption(customer: Customer): AsyncEntityOption {
  return {
    id: customer.id,
    label: customer.name,
    description: [customer.email, customer.phone].filter(Boolean).join(" · "),
  };
}

function equipmentOption(equipment: Equipment): AsyncEntityOption {
  const label = [
    equipment.equipment_type?.name,
    equipment.manufacturer,
    equipment.model,
  ]
    .filter(Boolean)
    .join(" · ");
  const description = [
    equipment.serial_number ? `Serial ${equipment.serial_number}` : "",
    equipment.asset_tag ? `Patrimonio ${equipment.asset_tag}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    id: equipment.id,
    label: label || "Equipamento",
    description,
  };
}

export function CustomerCombobox({
  value,
  onChange,
  disabled,
  ariaInvalid,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  ariaInvalid?: boolean;
}) {
  return (
    <AsyncEntityCombobox
      ariaInvalid={ariaInvalid}
      disabled={disabled}
      loadOptions={async (search) => {
        const page = await customersApi.list({
          status: "active",
          search,
          ordering: "name",
          page_size: 10,
        });
        return page.results.map(customerOption);
      }}
      loadValue={async (id) => customerOption(await customersApi.get(id))}
      placeholder="Cliente selecionado"
      queryKey={["entity-combobox", "customers", "active"]}
      searchPlaceholder="Buscar cliente por nome, e-mail ou telefone"
      value={value}
      onChange={onChange}
    />
  );
}

export function EquipmentCombobox({
  customerId,
  value,
  onChange,
  disabled,
  ariaInvalid,
  required = false,
}: {
  customerId: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  ariaInvalid?: boolean;
  required?: boolean;
}) {
  return (
    <AsyncEntityCombobox
      allowClear={!required}
      ariaInvalid={ariaInvalid}
      disabled={disabled || !customerId}
      emptyText="Nenhum equipamento encontrado para este cliente."
      loadOptions={async (search) => {
        if (!customerId) return [];
        const page = await equipmentApi.list({
          customer: customerId,
          search,
          ordering: "-created_at",
          page_size: 10,
        });
        return page.results.map(equipmentOption);
      }}
      loadValue={async (id) => equipmentOption(await equipmentApi.get(id))}
      placeholder="Equipamento selecionado"
      queryKey={["entity-combobox", "equipment", customerId]}
      searchPlaceholder={
        customerId
          ? "Buscar por tipo, modelo, serial ou patrimonio"
          : "Selecione o cliente primeiro"
      }
      value={value}
      onChange={onChange}
    />
  );
}
