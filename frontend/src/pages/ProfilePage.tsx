import { zodResolver } from "@hookform/resolvers/zod";
import { UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useAuth } from "../auth/AuthProvider";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { PageHeader } from "../components/PageHeader";
import { Button, Field, Input, Notice, Panel } from "../components/ui";
import { errorMessage } from "../utils/errors";

const profileSchema = z.object({
  username: z.string().trim().min(1, "Informe o usuario."),
  first_name: z.string().trim().max(150, "Use no maximo 150 caracteres."),
  last_name: z.string().trim().max(150, "Use no maximo 150 caracteres."),
  email: z.string().trim().email("Informe um e-mail valido.").or(z.literal("")),
});

type ProfileForm = z.infer<typeof profileSchema>;

export function ProfilePage() {
  const auth = useAuth();
  const [saved, setSaved] = useState(false);
  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: auth.user?.username ?? "",
      first_name: auth.user?.first_name ?? "",
      last_name: auth.user?.last_name ?? "",
      email: auth.user?.email ?? "",
    },
  });

  useEffect(() => {
    if (!auth.user) return;
    form.reset({
      username: auth.user.username,
      first_name: auth.user.first_name,
      last_name: auth.user.last_name,
      email: auth.user.email,
    });
  }, [auth.user, form]);

  const submit = form.handleSubmit(async (data) => {
    setSaved(false);
    try {
      await auth.updateProfile(data);
      setSaved(true);
    } catch (error) {
      form.setError("root", { message: errorMessage(error) });
    }
  });

  return (
    <div>
      <Breadcrumbs
        items={[{ label: "Inicio", to: "/" }, { label: "Meu perfil" }]}
      />
      <PageHeader
        eyebrow="Conta"
        title="Meu perfil"
        description="Atualize os dados usados para identificar seu usuario dentro do TechTrack."
      />

      <Panel
        title="Dados pessoais"
        subtitle="A alteracao do nome de usuario tambem altera o identificador usado no proximo login."
        className="max-w-3xl"
      >
        <form className="space-y-5" onSubmit={submit}>
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-950">
            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
              <UserRound className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-950 dark:text-white">
                {auth.user?.first_name || auth.user?.username}
              </div>
              <div className="text-xs text-slate-500">
                {auth.user?.is_staff ? "Administrador" : "Usuario"}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Nome de usuario"
              required
              error={form.formState.errors.username?.message}
            >
              <Input autoComplete="username" {...form.register("username")} />
            </Field>
            <Field label="E-mail" error={form.formState.errors.email?.message}>
              <Input
                autoComplete="email"
                type="email"
                {...form.register("email")}
              />
            </Field>
            <Field
              label="Nome"
              error={form.formState.errors.first_name?.message}
            >
              <Input
                autoComplete="given-name"
                {...form.register("first_name")}
              />
            </Field>
            <Field
              label="Sobrenome"
              error={form.formState.errors.last_name?.message}
            >
              <Input
                autoComplete="family-name"
                {...form.register("last_name")}
              />
            </Field>
          </div>

          {saved ? (
            <Notice tone="success">Perfil atualizado com sucesso.</Notice>
          ) : null}
          {form.formState.errors.root ? (
            <Notice tone="danger">{form.formState.errors.root.message}</Notice>
          ) : null}

          <div className="flex justify-end">
            <Button disabled={form.formState.isSubmitting} type="submit">
              {form.formState.isSubmitting ? "Salvando..." : "Salvar perfil"}
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
