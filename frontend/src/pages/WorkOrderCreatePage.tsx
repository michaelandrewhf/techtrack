import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";

import { customersApi, equipmentApi, workOrdersApi } from "../api/endpoints";
import { queryKeys } from "../api/queryKeys";
import { PageHeader } from "../components/PageHeader";
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
    queryKey: queryKeys.customers({ page_size: 100 }),
    queryFn: () => customersApi.list({}),
  });
  const equipment = useQuery({
    queryKey: queryKeys.equipment({ customer: customerId }),
    queryFn: () => equipmentApi.list({ customer: customerId }),
    enabled: Boolean(customerId),
  });
  const mutation = useMutation({
    mutationFn: workOrdersApi.create,
    onSuccess: (created) => navigate(`/work-orders/${created.id}`),
  });

  useEffect(() => {
    if (!customerId) form.setValue("equipment_id", "");
  }, [customerId, form]);

  return (
    <div>
      <PageHeader
        title="Abrir OS"
        description="O status inicial e o numero da OS sao definidos pelo backend."
      />
      <Panel title="Dados da abertura">
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
          <Field label="Equipamento">
            <Select {...form.register("equipment_id")} disabled={!customerId}>
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
                    .join(" - ")}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Titulo">
            <Input {...form.register("title")} />
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
            <Field label="Descricao do problema">
              <Textarea rows={5} {...form.register("problem_description")} />
            </Field>
          </div>
          {mutation.error ? (
            <p className="text-sm text-red-600 md:col-span-2">
              {errorMessage(mutation.error)}
            </p>
          ) : null}
          <div className="md:col-span-2">
            <Button disabled={mutation.isPending} type="submit">
              Abrir OS
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
