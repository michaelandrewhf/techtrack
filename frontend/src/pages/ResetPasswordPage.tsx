import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, KeyRound, Wrench } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";

import { confirmPasswordReset } from "../api/passwordReset";
import { Button, Field, Input, Notice } from "../components/ui";
import { errorMessage } from "../utils/errors";

const schema = z
  .object({
    newPassword: z.string().min(1, "Informe a nova senha."),
    confirmPassword: z.string().min(1, "Confirme a nova senha."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas informadas nao coincidem.",
  });

type FormData = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const { uid, token } = useParams();
  const navigate = useNavigate();
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const invalidLink = !uid || !token;

  const submit = form.handleSubmit(async (data) => {
    if (!uid || !token) return;
    try {
      await confirmPasswordReset({
        uid,
        token,
        new_password: data.newPassword,
        confirm_password: data.confirmPassword,
      });
      navigate("/login", {
        replace: true,
        state: { passwordResetSuccess: true },
      });
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
              <KeyRound className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
              Cadastrar nova senha
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              A nova senha sera validada pelas mesmas regras de seguranca do
              Django usadas pelo TechTrack.
            </p>
          </div>

          {invalidLink ? (
            <div className="space-y-4">
              <Notice tone="danger">
                O link de redefinicao esta incompleto ou invalido.
              </Notice>
              <Link
                className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                to="/forgot-password"
              >
                Solicitar um novo link
              </Link>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={submit}>
              <Field
                label="Nova senha"
                required
                hint="Use uma senha forte e diferente das suas informacoes pessoais."
                error={form.formState.errors.newPassword?.message}
              >
                <div className="relative">
                  <Input
                    aria-invalid={Boolean(form.formState.errors.newPassword)}
                    autoComplete="new-password"
                    className="pr-11"
                    type={showNewPassword ? "text" : "password"}
                    {...form.register("newPassword")}
                  />
                  <button
                    aria-label={
                      showNewPassword ? "Ocultar nova senha" : "Mostrar nova senha"
                    }
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    type="button"
                    onClick={() => setShowNewPassword((value) => !value)}
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </Field>
              <Field
                label="Confirmar nova senha"
                required
                error={form.formState.errors.confirmPassword?.message}
              >
                <div className="relative">
                  <Input
                    aria-invalid={Boolean(
                      form.formState.errors.confirmPassword,
                    )}
                    autoComplete="new-password"
                    className="pr-11"
                    type={showConfirmation ? "text" : "password"}
                    {...form.register("confirmPassword")}
                  />
                  <button
                    aria-label={
                      showConfirmation
                        ? "Ocultar confirmacao de senha"
                        : "Mostrar confirmacao de senha"
                    }
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    type="button"
                    onClick={() => setShowConfirmation((value) => !value)}
                  >
                    {showConfirmation ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
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
                  ? "Redefinindo..."
                  : "Redefinir senha"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
