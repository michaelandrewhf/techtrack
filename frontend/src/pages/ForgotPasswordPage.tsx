import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Mail, Wrench } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";

import { requestPasswordReset } from "../api/passwordReset";
import { Button, Field, Input, Notice } from "../components/ui";
import { errorMessage } from "../utils/errors";

const schema = z.object({
  email: z.string().min(1, "Informe o e-mail.").email("Informe um e-mail valido."),
});

type FormData = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const [successMessage, setSuccessMessage] = useState("");
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const submit = form.handleSubmit(async ({ email }) => {
    try {
      const response = await requestPasswordReset(email);
      setSuccessMessage(response.message);
      form.clearErrors();
    } catch (error) {
      form.setError("root", { message: errorMessage(error) });
    }
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5 dark:bg-slate-950 sm:p-8">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
            <Wrench className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold text-slate-950 dark:text-white">
              TechTrack
            </div>
            <div className="text-xs text-slate-500">Gestao de suporte TI</div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none sm:p-8">
          <div className="mb-6">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
              <Mail className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
              Recuperar senha
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Informe o e-mail cadastrado. Se a conta estiver ativa, enviaremos
              um link seguro para redefinir a senha.
            </p>
          </div>

          {successMessage ? (
            <div className="space-y-4">
              <Notice tone="success">{successMessage}</Notice>
              <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                Verifique tambem a pasta de spam. O sistema nao informa se o
                e-mail esta ou nao cadastrado.
              </p>
              <Link
                className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                to="/login"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar para o login
              </Link>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={submit}>
              <Field
                label="E-mail"
                required
                error={form.formState.errors.email?.message}
              >
                <Input
                  aria-invalid={Boolean(form.formState.errors.email)}
                  autoComplete="email"
                  autoFocus
                  type="email"
                  {...form.register("email")}
                />
              </Field>
              {form.formState.errors.root ? (
                <Notice tone="danger">
                  {form.formState.errors.root.message}
                </Notice>
              ) : null}
              <Button
                className="w-full"
                disabled={form.formState.isSubmitting}
                size="lg"
                type="submit"
              >
                {form.formState.isSubmitting
                  ? "Enviando..."
                  : "Enviar link de recuperacao"}
              </Button>
              <Link
                className="flex items-center justify-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
                to="/login"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar para o login
              </Link>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
