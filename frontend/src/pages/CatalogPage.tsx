import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useParams } from "react-router-dom";
import { z } from "zod";

import { catalogApi } from "../api/endpoints";
import { queryKeys } from "../api/queryKeys";
import type { CatalogItem } from "../api/types";
import { useAuth } from "../auth/AuthProvider";
import { DataTable } from "../components/DataTable";
import { PageHeader } from "../components/PageHeader";
import { Pagination } from "../components/Pagination";
import { ErrorState, PageLoader } from "../components/State";
import {
  Badge,
  Button,
  Field,
  Input,
  Panel,
  Select,
  Textarea,
} from "../components/ui";
import { errorMessage } from "../utils/errors";

const labels: Record<string, string> = {
  "equipment-types": "Tipos de Equipamento",
  "component-types": "Tipos de Componente",
  "service-categories": "Categorias de Servico",
  "service-types": "Tipos de Servico",
  "part-categories": "Categorias de Peca",
  parts: "Pecas",
  "payment-methods": "Metodos de Pagamento",
  "work-order-statuses": "Status de OS",
};

const schema = z.object({
  name: z.string().min(1, "Informe o nome."),
  slug: z.string().optional(),
  code: z.string().optional(),
  description: z.string().optional(),
  is_active: z.boolean().default(true),
  kind: z.string().optional(),
  sort_order: z.coerce.number().optional(),
  is_initial: z.boolean().optional(),
  is_recurring: z.boolean().optional(),
  recommended_interval_value: z.coerce.number().optional(),
  recommended_interval_unit: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  default_cost: z.string().optional(),
  default_price: z.string().optional(),
});

type FormData = z.input<typeof schema>;

function defaultCode(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function CatalogPage() {
  const { resource = "equipment-types" } = useParams();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();
  const api = catalogApi(resource);
  const query = useQuery({
    queryKey: queryKeys.catalog(resource, { page }),
    queryFn: () => api.list({ page }),
  });
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { is_active: true },
  });
  const create = useMutation({
    mutationFn: (data: FormData) => {
      const payload: Record<string, unknown> = {
        ...data,
        is_active: data.is_active ?? true,
      };
      if (resource === "work-order-statuses")
        payload.code = data.code || defaultCode(data.name);
      else payload.slug = data.slug || defaultCode(data.name);
      return api.create(payload);
    },
    onSuccess: async () => {
      form.reset({ is_active: true });
      setShowForm(false);
      await queryClient.invalidateQueries({ queryKey: ["catalog", resource] });
    },
  });
  const toggle = useMutation({
    mutationFn: (item: CatalogItem) =>
      api.update(item.id, { is_active: !item.is_active }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["catalog", resource] }),
  });

  const title = labels[resource] ?? resource;
  const isStatus = resource === "work-order-statuses";
  const isServiceType = resource === "service-types";
  const isPart = resource === "parts";

  return (
    <div>
      <PageHeader
        action={
          user?.is_staff ? (
            <Button
              type="button"
              onClick={() => setShowForm((value) => !value)}
            >
              <Plus className="h-4 w-4" />
              Novo
            </Button>
          ) : null
        }
        title={title}
        description="Catalogos configuraveis consumidos pela API."
      />
      {!user?.is_staff ? (
        <p className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-100">
          Seu usuario pode visualizar este catalogo, mas apenas staff pode
          alterar.
        </p>
      ) : null}
      {showForm ? (
        <Panel title={`Novo registro em ${title}`}>
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={form.handleSubmit((data) => create.mutate(data))}
          >
            <Field label="Nome">
              <Input {...form.register("name")} />
            </Field>
            <Field label={isStatus ? "Code" : "Slug"}>
              <Input {...form.register(isStatus ? "code" : "slug")} />
            </Field>
            {isStatus ? (
              <Field label="Kind">
                <Select {...form.register("kind")}>
                  <option value="active">ACTIVE</option>
                  <option value="completed">COMPLETED</option>
                  <option value="cancelled">CANCELLED</option>
                </Select>
              </Field>
            ) : null}
            {isServiceType ? (
              <>
                <Field label="Recorrente">
                  <input
                    className="h-4 w-4"
                    type="checkbox"
                    {...form.register("is_recurring")}
                  />
                </Field>
                <Field label="Intervalo">
                  <Input
                    type="number"
                    {...form.register("recommended_interval_value")}
                  />
                </Field>
                <Field label="Unidade">
                  <Select {...form.register("recommended_interval_unit")}>
                    <option value="">Selecione</option>
                    <option value="days">Dias</option>
                    <option value="months">Meses</option>
                    <option value="years">Anos</option>
                  </Select>
                </Field>
              </>
            ) : null}
            {isPart ? (
              <>
                <Field label="Marca">
                  <Input {...form.register("brand")} />
                </Field>
                <Field label="Modelo">
                  <Input {...form.register("model")} />
                </Field>
                <Field label="Custo padrao">
                  <Input {...form.register("default_cost")} />
                </Field>
                <Field label="Preco padrao">
                  <Input {...form.register("default_price")} />
                </Field>
              </>
            ) : null}
            <div className="md:col-span-2">
              <Field label="Descricao">
                <Textarea {...form.register("description")} />
              </Field>
            </div>
            {create.error ? (
              <p className="text-sm text-red-600 md:col-span-2">
                {errorMessage(create.error)}
              </p>
            ) : null}
            <div className="md:col-span-2">
              <Button disabled={create.isPending} type="submit">
                Salvar
              </Button>
            </div>
          </form>
        </Panel>
      ) : null}
      {query.isLoading ? <PageLoader /> : null}
      {query.error ? (
        <ErrorState
          message="Nao foi possivel carregar o catalogo."
          onRetry={query.refetch}
        />
      ) : null}
      {query.data ? (
        <div className="mt-4 space-y-4">
          <DataTable<CatalogItem>
            empty="Nenhum item cadastrado."
            rows={query.data.results}
            columns={[
              { header: "Nome", cell: (row) => row.name },
              {
                header: isStatus ? "Code" : "Slug",
                cell: (row) => row.code ?? row.slug ?? "-",
              },
              { header: "Semantica", cell: (row) => row.kind ?? "-" },
              {
                header: "Ativo",
                cell: (row) => (
                  <Badge tone={row.is_active ? "success" : "neutral"}>
                    {row.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                ),
              },
              {
                header: "Acao",
                cell: (row) =>
                  user?.is_staff ? (
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={() => toggle.mutate(row)}
                    >
                      {row.is_active ? "Desativar" : "Ativar"}
                    </Button>
                  ) : (
                    "-"
                  ),
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
