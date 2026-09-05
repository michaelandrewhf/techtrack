import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, FileText, Pencil, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useParams, useSearchParams } from "react-router-dom";

import {
  catalogApi,
  customersApi,
  equipmentApi,
  financeApi,
  quotesApi,
} from "../api/endpoints";
import { queryKeys } from "../api/queryKeys";
import type { ServiceAgreement } from "../api/types";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { PageHeader } from "../components/PageHeader";
import { ErrorState, PageLoader } from "../components/State";
import { Tabs } from "../components/Tabs";
import { Badge, Button } from "../components/ui";
import { CustomerAgreementDialog } from "../features/customer/CustomerAgreementDialog";
import { CustomerEditDialog } from "../features/customer/CustomerEditDialog";
import { CustomerEquipmentDialog } from "../features/customer/CustomerEquipmentDialog";
import { CustomerEquipmentTab } from "../features/customer/CustomerEquipmentTab";
import { CustomerFinanceTab } from "../features/customer/CustomerFinanceTab";
import { CustomerOverviewTab } from "../features/customer/CustomerOverviewTab";
import { CustomerPaymentDialog } from "../features/customer/CustomerPaymentDialog";
import { CustomerQuotesTab } from "../features/customer/CustomerQuotesTab";
import { CustomerWorkOrdersTab } from "../features/customer/CustomerWorkOrdersTab";
import {
  agreementSchema,
  customerSchema,
  customerStatusLabel,
  customerTabs,
  equipmentSchema,
  type AgreementForm,
  type CustomerForm,
  type CustomerModal,
  type EquipmentForm,
} from "../features/customer/detail";

export function CustomerDetailPage() {
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const requestedTab = params.get("tab") ?? "overview";
  const activeTab = customerTabs.some((tab) => tab.id === requestedTab)
    ? requestedTab
    : "overview";
  const [modal, setModal] = useState<CustomerModal>(null);
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
    enabled: activeTab === "equipment",
  });
  const workOrders = useQuery({
    queryKey: queryKeys.customerWorkOrders(id),
    queryFn: () => customersApi.workOrders(id),
    enabled: activeTab === "overview" || activeTab === "work-orders",
  });
  const quotes = useQuery({
    queryKey: ["quotes", "customer", id],
    queryFn: () =>
      quotesApi.list({ customer: id, ordering: "-created_at", page_size: 100 }),
    enabled: activeTab === "overview" || activeTab === "quotes",
  });
  const agreements = useQuery({
    queryKey: ["finance", "customer", id, "agreements"],
    queryFn: () =>
      financeApi.agreements({
        customer: id,
        ordering: "-starts_on",
        page_size: 100,
      }),
  });
  const receivables = useQuery({
    queryKey: ["finance", "customer", id, "receivables"],
    queryFn: () =>
      financeApi.receivables({
        customer: id,
        ordering: "-due_date",
        page_size: 100,
      }),
    enabled:
      activeTab === "overview" ||
      activeTab === "finance" ||
      modal === "payment",
  });
  const paymentMethods = useQuery({
    queryKey: ["catalog", "payment-methods", "customer-workspace"],
    queryFn: () =>
      catalogApi("payment-methods").list({ is_active: true, page_size: 100 }),
    enabled:
      activeTab === "finance" || modal === "payment" || modal === "agreement",
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
      first_billing_mode: "next_month",
      first_payment_method: "",
    },
  });
  const firstBillingMode = agreementForm.watch("first_billing_mode");

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
    mutationFn: (data: EquipmentForm) =>
      equipmentApi.create({ ...data, customer_id: id }),
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
        first_billing_mode: data.first_billing_mode,
        first_payment_method:
          data.first_billing_mode === "receive_now"
            ? data.first_payment_method
            : undefined,
        notes: "",
      }),
    onSuccess: async () => {
      agreementForm.reset({
        name: "Suporte mensal",
        billing_day: "10",
        starts_on: new Date().toISOString().slice(0, 10),
        first_billing_mode: "next_month",
        first_payment_method: "",
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
    () =>
      agreements.data?.results.find(
        (agreement) => agreement.status === "active",
      ),
    [agreements.data?.results],
  );
  const openReceivables = useMemo(
    () =>
      receivables.data?.results.filter(
        (row) => row.status !== "paid" && row.status !== "cancelled",
      ) ?? [],
    [receivables.data?.results],
  );
  const pending = openReceivables.reduce(
    (total, row) => total + Number(row.balance),
    0,
  );
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

  const tabItems = customerTabs.map((tab) => ({
    ...tab,
    count:
      tab.id === "equipment"
        ? item.equipment_count
        : tab.id === "work-orders"
          ? workOrders.data?.count
          : tab.id === "quotes"
            ? quotes.data?.count
            : undefined,
  }));

  const handleReceivableChange = (value: string) => {
    setSelectedReceivable(value);
    const row = openReceivables.find((candidate) => candidate.id === value);
    setPaymentAmount(row?.balance ?? "");
  };

  return (
    <div>
      <Breadcrumbs
        items={[{ label: "Clientes", to: "/customers" }, { label: item.name }]}
      />
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
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModal("equipment")}
            >
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
          <CustomerOverviewTab
            activeAgreement={activeAgreement}
            customer={item}
            equipmentCount={item.equipment_count ?? 0}
            overdue={overdue}
            pending={pending}
            quotes={quotes.data?.results ?? []}
            workOrders={workOrders.data?.results ?? []}
            onEdit={openEdit}
            onEndAgreement={(agreement) => endAgreement.mutate(agreement)}
            onOpenAgreement={() => setModal("agreement")}
            onSelectTab={selectTab}
          />
        ) : null}

        {activeTab === "equipment" ? (
          <CustomerEquipmentTab
            customerId={id}
            rows={equipment.data?.results ?? []}
            onAdd={() => setModal("equipment")}
          />
        ) : null}

        {activeTab === "work-orders" ? (
          <CustomerWorkOrdersTab
            customerId={id}
            rows={workOrders.data?.results ?? []}
          />
        ) : null}

        {activeTab === "quotes" ? (
          <CustomerQuotesTab
            customerId={id}
            rows={quotes.data?.results ?? []}
          />
        ) : null}

        {activeTab === "finance" ? (
          <CustomerFinanceTab
            activeAgreement={activeAgreement}
            agreements={agreements.data?.results ?? []}
            openReceivables={openReceivables}
            overdue={overdue}
            pending={pending}
            receivables={receivables.data?.results ?? []}
            onOpenAgreement={() => setModal("agreement")}
            onOpenPayment={() => setModal("payment")}
          />
        ) : null}
      </div>

      <CustomerEditDialog
        error={updateCustomer.error}
        form={customerForm}
        open={modal === "edit"}
        pending={updateCustomer.isPending}
        onClose={() => setModal(null)}
        onSubmit={(data) => updateCustomer.mutate(data)}
      />

      <CustomerEquipmentDialog
        customerName={item.name}
        error={addEquipment.error}
        form={equipmentForm}
        open={modal === "equipment"}
        pending={addEquipment.isPending}
        onClose={() => setModal(null)}
        onSubmit={(data) => addEquipment.mutate(data)}
      />

      <CustomerAgreementDialog
        error={createAgreement.error}
        firstBillingMode={firstBillingMode}
        form={agreementForm}
        open={modal === "agreement"}
        paymentMethods={paymentMethods.data?.results ?? []}
        pending={createAgreement.isPending}
        onClose={() => setModal(null)}
        onSubmit={(data) => createAgreement.mutate(data)}
      />

      <CustomerPaymentDialog
        error={addPayment.error}
        open={modal === "payment"}
        openReceivables={openReceivables}
        paymentAmount={paymentAmount}
        paymentMethod={paymentMethod}
        paymentMethods={paymentMethods.data?.results ?? []}
        pending={addPayment.isPending}
        selectedReceivable={selectedReceivable}
        onClose={() => setModal(null)}
        onPaymentAmountChange={setPaymentAmount}
        onPaymentMethodChange={setPaymentMethod}
        onSelectedReceivableChange={handleReceivableChange}
        onSubmit={() => addPayment.mutate()}
      />
    </div>
  );
}
