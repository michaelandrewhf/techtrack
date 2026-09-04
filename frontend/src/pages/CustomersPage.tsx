import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";

import { customersApi } from "../api/endpoints";
import { queryKeys } from "../api/queryKeys";
import type { Customer } from "../api/types";
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
import { formatDateTime } from "../utils/format";

const schema = z.object({
  name: z.string().min(1, "Informe o nome."),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email("E-mail invalido.").or(z.literal("")).optional(),
  notes: z.string().optional(),
  status: z.string().default("active"),
});

type FormData = z.input<typeof schema>;

export function CustomersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const filters = { search, page };
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.customers(filters),
    queryFn: () => customersApi.list(filters),
  });
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: "active" },
  });
  const mutation = useMutation({
    mutationFn: customersApi.create,
    onSuccess: async () => {
      form.reset({ status: "active" });
      setShowForm(false);
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });

  const submit = form.handleSubmit((data) => mutation.mutate(data));

  return (
    <div>
      <PageHeader
        action={
          <Button type="button" onClick={() => setShowForm((value) => !value)}>
            <Plus className="h-4 w-4" />
            Novo cliente
          </Button>
        }
        title="Clientes"
        description="Cadastro e acompanhamento dos clientes."
      />
      {showForm ? (
        <Panel title="Novo cliente">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
            <Field label="Nome">
              <Input {...form.register("name")} />
            </Field>
            <Field label="Telefone">
              <Input {...form.register("phone")} />
            </Field>
            <Field label="WhatsApp">
              <Input {...form.register("whatsapp")} />
            </Field>
            <Field label="E-mail">
              <Input {...form.register("email")} />
            </Field>
            <Field label="Status">
              <Select {...form.register("status")}>
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
                <option value="prospect">Prospect</option>
                <option value="blocked">Bloqueado</option>
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
                Salvar cliente
              </Button>
            </div>
          </form>
        </Panel>
      ) : null}
      <div className="my-4 max-w-md">
        <Input
          placeholder="Buscar por nome, e-mail, telefone ou WhatsApp"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      {query.isLoading ? <PageLoader /> : null}
      {query.error ? (
        <ErrorState
          message="Nao foi possivel carregar clientes."
          onRetry={query.refetch}
        />
      ) : null}
      {query.data ? (
        <div className="space-y-4">
          <DataTable<Customer>
            empty="Nenhum cliente cadastrado."
            rows={query.data.results}
            columns={[
              {
                header: "Nome",
                cell: (row) => (
                  <Link
                    className="font-medium text-blue-700 dark:text-blue-300"
                    to={`/customers/${row.id}`}
                  >
                    {row.name}
                  </Link>
                ),
              },
              { header: "Telefone", cell: (row) => row.phone || "-" },
              { header: "E-mail", cell: (row) => row.email || "-" },
              { header: "Status", cell: (row) => row.status },
              { header: "Equip.", cell: (row) => row.equipment_count ?? 0 },
              {
                header: "OS abertas",
                cell: (row) => row.active_work_order_count ?? 0,
              },
              {
                header: "Ultima OS",
                cell: (row) => formatDateTime(row.latest_work_order_at),
              },
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
