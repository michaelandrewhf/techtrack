import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";

import { customersApi, equipmentApi } from "../api/endpoints";
import { queryKeys } from "../api/queryKeys";
import type { Equipment } from "../api/types";
import { CatalogSelect } from "../components/CatalogSelect";
import { DataTable } from "../components/DataTable";
import { PageHeader } from "../components/PageHeader";
import { Pagination } from "../components/Pagination";
import { ErrorState, PageLoader } from "../components/State";
import {
  Button,
  Field,
  Input,
  Panel,
  Select,
  Textarea,
} from "../components/ui";
import { errorMessage } from "../utils/errors";

const schema = z.object({
  customer_id: z.string().min(1, "Selecione o cliente."),
  equipment_type_id: z.string().min(1, "Selecione o tipo."),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serial_number: z.string().optional(),
  asset_tag: z.string().optional(),
  operating_system: z.string().optional(),
  notes: z.string().optional(),
  status: z.string().default("active"),
});

type FormData = z.input<typeof schema>;

export function EquipmentPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();
  const filters = { search, page };
  const query = useQuery({
    queryKey: queryKeys.equipment(filters),
    queryFn: () => equipmentApi.list(filters),
  });
  const customers = useQuery({
    queryKey: queryKeys.customers({ page_size: 100 }),
    queryFn: () => customersApi.list({}),
  });
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: "active" },
  });
  const mutation = useMutation({
    mutationFn: equipmentApi.create,
    onSuccess: async () => {
      form.reset({ status: "active" });
      setShowForm(false);
      await queryClient.invalidateQueries({ queryKey: ["equipment"] });
    },
  });

  return (
    <div>
      <PageHeader
        action={
          <Button type="button" onClick={() => setShowForm((value) => !value)}>
            <Plus className="h-4 w-4" />
            Novo equipamento
          </Button>
        }
        title="Equipamentos"
        description="Patrimonio tecnico dos clientes."
      />
      {showForm ? (
        <Panel title="Novo equipamento">
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
          >
            <Field label="Cliente">
              <Select {...form.register("customer_id")}>
                <option value="">Selecione</option>
                {(customers.data?.results ?? []).map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Controller
              control={form.control}
              name="equipment_type_id"
              render={({ field }) => (
                <CatalogSelect
                  label="Tipo"
                  resource="equipment-types"
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            <Field label="Fabricante">
              <Input {...form.register("manufacturer")} />
            </Field>
            <Field label="Modelo">
              <Input {...form.register("model")} />
            </Field>
            <Field label="Serial">
              <Input {...form.register("serial_number")} />
            </Field>
            <Field label="Patrimonio">
              <Input {...form.register("asset_tag")} />
            </Field>
            <Field label="Sistema operacional">
              <Input {...form.register("operating_system")} />
            </Field>
            <Field label="Status">
              <Select {...form.register("status")}>
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
                <option value="under_maintenance">Em manutencao</option>
                <option value="retired">Baixado</option>
              </Select>
            </Field>
            <div className="md:col-span-2">
              <Field label="Observacoes">
                <Textarea {...form.register("notes")} />
              </Field>
            </div>
            {mutation.error ? (
              <p className="text-sm text-red-600 md:col-span-2">
                {errorMessage(mutation.error)}
              </p>
            ) : null}
            <div className="md:col-span-2">
              <Button disabled={mutation.isPending} type="submit">
                Salvar equipamento
              </Button>
            </div>
          </form>
        </Panel>
      ) : null}
      <div className="my-4 max-w-md">
        <Input
          placeholder="Buscar equipamento"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      {query.isLoading ? <PageLoader /> : null}
      {query.error ? (
        <ErrorState
          message="Nao foi possivel carregar equipamentos."
          onRetry={query.refetch}
        />
      ) : null}
      {query.data ? (
        <div className="space-y-4">
          <DataTable<Equipment>
            empty="Nenhum equipamento cadastrado."
            rows={query.data.results}
            columns={[
              {
                header: "Cliente",
                cell: (row) => (
                  <Link
                    className="text-blue-700 dark:text-blue-300"
                    to={`/customers/${row.customer.id}`}
                  >
                    {row.customer.name}
                  </Link>
                ),
              },
              { header: "Tipo", cell: (row) => row.equipment_type.name },
              {
                header: "Equipamento",
                cell: (row) => (
                  <Link
                    className="font-medium text-blue-700 dark:text-blue-300"
                    to={`/equipment/${row.id}`}
                  >
                    {[row.manufacturer, row.model].filter(Boolean).join(" ") ||
                      "-"}
                  </Link>
                ),
              },
              { header: "Serial", cell: (row) => row.serial_number || "-" },
              { header: "Patrimonio", cell: (row) => row.asset_tag || "-" },
              { header: "Status", cell: (row) => row.status },
            ]}
          />
          <Pagination
            count={query.data.count}
            page={page}
            onPageChange={setPage}
          />
        </div>
      ) : null}
    </div>
  );
}
