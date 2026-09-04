import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { customersApi, equipmentApi, quotesApi } from "../api/endpoints";
import { PageHeader } from "../components/PageHeader";
import { Button, Field, Input, Select, Textarea } from "../components/ui";

export function QuoteCreatePage() {
  const navigate = useNavigate();
  const [customer, setCustomer] = useState("");
  const [equipment, setEquipment] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");

  const customers = useQuery({
    queryKey: ["customers", "quote-select"],
    queryFn: () => customersApi.list({ status: "active", page_size: 100 }),
  });
  const equipmentQuery = useQuery({
    queryKey: ["equipment", "quote-select", customer],
    queryFn: () => equipmentApi.list({ customer, page_size: 100 }),
    enabled: Boolean(customer),
  });

  const create = useMutation({
    mutationFn: () =>
      quotesApi.create({
        customer,
        equipment: equipment || null,
        title,
        description,
        valid_until: validUntil || null,
        notes,
      }),
    onSuccess: (quote) => navigate(`/quotes/${quote.id}`),
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Novo orcamento"
        description="Crie a proposta primeiro; itens e valores sao adicionados na etapa seguinte."
      />
      <div className="space-y-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Field label="Cliente">
          <Select
            value={customer}
            onChange={(event) => {
              setCustomer(event.target.value);
              setEquipment("");
            }}
          >
            <option value="">Selecione</option>
            {customers.data?.results.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Equipamento (opcional)">
          <Select
            value={equipment}
            disabled={!customer}
            onChange={(event) => setEquipment(event.target.value)}
          >
            <option value="">Sem equipamento definido</option>
            {equipmentQuery.data?.results.map((item) => (
              <option key={item.id} value={item.id}>
                {[
                  item.equipment_type?.name,
                  item.manufacturer,
                  item.model,
                  item.serial_number,
                ]
                  .filter(Boolean)
                  .join(" - ")}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Titulo">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>
        <Field label="Descricao">
          <Textarea
            rows={5}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
        <Field label="Validade">
          <Input
            type="date"
            value={validUntil}
            onChange={(event) => setValidUntil(event.target.value)}
          />
        </Field>
        <Field label="Observacoes">
          <Textarea
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </Field>
        {create.isError ? (
          <p className="text-sm text-red-600">
            Nao foi possivel criar o orcamento. Confira os dados.
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate("/quotes")}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!customer || !title || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? "Criando..." : "Criar orcamento"}
          </Button>
        </div>
      </div>
    </div>
  );
}
