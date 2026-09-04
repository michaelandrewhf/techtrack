import { AlertCircle, Loader2 } from "lucide-react";

export function PageLoader({ label = "Carregando" }: { label?: string }) {
  return (
    <div className="flex min-h-60 items-center justify-center text-slate-600 dark:text-slate-300">
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
    <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
      <div className="flex items-center gap-2 font-medium">
        <AlertCircle className="h-5 w-5" aria-hidden="true" />
        {message}
      </div>
      {onRetry ? (
        <button
          className="mt-3 rounded-md bg-red-700 px-3 py-2 text-sm text-white"
          type="button"
          onClick={onRetry}
        >
          Tentar novamente
        </button>
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
    <div className="rounded-md border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
      <p className="text-sm text-slate-600 dark:text-slate-300">{title}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
