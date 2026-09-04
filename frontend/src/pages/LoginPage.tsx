import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, ClipboardList, ShieldCheck, Wrench } from "lucide-react";
import { useForm } from "react-hook-form";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";

import { useAuth } from "../auth/AuthProvider";
import { Button, Field, Input, Notice } from "../components/ui";
import { errorMessage } from "../utils/errors";

const loginSchema = z.object({
  username: z.string().min(1, "Informe o usuario."),
  password: z.string().min(1, "Informe a senha."),
});

type LoginForm = z.infer<typeof loginSchema>;

const highlights = [
  { icon: ClipboardList, label: "Fluxos tecnicos" },
  { icon: CheckCircle2, label: "Historico rastreavel" },
  { icon: ShieldCheck, label: "Acesso autenticado" },
];

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const form = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });
  const from =
    (location.state as { from?: Location } | null)?.from?.pathname ?? "/";

  if (auth.isAuthenticated) return <Navigate to="/" replace />;

  const submit = form.handleSubmit(async (data) => {
    try {
      await auth.login(data.username, data.password);
      navigate(from, { replace: true });
    } catch (error) {
      form.setError("root", { message: errorMessage(error) });
    }
  });

  return (
    <main className="grid min-h-screen bg-slate-950 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.34),_transparent_44%)]" />
        <div className="relative flex items-center gap-3 text-white">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-950/30">
            <Wrench className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg font-semibold tracking-tight">
              TechTrack
            </div>
            <div className="text-sm text-slate-400">
              Gestao de suporte e manutencao TI
            </div>
          </div>
        </div>

        <div className="relative max-w-xl">
          <div className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-300">
            Operacao conectada
          </div>
          <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-white xl:text-5xl">
            Do cliente ao atendimento, sem perder o contexto.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">
            Clientes, equipamentos, ordens, orcamentos e financeiro reunidos em
            uma experiencia orientada ao trabalho real.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {highlights.map((item) => (
              <div
                className="rounded-xl border border-white/10 bg-white/5 p-4"
                key={item.label}
              >
                <item.icon className="h-5 w-5 text-blue-300" />
                <div className="mt-3 text-sm font-medium text-slate-100">
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-xs text-slate-500">
          TechTrack · ambiente interno
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center bg-slate-50 p-5 dark:bg-slate-950 sm:p-8">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                <Wrench className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold text-slate-950 dark:text-white">
                  TechTrack
                </div>
                <div className="text-xs text-slate-500">
                  Gestao de suporte TI
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none sm:p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
                Entrar no sistema
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                Use suas credenciais para acessar a operacao do TechTrack.
              </p>
            </div>

            <form className="space-y-4" onSubmit={submit}>
              <Field
                label="Usuario"
                required
                error={form.formState.errors.username?.message}
              >
                <Input
                  aria-invalid={Boolean(form.formState.errors.username)}
                  autoComplete="username"
                  autoFocus
                  {...form.register("username")}
                />
              </Field>
              <Field
                label="Senha"
                required
                error={form.formState.errors.password?.message}
              >
                <Input
                  aria-invalid={Boolean(form.formState.errors.password)}
                  autoComplete="current-password"
                  type="password"
                  {...form.register("password")}
                />
              </Field>
              {form.formState.errors.root ? (
                <Notice tone="danger">
                  {form.formState.errors.root.message}
                </Notice>
              ) : null}
              <Button
                className="mt-2 w-full"
                disabled={form.formState.isSubmitting}
                size="lg"
                type="submit"
              >
                {form.formState.isSubmitting ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
