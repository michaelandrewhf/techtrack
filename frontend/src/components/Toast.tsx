import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

type ToastTone = "success" | "danger" | "info";

type ToastItem = {
  id: number;
  message: string;
  title: string;
  tone: ToastTone;
};

type ToastEvent =
  { type: "add"; toast: ToastItem } | { type: "remove"; id: number };

type Listener = (event: ToastEvent) => void;

const listeners = new Set<Listener>();
let nextToastId = 1;

function emit(event: ToastEvent) {
  listeners.forEach((listener) => listener(event));
}

function showToast(
  tone: ToastTone,
  message: string,
  title: string,
  duration = 4_500,
) {
  const id = nextToastId++;
  emit({ type: "add", toast: { id, message, title, tone } });
  window.setTimeout(() => emit({ type: "remove", id }), duration);
  return id;
}

export const toast = {
  success: (message: string, title = "Concluido") =>
    showToast("success", message, title),
  error: (message: string, title = "Nao foi possivel concluir") =>
    showToast("danger", message, title),
  info: (message: string, title = "Informacao") =>
    showToast("info", message, title),
  dismiss: (id: number) => emit({ type: "remove", id }),
};

function ToastIcon({ tone }: { tone: ToastTone }) {
  if (tone === "success") return <CheckCircle2 className="h-5 w-5" />;
  if (tone === "danger") return <AlertCircle className="h-5 w-5" />;
  return <Info className="h-5 w-5" />;
}

function toneClasses(tone: ToastTone) {
  if (tone === "success") return "text-[var(--success)]";
  if (tone === "danger") return "text-[var(--danger)]";
  return "text-[var(--info)]";
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const listener: Listener = (event) => {
      if (event.type === "add") {
        setItems((current) => [...current.slice(-3), event.toast]);
        return;
      }
      setItems((current) => current.filter((item) => item.id !== event.id));
    };

    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return (
    <>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions text"
        className="pointer-events-none fixed inset-x-3 bottom-3 z-[100] flex flex-col items-end gap-2 sm:left-auto sm:w-[380px]"
      >
        {items.map((item) => (
          <div
            className="pointer-events-auto flex w-full gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-lg)]"
            key={item.id}
          >
            <div className={`mt-0.5 shrink-0 ${toneClasses(item.tone)}`}>
              <ToastIcon tone={item.tone} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-[var(--text)]">
                {item.title}
              </div>
              <div className="mt-0.5 text-sm text-[var(--text-muted)]">
                {item.message}
              </div>
            </div>
            <button
              aria-label="Fechar notificacao"
              className="shrink-0 rounded-[var(--radius-sm)] p-1 text-[var(--text-subtle)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--text)]"
              type="button"
              onClick={() => toast.dismiss(item.id)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
