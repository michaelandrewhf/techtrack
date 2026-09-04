import clsx from "clsx";

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
}) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-slate-950",
        size === "sm" && "px-2.5 py-1.5 text-xs",
        size === "md" && "px-3.5 py-2 text-sm",
        size === "lg" && "px-4 py-2.5 text-sm",
        variant === "primary" &&
          "bg-blue-600 text-white shadow-sm hover:bg-blue-700",
        variant === "secondary" &&
          "border border-slate-300 bg-white text-slate-800 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800",
        variant === "danger" &&
          "bg-red-600 text-white shadow-sm hover:bg-red-700",
        variant === "ghost" &&
          "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white",
        className,
      )}
      {...props}
    />
  );
}

const controlClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 aria-[invalid=true]:border-red-500 aria-[invalid=true]:ring-red-500/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx(controlClass, className)} {...props} />;
}

export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={clsx(controlClass, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={clsx(controlClass, "min-h-24 resize-y", className)}
      {...props}
    />
  );
}

export function Field({
  label,
  children,
  hint,
  error,
  required,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  error?: string;
  required?: boolean;
}) {
  return (
    <label className="block space-y-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
      <span>
        {label}
        {required ? <span className="ml-1 text-red-500">*</span> : null}
      </span>
      {children}
      {error ? (
        <span className="block text-xs font-normal text-red-600 dark:text-red-400">
          {error}
        </span>
      ) : hint ? (
        <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        tone === "danger" &&
          "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
        tone === "success" &&
          "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
        tone === "warning" &&
          "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
        tone === "info" &&
          "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
        tone === "neutral" &&
          "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Panel({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={clsx(
        "rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5",
        className,
      )}
    >
      {title || action ? (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title ? (
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">
                {title}
              </h2>
            ) : null}
            {subtitle ? (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {subtitle}
              </p>
            ) : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  tone?: "neutral" | "danger" | "success" | "warning" | "info";
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
          {label}
        </div>
        {icon ? (
          <div
            className={clsx(
              "rounded-lg p-2",
              tone === "danger" && "bg-red-50 text-red-600 dark:bg-red-950",
              tone === "success" &&
                "bg-emerald-50 text-emerald-600 dark:bg-emerald-950",
              tone === "warning" &&
                "bg-amber-50 text-amber-600 dark:bg-amber-950",
              tone === "info" && "bg-blue-50 text-blue-600 dark:bg-blue-950",
              tone === "neutral" &&
                "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
            )}
          >
            {icon}
          </div>
        ) : null}
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

export function Notice({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "success" | "warning" | "danger";
}) {
  return (
    <div
      className={clsx(
        "rounded-lg border px-3 py-2.5 text-sm",
        tone === "info" &&
          "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200",
        tone === "success" &&
          "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
        tone === "warning" &&
          "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
        tone === "danger" &&
          "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200",
      )}
    >
      {children}
    </div>
  );
}

export function DescriptionList({
  items,
}: {
  items: Array<{ label: string; value: React.ReactNode }>;
}) {
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {item.label}
          </dt>
          <dd className="mt-1 text-slate-800 dark:text-slate-100">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
