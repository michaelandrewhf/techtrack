import { useRef } from "react";

import { customersApi, equipmentApi, financeApi } from "../api/endpoints";
import type { Customer, Equipment, Receivable } from "../api/types";
import { formatDate, formatMoney } from "../utils/format";
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

function receivableOption(receivable: Receivable): AsyncEntityOption {
  return {
    id: receivable.id,
    label: `${receivable.customer_name} · ${receivable.description}`,
    description: `${formatDate(receivable.due_date)} · saldo ${formatMoney(receivable.balance)}`,
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

export function ReceivableCombobox({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string, receivable?: Receivable) => void;
}) {
  const rows = useRef(new Map<string, Receivable>());

  return (
    <AsyncEntityCombobox
      loadOptions={async (search) => {
        const page = await financeApi.receivables({
          open: true,
          search,
          ordering: "due_date",
          page_size: 10,
        });
        rows.current = new Map(page.results.map((row) => [row.id, row]));
        return page.results.map(receivableOption);
      }}
      queryKey={["entity-combobox", "receivables", "open"]}
      searchPlaceholder="Buscar cliente, descricao ou referencia"
      value={value}
      onChange={(nextValue) => onChange(nextValue, rows.current.get(nextValue))}
    />
  );
}
