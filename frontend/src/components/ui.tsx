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
        "inline-flex items-center justify-center gap-2 rounded-[var(--tt-radius-sm)] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tt-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--tt-bg)] disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" && "px-2.5 py-1.5 text-xs",
        size === "md" && "px-3.5 py-2 text-sm",
        size === "lg" && "px-4 py-2.5 text-sm",
        variant === "primary" &&
          "bg-[var(--tt-brand)] text-[var(--tt-brand-contrast)] shadow-sm hover:bg-[var(--tt-brand-hover)]",
        variant === "secondary" &&
          "border border-[var(--tt-border-strong)] bg-[var(--tt-surface)] text-[var(--tt-text)] shadow-sm hover:bg-[var(--tt-surface-subtle)]",
        variant === "danger" &&
          "bg-red-600 text-white shadow-sm hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500",
        variant === "ghost" &&
          "text-[var(--tt-text-muted)] hover:bg-[var(--tt-surface-subtle)] hover:text-[var(--tt-text)]",
        className,
      )}
      {...props}
    />
  );
}

const controlClass =
  "w-full rounded-[var(--tt-radius-sm)] border border-[var(--tt-border-strong)] bg-[var(--tt-surface)] px-3 py-2 text-sm text-[var(--tt-text)] shadow-sm transition placeholder:text-[var(--tt-text-subtle)] focus:border-[var(--tt-brand)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--tt-brand)_20%,transparent)] aria-[invalid=true]:border-[var(--tt-danger)] aria-[invalid=true]:ring-[color-mix(in_srgb,var(--tt-danger)_15%,transparent)]";

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
    <label className="block space-y-1.5 text-sm font-medium text-[var(--tt-text)]">
      <span>
        {label}
        {required ? (
          <span className="ml-1 text-[var(--tt-danger)]">*</span>
        ) : null}
      </span>
      {children}
      {error ? (
        <span className="block text-xs font-normal text-[var(--tt-danger)]">
          {error}
        </span>
      ) : hint ? (
        <span className="block text-xs font-normal text-[var(--tt-text-muted)]">
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
          "bg-[var(--tt-danger-soft)] text-[var(--tt-danger)]",
        tone === "success" &&
          "bg-[var(--tt-success-soft)] text-[var(--tt-success)]",
        tone === "warning" &&
          "bg-[var(--tt-warning-soft)] text-[var(--tt-warning)]",
        tone === "info" && "bg-[var(--tt-brand-soft)] text-[var(--tt-brand)]",
        tone === "neutral" &&
          "bg-[var(--tt-surface-subtle)] text-[var(--tt-text-muted)]",
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
        "rounded-[var(--tt-radius-md)] border border-[var(--tt-border)] bg-[var(--tt-surface)] p-4 shadow-[var(--tt-shadow-sm)] sm:p-5",
        className,
      )}
    >
      {title || action ? (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title ? (
              <h2 className="text-base font-semibold text-[var(--tt-text)]">
                {title}
              </h2>
            ) : null}
            {subtitle ? (
              <p className="mt-1 text-sm text-[var(--tt-text-muted)]">
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
    <div className="rounded-[var(--tt-radius-md)] border border-[var(--tt-border)] bg-[var(--tt-surface)] p-4 shadow-[var(--tt-shadow-sm)]">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-medium text-[var(--tt-text-muted)]">
          {label}
        </div>
        {icon ? (
          <div
            className={clsx(
              "rounded-[var(--tt-radius-sm)] p-2",
              tone === "danger" &&
                "bg-[var(--tt-danger-soft)] text-[var(--tt-danger)]",
              tone === "success" &&
                "bg-[var(--tt-success-soft)] text-[var(--tt-success)]",
              tone === "warning" &&
                "bg-[var(--tt-warning-soft)] text-[var(--tt-warning)]",
              tone === "info" &&
                "bg-[var(--tt-brand-soft)] text-[var(--tt-brand)]",
              tone === "neutral" &&
                "bg-[var(--tt-surface-subtle)] text-[var(--tt-text-muted)]",
            )}
          >
            {icon}
          </div>
        ) : null}
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-[var(--tt-text)]">
        {value}
      </div>
      {hint ? (
        <div className="mt-1 text-xs text-[var(--tt-text-muted)]">{hint}</div>
      ) : null}
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
        "rounded-[var(--tt-radius-sm)] border px-3 py-2.5 text-sm",
        tone === "info" &&
          "border-[color-mix(in_srgb,var(--tt-brand)_28%,var(--tt-border))] bg-[var(--tt-brand-soft)] text-[var(--tt-brand)]",
        tone === "success" &&
          "border-[color-mix(in_srgb,var(--tt-success)_28%,var(--tt-border))] bg-[var(--tt-success-soft)] text-[var(--tt-success)]",
        tone === "warning" &&
          "border-[color-mix(in_srgb,var(--tt-warning)_28%,var(--tt-border))] bg-[var(--tt-warning-soft)] text-[var(--tt-warning)]",
        tone === "danger" &&
          "border-[color-mix(in_srgb,var(--tt-danger)_28%,var(--tt-border))] bg-[var(--tt-danger-soft)] text-[var(--tt-danger)]",
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
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--tt-text-muted)]">
            {item.label}
          </dt>
          <dd className="mt-1 text-[var(--tt-text)]">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
