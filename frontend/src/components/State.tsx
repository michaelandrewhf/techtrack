import { AlertCircle, Loader2 } from "lucide-react";

import { Button } from "./ui";

export function PageLoader({ label = "Carregando" }: { label?: string }) {
  return (
    <div className="flex min-h-60 items-center justify-center text-[var(--tt-text-muted)]">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-[var(--tt-radius-sm)] border border-[color-mix(in_srgb,var(--tt-danger)_28%,var(--tt-border))] bg-[var(--tt-danger-soft)] p-4 text-[var(--tt-danger)]">
      <div className="flex items-center gap-2 font-medium">
        <AlertCircle className="h-5 w-5" aria-hidden="true" />
        {message}
      </div>
      {onRetry ? (
        <Button
          className="mt-3"
          type="button"
          variant="danger"
          onClick={onRetry}
        >
          Tentar novamente
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--tt-radius-md)] border border-dashed border-[var(--tt-border-strong)] bg-[var(--tt-surface-subtle)] p-8 text-center">
      <p className="text-sm text-[var(--tt-text-muted)]">{title}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
