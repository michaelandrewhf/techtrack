import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";

import { customersApi, workOrdersApi } from "../api/endpoints";
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
  Select,
  Textarea,
} from "../components/ui";
import { errorMessage } from "../utils/errors";

const schema = z.object({
  customer_id: z.string().min(1, "Selecione o cliente."),
  equipment_id: z.string().min(1, "Selecione o equipamento."),
  title: z.string().min(1, "Informe o titulo."),
  problem_description: z.string().min(1, "Descreva o problema."),
  priority: z.string().default("normal"),
});

type FormData = z.input<typeof schema>;

export function WorkOrderCreatePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      customer_id: params.get("customer") ?? "",
      equipment_id: params.get("equipment") ?? "",
      priority: "normal",
    },
  });
  const customerId = form.watch("customer_id");
  const equipmentId = form.watch("equipment_id") ?? "";

  const selectedCustomer = useQuery({
    queryKey: queryKeys.customer(customerId),
    queryFn: () => customersApi.get(customerId),
    enabled: Boolean(customerId),
  });

  const mutation = useMutation({
    mutationFn: workOrdersApi.create,
    onSuccess: (created) => navigate(`/work-orders/${created.id}`),
  });

  return (
    <div className="mx-auto max-w-4xl">
      <Breadcrumbs
        items={[
          { label: "Ordens de servico", to: "/work-orders" },
          ...(selectedCustomer.data
            ? [
                {
                  label: selectedCustomer.data.name,
                  to: `/customers/${selectedCustomer.data.id}?tab=work-orders`,
                },
              ]
            : []),
          { label: "Nova OS" },
        ]}
      />
      <PageHeader
        eyebrow="Atendimento tecnico"
        title="Abrir ordem de servico"
        description="Mantenha cliente e equipamento no mesmo contexto. O numero e o status inicial continuam definidos pelo backend."
      />
      <Panel>
        <form
          className="grid gap-5 md:grid-cols-2"
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
              onChange={(value) => {
                form.setValue("customer_id", value, { shouldValidate: true });
                form.setValue("equipment_id", "", { shouldValidate: true });
              }}
            />
          </Field>
          <Field
            label="Equipamento"
            required
            error={form.formState.errors.equipment_id?.message}
          >
            <EquipmentCombobox
              required
              ariaInvalid={Boolean(form.formState.errors.equipment_id)}
              customerId={customerId}
              value={equipmentId}
              onChange={(value) =>
                form.setValue("equipment_id", value, { shouldValidate: true })
              }
            />
          </Field>
          <Field
            label="Titulo"
            required
            error={form.formState.errors.title?.message}
          >
            <Input
              aria-invalid={Boolean(form.formState.errors.title)}
              placeholder="Resumo objetivo do atendimento"
              {...form.register("title")}
            />
          </Field>
          <Field label="Prioridade">
            <Select {...form.register("priority")}>
              <option value="low">Baixa</option>
              <option value="normal">Normal</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </Select>
          </Field>
          <div className="md:col-span-2">
            <Field
              label="Problema relatado"
              required
              error={form.formState.errors.problem_description?.message}
              hint="Registre o relato inicial do cliente; diagnostico e solucao serao tratados dentro da OS."
            >
              <Textarea
                aria-invalid={Boolean(
                  form.formState.errors.problem_description,
                )}
                rows={5}
                {...form.register("problem_description")}
              />
            </Field>
          </div>
          {mutation.error ? (
            <div className="md:col-span-2">
              <Notice tone="danger">{errorMessage(mutation.error)}</Notice>
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
            <Button disabled={mutation.isPending} type="submit">
              {mutation.isPending ? "Abrindo..." : "Abrir OS"}
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
