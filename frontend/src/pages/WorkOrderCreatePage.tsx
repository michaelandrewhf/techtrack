import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";

import { customersApi, equipmentApi, workOrdersApi } from "../api/endpoints";
import { queryKeys } from "../api/queryKeys";
import { Breadcrumbs } from "../components/Breadcrumbs";
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
  const customers = useQuery({
    queryKey: queryKeys.customers({ page_size: 100, status: "active" }),
    queryFn: () => customersApi.list({ page_size: 100, status: "active" }),
  });
  const equipment = useQuery({
    queryKey: queryKeys.equipment({ customer: customerId, page_size: 100 }),
    queryFn: () => equipmentApi.list({ customer: customerId, page_size: 100 }),
    enabled: Boolean(customerId),
  });
  const mutation = useMutation({
    mutationFn: workOrdersApi.create,
    onSuccess: (created) => navigate(`/work-orders/${created.id}`),
  });

  useEffect(() => {
    if (!customerId) form.setValue("equipment_id", "");
  }, [customerId, form]);

  const selectedCustomer = customers.data?.results.find(
    (customer) => customer.id === customerId,
  );

  return (
    <div className="mx-auto max-w-4xl">
      <Breadcrumbs
        items={[
          { label: "Ordens de servico", to: "/work-orders" },
          ...(selectedCustomer
            ? [
                {
                  label: selectedCustomer.name,
                  to: `/customers/${selectedCustomer.id}?tab=work-orders`,
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
            <Select
              aria-invalid={Boolean(form.formState.errors.customer_id)}
              value={customerId}
              onChange={(event) => {
                form.setValue("customer_id", event.target.value, {
                  shouldValidate: true,
                });
                form.setValue("equipment_id", "");
              }}
            >
              <option value="">Selecione</option>
              {(customers.data?.results ?? []).map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Equipamento"
            required
            error={form.formState.errors.equipment_id?.message}
          >
            <Select
              aria-invalid={Boolean(form.formState.errors.equipment_id)}
              disabled={!customerId}
              {...form.register("equipment_id")}
            >
              <option value="">Selecione</option>
              {(equipment.data?.results ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {[
                    item.equipment_type.name,
                    item.manufacturer,
                    item.model,
                    item.serial_number,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Titulo" required error={form.formState.errors.title?.message}>
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
                aria-invalid={Boolean(form.formState.errors.problem_description)}
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
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800 md:col-span-2">
            <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
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
