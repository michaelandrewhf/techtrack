import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";

import { customersApi } from "../api/endpoints";
import { queryKeys } from "../api/queryKeys";
import type { Customer } from "../api/types";
import { DataTable } from "../components/DataTable";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { Pagination } from "../components/Pagination";
import { ErrorState, PageLoader } from "../components/State";
import {
  Badge,
  Button,
  Field,
  Input,
  Notice,
  Panel,
  Select,
  Textarea,
} from "../components/ui";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { errorMessage } from "../utils/errors";
import { formatDateTime } from "../utils/format";

const schema = z.object({
  name: z.string().min(1, "Informe o nome."),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email("E-mail invalido.").or(z.literal("")).optional(),
  customer_since: z.string().optional(),
  notes: z.string().optional(),
  status: z.string().default("active"),
});

type FormData = z.input<typeof schema>;

function statusTone(status: string) {
  if (status === "active") return "success" as const;
  if (status === "blocked") return "danger" as const;
  if (status === "prospect") return "info" as const;
  return "neutral" as const;
}

function statusLabel(status: string) {
  return (
    {
      active: "Ativo",
      inactive: "Inativo",
      prospect: "Prospect",
      blocked: "Bloqueado",
    }[status] ?? status
  );
}

function parsePage(value: string | null) {
  const page = Number(value ?? "1");
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function CustomersPage() {
  const [params, setParams] = useSearchParams();
  const urlSearch = params.get("search") ?? "";
  const [searchInput, setSearchInput] = useState(urlSearch);
  const search = useDebouncedValue(searchInput);
  const status = params.get("status") ?? "";
  const page = parsePage(params.get("page"));
  const [showForm, setShowForm] = useState(params.get("new") === "1");
  const filters = { search, status, page };
  const queryClient = useQueryClient();
  const navigate = useNavigate();
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
    onSuccess: async (created) => {
      form.reset({ status: "active" });
      setShowForm(false);
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      navigate(`/customers/${created.id}`);
    },
  });

  useEffect(() => {
    if (search === urlSearch) return;
    const next = new URLSearchParams(params);
    if (search) next.set("search", search);
    else next.delete("search");
    next.delete("page");
    setParams(next, { replace: true });
  }, [params, search, setParams, urlSearch]);

  const updateParam = (key: "status" | "page", value: string) => {
    const next = new URLSearchParams(params);
    if (value && value !== "1") next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: true });
  };

  return (
    <div>
      <PageHeader
        eyebrow="Relacionamento"
        action={
          <Button type="button" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />
            Novo cliente
          </Button>
        }
        title="Clientes"
        description="Ponto de entrada para cadastro, patrimonio, atendimentos, orcamentos e relacionamento financeiro."
      />

      <Panel className="mb-5">
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[var(--text-subtle)]" />
            <Input
              className="pl-9"
              placeholder="Buscar por nome, e-mail, telefone ou WhatsApp"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>
          <Select
            aria-label="Filtrar status"
            value={status}
            onChange={(event) => updateParam("status", event.target.value)}
          >
            <option value="">Todos os status</option>
            <option value="active">Ativos</option>
            <option value="prospect">Prospects</option>
            <option value="inactive">Inativos</option>
            <option value="blocked">Bloqueados</option>
          </Select>
        </div>
      </Panel>

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
            empty="Nenhum cliente encontrado."
            getRowKey={(row) => row.id}
            rows={query.data.results}
            columns={[
              {
                header: "Cliente",
                cell: (row) => (
                  <Link
                    className="font-semibold text-[var(--primary)] hover:text-[var(--primary-hover)]"
                    to={`/customers/${row.id}`}
                  >
                    {row.name}
                  </Link>
                ),
              },
              {
                header: "Telefone",
                cell: (row) => row.whatsapp || row.phone || "-",
              },
              {
                header: "E-mail",
                cell: (row) => row.email || "-",
                hideOnMobile: true,
              },
              {
                header: "Status",
                cell: (row) => (
                  <Badge tone={statusTone(row.status)}>
                    {statusLabel(row.status)}
                  </Badge>
                ),
              },
              { header: "Equip.", cell: (row) => row.equipment_count ?? 0 },
              {
                header: "OS abertas",
                cell: (row) => row.active_work_order_count ?? 0,
              },
              {
                header: "Ultima OS",
                cell: (row) => formatDateTime(row.latest_work_order_at),
                hideOnMobile: true,
              },
            ]}
          />
          <Pagination
            count={query.data.count}
            page={page}
            onPageChange={(nextPage) =>
              updateParam("page", String(nextPage))
            }
          />
        </div>
      ) : null}

      <Modal
        open={showForm}
        title="Novo cliente"
        description="Cadastre o relacionamento uma vez; os proximos passos ficam dentro do proprio cliente."
        onClose={() => setShowForm(false)}
      >
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
        >
          <div className="sm:col-span-2">
            <Field
              label="Nome"
              required
              error={form.formState.errors.name?.message}
            >
              <Input
                aria-invalid={Boolean(form.formState.errors.name)}
                autoFocus
                {...form.register("name")}
              />
            </Field>
          </div>
          <Field label="Telefone">
            <Input {...form.register("phone")} />
          </Field>
          <Field label="WhatsApp">
            <Input {...form.register("whatsapp")} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="E-mail" error={form.formState.errors.email?.message}>
              <Input
                aria-invalid={Boolean(form.formState.errors.email)}
                {...form.register("email")}
              />
            </Field>
          </div>
          <Field label="Cliente desde">
            <Input type="date" {...form.register("customer_since")} />
          </Field>
          <Field label="Status">
            <Select {...form.register("status")}>
              <option value="active">Ativo</option>
              <option value="prospect">Prospect</option>
              <option value="inactive">Inativo</option>
              <option value="blocked">Bloqueado</option>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Observacoes">
              <Textarea {...form.register("notes")} />
            </Field>
          </div>
          {mutation.error ? (
            <div className="sm:col-span-2">
              <Notice tone="danger">{errorMessage(mutation.error)}</Notice>
            </div>
          ) : null}
          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4 sm:col-span-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowForm(false)}
            >
              Cancelar
            </Button>
            <Button disabled={mutation.isPending} type="submit">
              <Users className="h-4 w-4" />
              {mutation.isPending ? "Salvando..." : "Salvar e abrir cliente"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
