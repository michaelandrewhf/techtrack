import clsx from "clsx";

export type TabItem = {
  id: string;
  label: string;
  count?: number;
};

export function Tabs({
  items,
  value,
  onChange,
}: {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="overflow-x-auto border-b border-[var(--tt-border)]">
      <div className="flex min-w-max gap-1" role="tablist">
        {items.map((item) => {
          const active = item.id === value;
          return (
            <button
              aria-selected={active}
              className={clsx(
                "border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "border-[var(--tt-brand)] text-[var(--tt-brand)]"
                  : "border-transparent text-[var(--tt-text-muted)] hover:border-[var(--tt-border-strong)] hover:text-[var(--tt-text)]",
              )}
              key={item.id}
              role="tab"
              type="button"
              onClick={() => onChange(item.id)}
            >
              {item.label}
              {item.count !== undefined ? (
                <span className="ml-2 rounded-full bg-[var(--tt-surface-subtle)] px-2 py-0.5 text-xs text-[var(--tt-text-muted)]">
                  {item.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
