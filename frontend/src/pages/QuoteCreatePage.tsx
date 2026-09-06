import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";

import { customersApi, quotesApi } from "../api/endpoints";
import { queryKeys } from "../api/queryKeys";
import { Breadcrumbs } from "../components/Breadcrumbs";
import {
  CustomerCombobox,
  EquipmentCombobox,
} from "../components/EntityComboboxes";
import { PageHeader } from "../components/PageHeader";
import {
  Button,
  Field,
  Input,
  Notice,
  Panel,
  Textarea,
} from "../components/ui";
import { errorMessage } from "../utils/errors";

const schema = z.object({
  customer: z.string().min(1, "Selecione o cliente."),
  equipment: z.string().optional(),
  title: z.string().min(1, "Informe o titulo."),
  description: z.string().optional(),
  valid_until: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.input<typeof schema>;

export function QuoteCreatePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      customer: params.get("customer") ?? "",
      equipment: params.get("equipment") ?? "",
      title: "",
      description: "",
      valid_until: "",
      notes: "",
    },
  });
  const customerId = form.watch("customer");
  const equipmentId = form.watch("equipment") ?? "";

  const selectedCustomer = useQuery({
    queryKey: queryKeys.customer(customerId),
    queryFn: () => customersApi.get(customerId),
    enabled: Boolean(customerId),
  });

  const create = useMutation({
    mutationFn: (data: FormData) =>
      quotesApi.create({
        customer: data.customer,
        equipment: data.equipment || null,
        title: data.title,
        description: data.description ?? "",
        valid_until: data.valid_until || null,
        notes: data.notes ?? "",
      }),
    onSuccess: (quote) => navigate(`/quotes/${quote.id}`),
  });

  return (
    <div className="mx-auto max-w-4xl">
      <Breadcrumbs
        items={[
          { label: "Orcamentos", to: "/quotes" },
          ...(selectedCustomer.data
            ? [
                {
                  label: selectedCustomer.data.name,
                  to: `/customers/${selectedCustomer.data.id}?tab=quotes`,
                },
              ]
            : []),
          { label: "Novo" },
        ]}
      />
      <PageHeader
        eyebrow="Proposta comercial"
        title="Novo orcamento"
        description="Defina o contexto da proposta. Itens, valores e workflow ficam na tela do orcamento apos a criacao."
      />

      <Panel>
        <form
          className="grid gap-5 md:grid-cols-2"
          onSubmit={form.handleSubmit((data) => create.mutate(data))}
        >
          <Field
            label="Cliente"
            required
            error={form.formState.errors.customer?.message}
          >
            <CustomerCombobox
              ariaInvalid={Boolean(form.formState.errors.customer)}
              value={customerId}
              onChange={(value) => {
                form.setValue("customer", value, { shouldValidate: true });
                form.setValue("equipment", "");
              }}
            />
          </Field>

          <Field
            label="Equipamento"
            hint="Opcional enquanto a proposta ainda nao estiver ligada a um equipamento especifico."
          >
            <EquipmentCombobox
              customerId={customerId}
              value={equipmentId}
              onChange={(value) => form.setValue("equipment", value)}
            />
          </Field>

          <div className="md:col-span-2">
            <Field
              label="Titulo"
              required
              error={form.formState.errors.title?.message}
            >
              <Input
                aria-invalid={Boolean(form.formState.errors.title)}
                placeholder="Ex.: Upgrade de memoria e manutencao preventiva"
                {...form.register("title")}
              />
            </Field>
          </div>

          <div className="md:col-span-2">
            <Field
              label="Descricao"
              hint="Contexto ou escopo comercial que aparecera na proposta."
            >
              <Textarea rows={5} {...form.register("description")} />
            </Field>
          </div>

          <Field label="Validade">
            <Input type="date" {...form.register("valid_until")} />
          </Field>

          <div className="md:col-span-2">
            <Field
              label="Observacoes"
              hint="Condicoes, ressalvas ou orientacoes destinadas ao cliente."
            >
              <Textarea rows={3} {...form.register("notes")} />
            </Field>
          </div>

          {create.error ? (
            <div className="md:col-span-2">
              <Notice tone="danger">{errorMessage(create.error)}</Notice>
            </div>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4 md:col-span-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(-1)}
            >
              Cancelar
            </Button>
            <Button disabled={create.isPending} type="submit">
              {create.isPending ? "Criando..." : "Criar orcamento"}
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
