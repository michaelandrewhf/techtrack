import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CircleDollarSign,
  ClipboardList,
  FileText,
  Laptop,
  Pencil,
  Plus,
  UserRound,
  WalletCards,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { z } from "zod";

import {
  catalogApi,
  customersApi,
  equipmentApi,
  financeApi,
  quotesApi,
} from "../api/endpoints";
import { queryKeys } from "../api/queryKeys";
import type {
  Equipment,
  Quote,
  Receivable,
  ServiceAgreement,
  WorkOrder,
} from "../api/types";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { CatalogSelect } from "../components/CatalogSelect";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DataTable } from "../components/DataTable";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { ErrorState, PageLoader } from "../components/State";
import { Tabs } from "../components/Tabs";
import {
  Badge,
  Button,
  DescriptionList,
  Field,
  Input,
  MetricCard,
  Notice,
  Panel,
  Select,
  Textarea,
} from "../components/ui";
import { errorMessage } from "../utils/errors";
import { formatDate, formatDateTime, formatMoney } from "../utils/format";

const customerSchema = z.object({
  name: z.string().min(1, "Informe o nome."),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email("E-mail invalido.").or(z.literal("")).optional(),
  notes: z.string().optional(),
  status: z.string().min(1),
});

const equipmentSchema = z.object({
  equipment_type_id: z.string().min(1, "Selecione o tipo."),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serial_number: z.string().optional(),
  asset_tag: z.string().optional(),
  operating_system: z.string().optional(),
  notes: z.string().optional(),
  status: z.string().default("active"),
});

const agreementSchema = z.object({
  name: z.string().min(1, "Informe o nome do contrato."),
  description: z.string().optional(),
  amount: z.string().min(1, "Informe o valor mensal."),
  billing_day: z.string().min(1, "Informe o dia de vencimento."),
  starts_on: z.string().min(1, "Informe a data de inicio."),
});

type CustomerForm = z.input<typeof customerSchema>;
type EquipmentForm = z.input<typeof equipmentSchema>;
type AgreementForm = z.input<typeof agreementSchema>;
type ModalName = "edit" | "equipment" | "agreement" | "payment" | null;

const tabs = [
  { id: "overview", label: "Visao geral" },
  { id: "equipment", label: "Equipamentos" },
  { id: "work-orders", label: "Ordens de servico" },
  { id: "quotes", label: "Orcamentos" },
  { id: "finance", label: "Financeiro" },
];

function customerStatusLabel(status: string) {
  return {
    active: "Ativo",
    inactive: "Inativo",
    prospect: "Prospect",
    blocked: "Bloqueado",
  }[status] ?? status;
}

function agreementStatusLabel(status: string) {
  return {
    active: "Ativo",
    paused: "Pausado",
    ended: "Encerrado",
    cancelled: "Cancelado",
  }[status] ?? status;
}

function receivableTone(receivable: Receivable) {
  if (receivable.is_overdue) return "danger" as const;
  if (receivable.status === "paid") return "success" as const;
  if (receivable.status === "partial") return "warning" as const;
  return "neutral" as const;
}

function quoteTone(status: string) {
  if (status === "approved") return "success" as const;
  if (status === "sent") return "warning" as const;
  if (status === "rejected" || status === "cancelled") return "danger" as const;
  return "neutral" as const;
}

export function CustomerDetailPage() {
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const requestedTab = params.get("tab") ?? "overview";
  const activeTab = tabs.some((tab) => tab.id === requestedTab)
    ? requestedTab
    : "overview";
  const [modal, setModal] = useState<ModalName>(null);
  const [selectedReceivable, setSelectedReceivable] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const queryClient = useQueryClient();

  const customer = useQuery({
    queryKey: queryKeys.customer(id),
    queryFn: () => customersApi.get(id),
  });
  const equipment = useQuery({
    queryKey: queryKeys.customerEquipment(id),
    queryFn: () => customersApi.equipment(id),
  });
  const workOrders = useQuery({
    queryKey: queryKeys.customerWorkOrders(id),
    queryFn: () => customersApi.workOrders(id),
  });
  const quotes = useQuery({
    queryKey: ["quotes", "customer", id],
    queryFn: () => quotesApi.list({ customer: id, ordering: "-created_at", page_size: 100 }),
  });
  const agreements = useQuery({
    queryKey: ["finance", "customer", id, "agreements"],
    queryFn: () => financeApi.agreements({ customer: id, ordering: "-starts_on", page_size: 100 }),
  });
  const receivables = useQuery({
    queryKey: ["finance", "customer", id, "receivables"],
    queryFn: () => financeApi.receivables({ customer: id, ordering: "-due_date", page_size: 100 }),
  });
  const paymentMethods = useQuery({
    queryKey: ["catalog", "payment-methods", "customer-workspace"],
    queryFn: () => catalogApi("payment-methods").list({ is_active: true, page_size: 100 }),
    enabled: activeTab === "finance" || modal === "payment",
  });

  const customerForm = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
  });
  const equipmentForm = useForm<EquipmentForm>({
    resolver: zodResolver(equipmentSchema),
    defaultValues: { status: "active" },
  });
  const agreementForm = useForm<AgreementForm>({
    resolver: zodResolver(agreementSchema),
    defaultValues: {
      name: "Suporte mensal",
      billing_day: "10",
      starts_on: new Date().toISOString().slice(0, 10),
    },
  });

  const invalidateCustomerWorkspace = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["customers"] }),
      queryClient.invalidateQueries({ queryKey: ["equipment"] }),
      queryClient.invalidateQueries({ queryKey: ["work-orders"] }),
      queryClient.invalidateQueries({ queryKey: ["quotes"] }),
      queryClient.invalidateQueries({ queryKey: ["finance"] }),
    ]);
  };

  const updateCustomer = useMutation({
    mutationFn: (data: CustomerForm) => customersApi.update(id, data),
    onSuccess: async () => {
      setModal(null);
      await invalidateCustomerWorkspace();
    },
  });

  const addEquipment = useMutation({
    mutationFn: (data: EquipmentForm) => equipmentApi.create({ ...data, customer_id: id }),
    onSuccess: async () => {
      equipmentForm.reset({ status: "active" });
      setModal(null);
      await invalidateCustomerWorkspace();
    },
  });

  const createAgreement = useMutation({
    mutationFn: (data: AgreementForm) =>
      financeApi.createAgreement({
        customer: id,
        name: data.name,
        description: data.description ?? "",
        status: "active",
        starts_on: data.starts_on,
        ends_on: null,
        billing_frequency: "monthly",
        amount: data.amount,
        billing_day: Number(data.billing_day),
        notes: "",
      }),
    onSuccess: async () => {
      agreementForm.reset({
        name: "Suporte mensal",
        billing_day: "10",
        starts_on: new Date().toISOString().slice(0, 10),
      });
      setModal(null);
      await invalidateCustomerWorkspace();
    },
  });

  const endAgreement = useMutation({
    mutationFn: (agreement: ServiceAgreement) =>
      financeApi.updateAgreement(agreement.id, {
        status: "ended",
        ends_on: new Date().toISOString().slice(0, 10),
      }),
    onSuccess: invalidateCustomerWorkspace,
  });

  const addPayment = useMutation({
    mutationFn: () =>
      financeApi.addPayment(selectedReceivable, {
        amount: paymentAmount,
        payment_method: paymentMethod,
      }),
    onSuccess: async () => {
      setSelectedReceivable("");
      setPaymentAmount("");
      setPaymentMethod("");
      setModal(null);
      await invalidateCustomerWorkspace();
    },
  });

  const activeAgreement = useMemo(
    () => agreements.data?.results.find((agreement) => agreement.status === "active"),
    [agreements.data?.results],
  );
  const openReceivables = useMemo(
    () =>
      receivables.data?.results.filter(
        (row) => row.status !== "paid" && row.status !== "cancelled",
      ) ?? [],
    [receivables.data?.results],
  );
  const pending = openReceivables.reduce((total, row) => total + Number(row.balance), 0);
  const overdue = openReceivables.reduce(
    (total, row) => total + (row.is_overdue ? Number(row.balance) : 0),
    0,
  );

  if (customer.isLoading) return <PageLoader />;
  if (customer.error || !customer.data)
    return <ErrorState message="Cliente nao encontrado." />;

  const item = customer.data;

  const openEdit = () => {
    customerForm.reset({
      name: item.name,
      phone: item.phone,
      whatsapp: item.whatsapp,
      email: item.email,
      notes: item.notes ?? "",
      status: item.status,
    });
    setModal("edit");
  };

  const selectTab = (value: string) => {
    const next = new URLSearchParams(params);
    if (value === "overview") next.delete("tab");
    else next.set("tab", value);
    setParams(next, { replace: true });
  };

  const tabItems = tabs.map((tab) => ({
    ...tab,
    count:
      tab.id === "equipment"
        ? equipment.data?.count
        : tab.id === "work-orders"
          ? workOrders.data?.count
          : tab.id === "quotes"
            ? quotes.data?.count
            : undefined,
  }));

  return (
    <div>
      <Breadcrumbs items={[{ label: "Clientes", to: "/customers" }, { label: item.name }]} />
      <PageHeader
        eyebrow={activeAgreement ? "Cliente mensalista" : "Cliente avulso"}
        title={item.name}
        description="Dados, patrimonio tecnico, atendimentos, orcamentos e financeiro em um unico contexto."
        meta={
          <div className="flex flex-wrap gap-2">
            <Badge tone={item.status === "active" ? "success" : "neutral"}>
              {customerStatusLabel(item.status)}
            </Badge>
            <Badge tone={activeAgreement ? "info" : "neutral"}>
              {activeAgreement ? "Mensalista" : "Avulso"}
            </Badge>
          </div>
        }
        action={
          <>
            <Link to={`/work-orders/new?customer=${id}`}>
              <Button type="button">
                <ClipboardList className="h-4 w-4" />
                Nova OS
              </Button>
            </Link>
            <Link to={`/quotes/new?customer=${id}`}>
              <Button type="button" variant="secondary">
                <FileText className="h-4 w-4" />
                Novo orcamento
              </Button>
            </Link>
            <Button type="button" variant="secondary" onClick={() => setModal("equipment")}>
              <Plus className="h-4 w-4" />
              Equipamento
            </Button>
            <Button type="button" variant="ghost" onClick={openEdit}>
              <Pencil className="h-4 w-4" />
              Editar
            </Button>
          </>
        }
      />

      <Tabs items={tabItems} value={activeTab} onChange={selectTab} />

      <div className="mt-5">
        {activeTab === "overview" ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                icon={<UserRound className="h-5 w-5" />}
                label="Relacionamento"
                tone={activeAgreement ? "info" : "neutral"}
                value={activeAgreement ? "Mensalista" : "Avulso"}
                hint={
                  activeAgreement
                    ? `${formatMoney(activeAgreement.amount)} / mes · vence dia ${activeAgreement.billing_day}`
                    : "Sem contrato recorrente ativo"
                }
              />
              <MetricCard
                icon={<Laptop className="h-5 w-5" />}
                label="Equipamentos"
                value={equipment.data?.count ?? 0}
                hint="Patrimonio vinculado ao cliente"
              />
              <MetricCard
                icon={<ClipboardList className="h-5 w-5" />}
                label="OS abertas"
                tone={(item.active_work_order_count ?? 0) > 0 ? "warning" : "neutral"}
                value={item.active_work_order_count ?? 0}
                hint={`Ultima OS: ${formatDateTime(item.latest_work_order_at)}`}
              />
              <MetricCard
                icon={<WalletCards className="h-5 w-5" />}
                label="Saldo pendente"
                tone={overdue > 0 ? "danger" : pending > 0 ? "warning" : "success"}
                value={formatMoney(pending)}
                hint={overdue > 0 ? `${formatMoney(overdue)} em atraso` : "Sem atraso identificado"}
              />
            </div>

            <div className="grid gap-5 xl:grid-cols-[1fr_1.4fr]">
              <Panel
                title="Cadastro e contato"
                action={
                  <Button size="sm" type="button" variant="ghost" onClick={openEdit}>
                    <Pencil className="h-4 w-4" />
                    Editar
                  </Button>
                }
              >
                <DescriptionList
                  items={[
                    { label: "Telefone", value: item.phone || "-" },
                    { label: "WhatsApp", value: item.whatsapp || "-" },
                    { label: "E-mail", value: item.email || "-" },
                    { label: "Cliente desde", value: formatDate(item.customer_since) },
                    { label: "Status", value: customerStatusLabel(item.status) },
                    { label: "Observacoes", value: item.notes || "Sem observacoes." },
                  ]}
                />
              </Panel>

              <Panel
                title="Contrato / mensalidade"
                subtitle="O perfil avulso ou mensalista e derivado do contrato vigente, sem duplicar estado no cadastro."
                action={
                  !activeAgreement ? (
                    <Button size="sm" type="button" onClick={() => setModal("agreement")}>
                      <Plus className="h-4 w-4" />
                      Tornar mensalista
                    </Button>
                  ) : undefined
                }
              >
                {activeAgreement ? (
                  <div className="space-y-4">
                    <div className="rounded-xl bg-blue-50 p-4 dark:bg-blue-950/40">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-950 dark:text-white">
                            {activeAgreement.name}
                          </div>
                          <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                            Desde {formatDate(activeAgreement.starts_on)} · {formatMoney(activeAgreement.amount)} por mes · vencimento dia {activeAgreement.billing_day}
                          </div>
                        </div>
                        <Badge tone="success">Ativo</Badge>
                      </div>
                    </div>
                    <ConfirmDialog
                      title="Encerrar contrato"
                      description="O contrato sera encerrado hoje e permanecera no historico financeiro do cliente."
                      confirmLabel="Encerrar contrato"
                      onConfirm={() => endAgreement.mutate(activeAgreement)}
                    >
                      <Button type="button" variant="secondary">
                        Encerrar mensalidade
                      </Button>
                    </ConfirmDialog>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center dark:border-slate-700">
                    <p className="text-sm text-slate-500">
                      Este cliente e atendido como avulso. O historico de contratos anteriores continua preservado.
                    </p>
                    <Button className="mt-4" type="button" onClick={() => setModal("agreement")}>
                      Tornar mensalista
                    </Button>
                  </div>
                )}
              </Panel>
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <Panel
                title="Atendimentos recentes"
                action={
                  <button className="text-sm font-medium text-blue-600" type="button" onClick={() => selectTab("work-orders")}>
                    Ver todas
                  </button>
                }
              >
                <div className="space-y-2">
                  {(workOrders.data?.results ?? []).slice(0, 4).map((row) => (
                    <Link
                      className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-3 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                      key={row.id}
                      to={`/work-orders/${row.id}`}
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {row.display_number} · {row.title}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {formatDateTime(row.opened_at)}
                        </div>
                      </div>
                      <Badge>{row.status.name}</Badge>
                    </Link>
                  ))}
                  {!workOrders.data?.results.length ? (
                    <p className="text-sm text-slate-500">Nenhuma OS para este cliente.</p>
                  ) : null}
                </div>
              </Panel>

              <Panel
                title="Orcamentos recentes"
                action={
                  <button className="text-sm font-medium text-blue-600" type="button" onClick={() => selectTab("quotes")}>
                    Ver todos
                  </button>
                }
              >
                <div className="space-y-2">
                  {(quotes.data?.results ?? []).slice(0, 4).map((row) => (
                    <Link
                      className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-3 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                      key={row.id}
                      to={`/quotes/${row.id}`}
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {row.display_number} · {row.title}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Total {formatMoney(row.total_amount)}
                        </div>
                      </div>
                      <Badge tone={quoteTone(row.status)}>{row.status}</Badge>
                    </Link>
                  ))}
                  {!quotes.data?.results.length ? (
                    <p className="text-sm text-slate-500">Nenhum orcamento para este cliente.</p>
                  ) : null}
                </div>
              </Panel>
            </div>
          </div>
        ) : null}

        {activeTab === "equipment" ? (
          <Panel
            title="Equipamentos"
            subtitle="Patrimonio tecnico vinculado ao cliente."
            action={
              <Button size="sm" type="button" onClick={() => setModal("equipment")}>
                <Plus className="h-4 w-4" />
                Adicionar
              </Button>
            }
          >
            <DataTable<Equipment>
              empty="Nenhum equipamento vinculado."
              getRowKey={(row) => row.id}
              rows={equipment.data?.results ?? []}
              columns={[
                { header: "Tipo", cell: (row) => row.equipment_type.name },
                {
                  header: "Equipamento",
                  cell: (row) => (
                    <Link className="font-medium text-blue-700 dark:text-blue-300" to={`/equipment/${row.id}`}>
                      {[row.manufacturer, row.model].filter(Boolean).join(" ") || row.equipment_type.name}
                    </Link>
                  ),
                },
                { header: "Serial", cell: (row) => row.serial_number || "-" },
                { header: "Patrimonio", cell: (row) => row.asset_tag || "-" },
                { header: "Status", cell: (row) => <Badge>{row.status}</Badge> },
                {
                  header: "Acao",
                  cell: (row) => (
                    <Link to={`/work-orders/new?customer=${id}&equipment=${row.id}`}>
                      <Button size="sm" type="button" variant="secondary">Abrir OS</Button>
                    </Link>
                  ),
                },
              ]}
            />
          </Panel>
        ) : null}

        {activeTab === "work-orders" ? (
          <Panel
            title="Ordens de servico"
            subtitle="Historico de atendimentos e manutencoes do cliente."
            action={
              <Link to={`/work-orders/new?customer=${id}`}>
                <Button size="sm" type="button">
                  <Plus className="h-4 w-4" />
                  Nova OS
                </Button>
              </Link>
            }
          >
            <DataTable<WorkOrder>
              empty="Nenhuma OS para este cliente."
              getRowKey={(row) => row.id}
              rows={workOrders.data?.results ?? []}
              columns={[
                {
                  header: "OS",
                  cell: (row) => (
                    <Link className="font-semibold text-blue-700 dark:text-blue-300" to={`/work-orders/${row.id}`}>
                      {row.display_number}
                    </Link>
                  ),
                },
                { header: "Titulo", cell: (row) => row.title },
                {
                  header: "Equipamento",
                  cell: (row) => [row.equipment.manufacturer, row.equipment.model].filter(Boolean).join(" ") || row.equipment.equipment_type.name,
                },
                { header: "Status", cell: (row) => <Badge>{row.status.name}</Badge> },
                { header: "Abertura", cell: (row) => formatDateTime(row.opened_at) },
              ]}
            />
          </Panel>
        ) : null}

        {activeTab === "quotes" ? (
          <Panel
            title="Orcamentos"
            subtitle="Propostas comerciais criadas para este cliente."
            action={
              <Link to={`/quotes/new?customer=${id}`}>
                <Button size="sm" type="button">
                  <Plus className="h-4 w-4" />
                  Novo orcamento
                </Button>
              </Link>
            }
          >
            <DataTable<Quote>
              empty="Nenhum orcamento para este cliente."
              getRowKey={(row) => row.id}
              rows={quotes.data?.results ?? []}
              columns={[
                {
                  header: "Orcamento",
                  cell: (row) => (
                    <Link className="font-semibold text-blue-700 dark:text-blue-300" to={`/quotes/${row.id}`}>
                      {row.display_number}
                    </Link>
                  ),
                },
                { header: "Titulo", cell: (row) => row.title },
                { header: "Equipamento", cell: (row) => row.equipment_label || "-" },
                { header: "Total", cell: (row) => formatMoney(row.total_amount) },
                { header: "Status", cell: (row) => <Badge tone={quoteTone(row.status)}>{row.status}</Badge> },
                { header: "Validade", cell: (row) => formatDate(row.valid_until) },
              ]}
            />
          </Panel>
        ) : null}

        {activeTab === "finance" ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard label="Saldo pendente" value={formatMoney(pending)} tone={pending > 0 ? "warning" : "success"} />
              <MetricCard label="Em atraso" value={formatMoney(overdue)} tone={overdue > 0 ? "danger" : "success"} />
              <MetricCard label="Relacionamento" value={activeAgreement ? "Mensalista" : "Avulso"} tone={activeAgreement ? "info" : "neutral"} />
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
              <Panel
                title="Contas a receber"
                subtitle="Cobrancas avulsas, de OS e mensalidades do cliente."
                action={
                  openReceivables.length ? (
                    <Button size="sm" type="button" onClick={() => setModal("payment")}>
                      <CircleDollarSign className="h-4 w-4" />
                      Registrar pagamento
                    </Button>
                  ) : undefined
                }
              >
                <DataTable<Receivable>
                  empty="Nenhum lancamento financeiro."
                  getRowKey={(row) => row.id}
                  rows={receivables.data?.results ?? []}
                  columns={[
                    { header: "Descricao", cell: (row) => row.description },
                    { header: "Vencimento", cell: (row) => formatDate(row.due_date) },
                    { header: "Valor", cell: (row) => formatMoney(row.amount) },
                    { header: "Saldo", cell: (row) => formatMoney(row.balance) },
                    {
                      header: "Status",
                      cell: (row) => (
                        <Badge tone={receivableTone(row)}>
                          {row.is_overdue ? "Vencido" : row.status}
                        </Badge>
                      ),
                    },
                  ]}
                />
              </Panel>

              <Panel
                title="Historico de contratos"
                action={
                  !activeAgreement ? (
                    <Button size="sm" type="button" onClick={() => setModal("agreement")}>
                      <Plus className="h-4 w-4" />
                      Criar contrato
                    </Button>
                  ) : undefined
                }
              >
                <div className="space-y-3">
                  {(agreements.data?.results ?? []).map((agreement) => (
                    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800" key={agreement.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-slate-950 dark:text-white">{agreement.name}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {formatDate(agreement.starts_on)} → {agreement.ends_on ? formatDate(agreement.ends_on) : "atual"}
                          </div>
                        </div>
                        <Badge tone={agreement.status === "active" ? "success" : "neutral"}>
                          {agreementStatusLabel(agreement.status)}
                        </Badge>
                      </div>
                      <div className="mt-3 text-sm">
                        {formatMoney(agreement.amount)} · vencimento dia {agreement.billing_day}
                      </div>
                    </div>
                  ))}
                  {!agreements.data?.results.length ? (
                    <p className="text-sm text-slate-500">Nenhum contrato registrado.</p>
                  ) : null}
                </div>
              </Panel>
            </div>
          </div>
        ) : null}
      </div>

      <Modal open={modal === "edit"} title="Editar cliente" description="Atualize os dados sem sair do contexto do cliente." onClose={() => setModal(null)}>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={customerForm.handleSubmit((data) => updateCustomer.mutate(data))}>
          <Field label="Nome" required error={customerForm.formState.errors.name?.message}>
            <Input aria-invalid={Boolean(customerForm.formState.errors.name)} {...customerForm.register("name")} />
          </Field>
          <Field label="Status">
            <Select {...customerForm.register("status")}>
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
              <option value="prospect">Prospect</option>
              <option value="blocked">Bloqueado</option>
            </Select>
          </Field>
          <Field label="Telefone"><Input {...customerForm.register("phone")} /></Field>
          <Field label="WhatsApp"><Input {...customerForm.register("whatsapp")} /></Field>
          <div className="sm:col-span-2">
            <Field label="E-mail" error={customerForm.formState.errors.email?.message}>
              <Input aria-invalid={Boolean(customerForm.formState.errors.email)} {...customerForm.register("email")} />
            </Field>
          </div>
          <div className="sm:col-span-2"><Field label="Observacoes"><Textarea {...customerForm.register("notes")} /></Field></div>
          {updateCustomer.error ? <div className="sm:col-span-2"><Notice tone="danger">{errorMessage(updateCustomer.error)}</Notice></div> : null}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="secondary" onClick={() => setModal(null)}>Cancelar</Button>
            <Button disabled={updateCustomer.isPending} type="submit">Salvar alteracoes</Button>
          </div>
        </form>
      </Modal>

      <Modal open={modal === "equipment"} title="Adicionar equipamento" description={`Novo patrimonio para ${item.name}.`} size="lg" onClose={() => setModal(null)}>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={equipmentForm.handleSubmit((data) => addEquipment.mutate(data))}>
          <Controller
            control={equipmentForm.control}
            name="equipment_type_id"
            render={({ field }) => (
              <CatalogSelect label="Tipo" resource="equipment-types" value={field.value} onChange={field.onChange} />
            )}
          />
          <Field label="Status">
            <Select {...equipmentForm.register("status")}>
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
              <option value="under_maintenance">Em manutencao</option>
              <option value="retired">Baixado</option>
            </Select>
          </Field>
          <Field label="Fabricante"><Input {...equipmentForm.register("manufacturer")} /></Field>
          <Field label="Modelo"><Input {...equipmentForm.register("model")} /></Field>
          <Field label="Serial"><Input {...equipmentForm.register("serial_number")} /></Field>
          <Field label="Patrimonio"><Input {...equipmentForm.register("asset_tag")} /></Field>
          <div className="sm:col-span-2"><Field label="Sistema operacional"><Input {...equipmentForm.register("operating_system")} /></Field></div>
          <div className="sm:col-span-2"><Field label="Observacoes"><Textarea {...equipmentForm.register("notes")} /></Field></div>
          {addEquipment.error ? <div className="sm:col-span-2"><Notice tone="danger">{errorMessage(addEquipment.error)}</Notice></div> : null}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="secondary" onClick={() => setModal(null)}>Cancelar</Button>
            <Button disabled={addEquipment.isPending} type="submit">Salvar equipamento</Button>
          </div>
        </form>
      </Modal>

      <Modal open={modal === "agreement"} title="Tornar cliente mensalista" description="Crie um contrato recorrente sem alterar o cadastro base do cliente." onClose={() => setModal(null)}>
        <form className="space-y-4" onSubmit={agreementForm.handleSubmit((data) => createAgreement.mutate(data))}>
          <Field label="Nome do contrato" required error={agreementForm.formState.errors.name?.message}>
            <Input {...agreementForm.register("name")} />
          </Field>
          <Field label="Descricao"><Textarea {...agreementForm.register("description")} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Valor mensal" required error={agreementForm.formState.errors.amount?.message}>
              <Input inputMode="decimal" {...agreementForm.register("amount")} />
            </Field>
            <Field label="Dia de vencimento" required error={agreementForm.formState.errors.billing_day?.message}>
              <Input max={31} min={1} type="number" {...agreementForm.register("billing_day")} />
            </Field>
          </div>
          <Field label="Inicio" required error={agreementForm.formState.errors.starts_on?.message}>
            <Input type="date" {...agreementForm.register("starts_on")} />
          </Field>
          {createAgreement.error ? <Notice tone="danger">{errorMessage(createAgreement.error)}</Notice> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModal(null)}>Cancelar</Button>
            <Button disabled={createAgreement.isPending} type="submit">Criar contrato</Button>
          </div>
        </form>
      </Modal>

      <Modal open={modal === "payment"} title="Registrar pagamento" description="Baixa contextual sem precisar abrir o Financeiro consolidado." onClose={() => setModal(null)}>
        <div className="space-y-4">
          <Field label="Conta a receber" required>
            <Select value={selectedReceivable} onChange={(event) => {
              const value = event.target.value;
              setSelectedReceivable(value);
              const row = openReceivables.find((candidate) => candidate.id === value);
              setPaymentAmount(row?.balance ?? "");
            }}>
              <option value="">Selecione</option>
              {openReceivables.map((row) => (
                <option key={row.id} value={row.id}>{row.description} · {formatMoney(row.balance)}</option>
              ))}
            </Select>
          </Field>
          <Field label="Valor" required><Input inputMode="decimal" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} /></Field>
          <Field label="Metodo de pagamento" required>
            <Select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
              <option value="">Selecione</option>
              {(paymentMethods.data?.results ?? []).map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
            </Select>
          </Field>
          {addPayment.error ? <Notice tone="danger">{errorMessage(addPayment.error)}</Notice> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModal(null)}>Cancelar</Button>
            <Button disabled={!selectedReceivable || !paymentAmount || !paymentMethod || addPayment.isPending} type="button" onClick={() => addPayment.mutate()}>Registrar pagamento</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
