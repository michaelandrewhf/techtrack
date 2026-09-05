import { Button } from "./ui";

export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Confirmar",
  onConfirm,
  children,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  children: React.ReactNode;
}) {
  return (
    <details className="relative inline-block">
      <summary className="list-none">{children}</summary>
      <div className="absolute right-0 z-20 mt-2 w-80 rounded-[var(--tt-radius-md)] border border-[var(--tt-border)] bg-[var(--tt-surface)] p-4 shadow-[var(--tt-shadow-md)]">
        <h3 className="font-semibold text-[var(--tt-text)]">{title}</h3>
        <p className="mt-1 text-sm text-[var(--tt-text-muted)]">
          {description}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="danger" type="button" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </details>
  );
}
