import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Laptop, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";

import { equipmentApi } from "../api/endpoints";
import { queryKeys } from "../api/queryKeys";
import type { Equipment } from "../api/types";
import { CatalogSelect } from "../components/CatalogSelect";
import { DataTable } from "../components/DataTable";
import { CustomerCombobox } from "../components/EntityComboboxes";
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

function statusTone(status: string) {
  if (status === "active") return "success" as const;
  if (status === "under_maintenance") return "warning" as const;
  if (status === "retired") return "neutral" as const;
  return "neutral" as const;
}

function statusLabel(status: string) {
  return (
    {
      active: "Ativo",
      inactive: "Inativo",
      under_maintenance: "Em manutencao",
      retired: "Baixado",
    }[status] ?? status
  );
}

function parsePage(value: string | null) {
  const page = Number(value ?? "1");
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function EquipmentPage() {
  const [params, setParams] = useSearchParams();
  const urlSearch = params.get("search") ?? "";
  const [searchInput, setSearchInput] = useState(urlSearch);
  const search = useDebouncedValue(searchInput);
  const status = params.get("status") ?? "";
  const page = parsePage(params.get("page"));
  const [showForm, setShowForm] = useState(params.get("new") === "1");
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const filters = { search, status, page };
  const query = useQuery({
    queryKey: queryKeys.equipment(filters),
    queryFn: () => equipmentApi.list(filters),
  });
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: "active" },
  });
  const customerId = form.watch("customer_id") ?? "";
  const mutation = useMutation({
    mutationFn: equipmentApi.create,
    onSuccess: async (created) => {
      form.reset({ status: "active" });
      setShowForm(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["equipment"] }),
        queryClient.invalidateQueries({ queryKey: ["customers"] }),
      ]);
      navigate(`/equipment/${created.id}`);
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
        eyebrow="Patrimonio tecnico"
        action={
          <Button type="button" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />
            Novo equipamento
          </Button>
        }
        title="Equipamentos"
        description="Visao transversal do patrimonio dos clientes. Acoes de atendimento continuam disponiveis dentro do equipamento e do cliente."
      />

      <Panel className="mb-5">
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[var(--text-subtle)]" />
            <Input
              className="pl-9"
              placeholder="Buscar cliente, tipo, modelo, serial ou patrimonio"
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
            <option value="inactive">Inativos</option>
            <option value="under_maintenance">Em manutencao</option>
            <option value="retired">Baixados</option>
          </Select>
        </div>
      </Panel>

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
            empty="Nenhum equipamento encontrado."
            getRowKey={(row) => row.id}
            rows={query.data.results}
            columns={[
              {
                header: "Cliente",
                cell: (row) => (
                  <Link
                    className="text-[var(--primary)] hover:text-[var(--primary-hover)]"
                    to={`/customers/${row.customer.id}?tab=equipment`}
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
                    className="font-semibold text-[var(--primary)] hover:text-[var(--primary-hover)]"
                    to={`/equipment/${row.id}`}
                  >
                    {[row.manufacturer, row.model].filter(Boolean).join(" ") ||
                      row.equipment_type.name}
                  </Link>
                ),
              },
              {
                header: "Serial",
                cell: (row) => row.serial_number || "-",
                hideOnMobile: true,
              },
              { header: "Patrimonio", cell: (row) => row.asset_tag || "-" },
              {
                header: "Status",
                cell: (row) => (
                  <Badge tone={statusTone(row.status)}>
                    {statusLabel(row.status)}
                  </Badge>
                ),
              },
            ]}
          />
          <Pagination
            count={query.data.count}
            page={page}
            onPageChange={(nextPage) => updateParam("page", String(nextPage))}
          />
        </div>
      ) : null}

      <Modal
        open={showForm}
        title="Novo equipamento"
        description="Cadastre o patrimonio e siga para o historico tecnico do equipamento."
        size="lg"
        onClose={() => setShowForm(false)}
      >
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
        >
          <Field
            label="Cliente"
            required
            error={form.formState.errors.customer_id?.message}
          >
            <CustomerCombobox
              ariaInvalid={Boolean(form.formState.errors.customer_id)}
              value={customerId}
              onChange={(value) =>
                form.setValue("customer_id", value, { shouldValidate: true })
              }
            />
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
              <Laptop className="h-4 w-4" />
              {mutation.isPending
                ? "Salvando..."
                : "Salvar e abrir equipamento"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
