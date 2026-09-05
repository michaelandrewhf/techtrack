export function PageHeader({
  title,
  description,
  eyebrow,
  meta,
  action,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  meta?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">
            {eyebrow}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="truncate text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-3xl">
            {title}
          </h1>
          {meta}
        </div>
        {description ? (
          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {action ? (
        <div className="flex shrink-0 flex-wrap gap-2">{action}</div>
      ) : null}
    </div>
  );
}
