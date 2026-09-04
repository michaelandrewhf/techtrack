import { zodResolver } from "@hookform/resolvers/zod";
import { Wrench } from "lucide-react";
import { useForm } from "react-hook-form";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";

import { useAuth } from "../auth/AuthProvider";
import { Button, Field, Input } from "../components/ui";
import { errorMessage } from "../utils/errors";

const loginSchema = z.object({
  username: z.string().min(1, "Informe o usuario."),
  password: z.string().min(1, "Informe a senha."),
});

type LoginForm = z.infer<typeof loginSchema>;

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
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4 dark:bg-slate-950">
      <section className="w-full max-w-md rounded-md border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-md bg-blue-600 p-2 text-white">
            <Wrench className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-950 dark:text-white">
              TechTrack
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Acesso ao painel tecnico
            </p>
          </div>
        </div>
        <form className="space-y-4" onSubmit={submit}>
          <Field label="Usuario">
            <Input autoComplete="username" {...form.register("username")} />
          </Field>
          <Field label="Senha">
            <Input
              autoComplete="current-password"
              type="password"
              {...form.register("password")}
            />
          </Field>
          {form.formState.errors.root ? (
            <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-100">
              {form.formState.errors.root.message}
            </p>
          ) : null}
          <Button
            className="w-full"
            disabled={form.formState.isSubmitting}
            type="submit"
          >
            Entrar
          </Button>
        </form>
      </section>
    </main>
  );
}
