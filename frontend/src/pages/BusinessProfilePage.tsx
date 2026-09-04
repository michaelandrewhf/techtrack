import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  businessProfileApi,
  type BusinessProfileInput,
} from "../api/businessProfile";
import { useAuth } from "../auth/AuthProvider";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { PageHeader } from "../components/PageHeader";
import { ErrorState, PageLoader } from "../components/State";
import {
  Button,
  Field,
  Input,
  Notice,
  Panel,
  Textarea,
} from "../components/ui";
import { errorMessage } from "../utils/errors";

const businessProfileSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do prestador ou empresa."),
  document: z.string().trim().max(40, "Use no maximo 40 caracteres."),
  phone: z.string().trim().max(40, "Use no maximo 40 caracteres."),
  whatsapp: z.string().trim().max(40, "Use no maximo 40 caracteres."),
  email: z.string().trim().email("Informe um e-mail valido.").or(z.literal("")),
  address: z.string().trim(),
});

type BusinessProfileForm = z.infer<typeof businessProfileSchema>;

export function BusinessProfilePage() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const query = useQuery({
    queryKey: ["business-profile"],
    queryFn: businessProfileApi.get,
  });
  const form = useForm<BusinessProfileForm>({
    resolver: zodResolver(businessProfileSchema),
    defaultValues: {
      name: "",
      document: "",
      phone: "",
      whatsapp: "",
      email: "",
      address: "",
    },
  });

  useEffect(() => {
    if (!query.data) return;
    form.reset({
      name: query.data.name,
      document: query.data.document,
      phone: query.data.phone,
      whatsapp: query.data.whatsapp,
      email: query.data.email,
      address: query.data.address,
    });
  }, [form, query.data]);

  const mutation = useMutation({
    mutationFn: (data: BusinessProfileInput) => businessProfileApi.update(data),
    onSuccess: (data) => {
      queryClient.setQueryData(["business-profile"], data);
      setSaved(true);
    },
  });

  const submit = form.handleSubmit((data) => {
    setSaved(false);
    mutation.mutate(data);
  });

  if (query.isLoading)
    return <PageLoader label="Carregando dados da empresa" />;
  if (query.isError) {
    return (
      <ErrorState
        message={errorMessage(query.error)}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const canEdit = Boolean(auth.user?.is_staff);

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Configuracoes", to: "/settings" },
          { label: "Dados da empresa" },
        ]}
      />
      <PageHeader
        eyebrow="Documentos"
        title="Dados da empresa"
        description="Cadastre as informacoes do prestador que aparecem nos PDFs de orcamento e ordem de servico."
      />

      <Panel
        title="Identificacao do prestador"
        subtitle="Novas previas e emissoes usam estes dados. Documentos ja emitidos continuam preservando o snapshot original."
        className="max-w-4xl"
      >
        <form className="space-y-5" onSubmit={submit}>
          <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-950">
            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300">
              Estes campos alimentam diretamente a secao{" "}
              <strong>Prestador</strong> dos PDFs.
            </div>
          </div>

          {!canEdit ? (
            <Notice tone="warning">
              Apenas administradores podem alterar os dados exibidos nos
              documentos.
            </Notice>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Nome / Razao social"
              required
              error={form.formState.errors.name?.message}
            >
              <Input disabled={!canEdit} {...form.register("name")} />
            </Field>
            <Field
              label="CPF / CNPJ"
              error={form.formState.errors.document?.message}
            >
              <Input disabled={!canEdit} {...form.register("document")} />
            </Field>
            <Field
              label="Telefone"
              error={form.formState.errors.phone?.message}
            >
              <Input
                disabled={!canEdit}
                inputMode="tel"
                {...form.register("phone")}
              />
            </Field>
            <Field
              label="WhatsApp"
              error={form.formState.errors.whatsapp?.message}
            >
              <Input
                disabled={!canEdit}
                inputMode="tel"
                {...form.register("whatsapp")}
              />
            </Field>
            <Field label="E-mail" error={form.formState.errors.email?.message}>
              <Input
                disabled={!canEdit}
                type="email"
                {...form.register("email")}
              />
            </Field>
          </div>

          <Field
            label="Endereco"
            error={form.formState.errors.address?.message}
          >
            <Textarea disabled={!canEdit} {...form.register("address")} />
          </Field>

          {saved ? (
            <Notice tone="success">
              Dados atualizados. As proximas previas e emissoes de PDF ja usarao
              estas informacoes.
            </Notice>
          ) : null}
          {mutation.isError ? (
            <Notice tone="danger">{errorMessage(mutation.error)}</Notice>
          ) : null}

          <div className="flex justify-end">
            <Button disabled={!canEdit || mutation.isPending} type="submit">
              {mutation.isPending ? "Salvando..." : "Salvar dados da empresa"}
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
