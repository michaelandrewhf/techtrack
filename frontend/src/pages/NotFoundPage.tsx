import { ArrowLeft, Home, SearchX } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { Button, Panel } from "../components/ui";

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto flex min-h-[65vh] max-w-2xl items-center">
      <Panel className="w-full">
        <div className="flex flex-col items-center px-4 py-10 text-center sm:px-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--primary-soft)] text-[var(--primary-soft-text)]">
            <SearchX className="h-7 w-7" aria-hidden="true" />
          </div>
          <div className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">
            Erro 404
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-3xl">
            Pagina nao encontrada
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-6 text-[var(--text-muted)]">
            O endereco pode ter mudado, sido removido ou estar incorreto. Use
            uma das opcoes abaixo para continuar no TechTrack.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-2">
            <Link to="/">
              <Button type="button">
                <Home className="h-4 w-4" aria-hidden="true" />
                Voltar ao inicio
              </Button>
            </Link>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Voltar
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
