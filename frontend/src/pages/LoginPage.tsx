import { zodResolver } from "@hookform/resolvers/zod";
import {
  CheckCircle2,
  ClipboardList,
  Eye,
  EyeOff,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";

import { useAuth } from "../auth/AuthProvider";
import { Button, Field, Input, Notice } from "../components/ui";
import { errorMessage } from "../utils/errors";

const REMEMBERED_USERNAME_KEY = "techtrack.rememberedUsername";

const loginSchema = z.object({
  username: z.string().min(1, "Informe o usuario."),
  password: z.string().min(1, "Informe a senha."),
  rememberUsername: z.boolean(),
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
  const [showPassword, setShowPassword] = useState(false);
  const [showRecoveryInfo, setShowRecoveryInfo] = useState(false);
  const rememberedUsername = localStorage.getItem(REMEMBERED_USERNAME_KEY) ?? "";
  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: rememberedUsername,
      password: "",
      rememberUsername: Boolean(rememberedUsername),
    },
  });
  const from =
    (location.state as { from?: Location } | null)?.from?.pathname ?? "/";

  if (auth.isAuthenticated) return <Navigate to="/" replace />;

  const submit = form.handleSubmit(async (data) => {
    try {
      await auth.login(data.username, data.password);
      if (data.rememberUsername) {
        localStorage.setItem(REMEMBERED_USERNAME_KEY, data.username);
      } else {
        localStorage.removeItem(REMEMBERED_USERNAME_KEY);
      }
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
                  autoFocus={!rememberedUsername}
                  {...form.register("username")}
                />
              </Field>
              <Field
                label="Senha"
                required
                error={form.formState.errors.password?.message}
              >
                <div className="relative">
                  <Input
                    aria-invalid={Boolean(form.formState.errors.password)}
                    autoComplete="current-password"
                    className="pr-11"
                    type={showPassword ? "text" : "password"}
                    {...form.register("password")}
                  />
                  <button
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </Field>

              <div className="flex items-center justify-between gap-3 text-sm">
                <label className="flex cursor-pointer items-center gap-2 text-slate-600 dark:text-slate-300">
                  <input
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    type="checkbox"
                    {...form.register("rememberUsername")}
                  />
                  Lembrar meu usuario
                </label>
                <button
                  className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  type="button"
                  onClick={() => setShowRecoveryInfo(true)}
                >
                  Esqueci minha senha
                </button>
              </div>

              {showRecoveryInfo ? (
                <Notice>
                  A recuperacao de senha sera disponibilizada em uma proxima
                  etapa. O atalho ja esta reservado na tela de login.
                </Notice>
              ) : null}
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
