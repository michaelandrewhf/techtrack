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
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] font-medium transition-[background-color,border-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-bg)] disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" && "min-h-8 px-2.5 py-1.5 text-xs",
        size === "md" && "min-h-10 px-3.5 py-2 text-sm",
        size === "lg" && "min-h-11 px-4 py-2.5 text-sm",
        variant === "primary" &&
          "bg-[var(--primary)] text-white shadow-[var(--shadow-sm)] hover:bg-[var(--primary-hover)]",
        variant === "secondary" &&
          "border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-sm)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-subtle)]",
        variant === "danger" &&
          "bg-[var(--danger)] text-white shadow-[var(--shadow-sm)] hover:brightness-95",
        variant === "ghost" &&
          "text-[var(--text-muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text)]",
        className,
      )}
      {...props}
    />
  );
}

const controlClass =
  "w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] shadow-[var(--shadow-sm)] transition-[border-color,box-shadow,background-color] placeholder:text-[var(--text-subtle)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary)_18%,transparent)] aria-[invalid=true]:border-[var(--danger)] aria-[invalid=true]:ring-[color-mix(in_srgb,var(--danger)_14%,transparent)]";

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
    <label className="block space-y-1.5 text-sm font-medium text-[var(--text)]">
      <span>
        {label}
        {required ? (
          <span className="ml-1 text-[var(--danger)]" aria-hidden="true">
            *
          </span>
        ) : null}
      </span>
      {children}
      {error ? (
        <span
          className="block text-xs font-normal text-[var(--danger)]"
          role="alert"
        >
          {error}
        </span>
      ) : hint ? (
        <span className="block text-xs font-normal text-[var(--text-muted)]">
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
          "bg-[var(--danger-soft)] text-[var(--danger)]",
        tone === "success" &&
          "bg-[var(--success-soft)] text-[var(--success)]",
        tone === "warning" &&
          "bg-[var(--warning-soft)] text-[var(--warning)]",
        tone === "info" && "bg-[var(--info-soft)] text-[var(--info)]",
        tone === "neutral" &&
          "bg-[var(--surface-subtle)] text-[var(--text-muted)]",
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
        "rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] sm:p-5",
        className,
      )}
    >
      {title || action ? (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title ? (
              <h2 className="text-base font-semibold text-[var(--text)]">
                {title}
              </h2>
            ) : null}
            {subtitle ? (
              <p className="mt-1 text-sm text-[var(--text-muted)]">
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
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-medium text-[var(--text-muted)]">
          {label}
        </div>
        {icon ? (
          <div
            className={clsx(
              "rounded-[var(--radius-md)] p-2",
              tone === "danger" &&
                "bg-[var(--danger-soft)] text-[var(--danger)]",
              tone === "success" &&
                "bg-[var(--success-soft)] text-[var(--success)]",
              tone === "warning" &&
                "bg-[var(--warning-soft)] text-[var(--warning)]",
              tone === "info" &&
                "bg-[var(--info-soft)] text-[var(--info)]",
              tone === "neutral" &&
                "bg-[var(--surface-subtle)] text-[var(--text-muted)]",
            )}
          >
            {icon}
          </div>
        ) : null}
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-[var(--text)]">
        {value}
      </div>
      {hint ? (
        <div className="mt-1 text-xs text-[var(--text-muted)]">{hint}</div>
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
        "rounded-[var(--radius-md)] border px-3 py-2.5 text-sm",
        tone === "info" &&
          "border-[color-mix(in_srgb,var(--info)_28%,var(--border))] bg-[var(--info-soft)] text-[var(--info)]",
        tone === "success" &&
          "border-[color-mix(in_srgb,var(--success)_28%,var(--border))] bg-[var(--success-soft)] text-[var(--success)]",
        tone === "warning" &&
          "border-[color-mix(in_srgb,var(--warning)_28%,var(--border))] bg-[var(--warning-soft)] text-[var(--warning)]",
        tone === "danger" &&
          "border-[color-mix(in_srgb,var(--danger)_28%,var(--border))] bg-[var(--danger-soft)] text-[var(--danger)]",
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
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
            {item.label}
          </dt>
          <dd className="mt-1 text-[var(--text)]">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
