import { ArrowLeft, LayoutDashboard, SearchX } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { Button, Panel } from "../components/ui";

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--tt-bg)] p-4 text-[var(--tt-text)]">
      <Panel className="w-full max-w-xl p-6 text-center sm:p-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[var(--tt-radius-md)] bg-[var(--tt-brand-soft)] text-[var(--tt-brand)]">
          <SearchX className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--tt-brand)]">
          Erro 404
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Pagina nao encontrada
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--tt-text-muted)]">
          O endereco pode estar incorreto ou o recurso pode ter sido movido.
          Volte para a pagina anterior ou acesse a central de trabalho.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <Link to="/">
            <Button className="w-full sm:w-auto" type="button">
              <LayoutDashboard className="h-4 w-4" />
              Ir para o inicio
            </Button>
          </Link>
        </div>
      </Panel>
    </main>
  );
}
