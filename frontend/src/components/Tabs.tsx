import clsx from "clsx";
import {
  type KeyboardEvent,
  type ReactNode,
  useId,
  useRef,
} from "react";

export type TabItem = {
  id: string;
  label: string;
  count?: number;
};

function tabDomId(groupId: string, itemId: string) {
  return `${groupId}-tab-${itemId}`;
}

function panelDomId(groupId: string, itemId: string) {
  return `${groupId}-panel-${itemId}`;
}

export function Tabs({
  id,
  items,
  value,
  onChange,
}: {
  id?: string;
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
}) {
  const generatedId = useId();
  const groupId = id ?? `tabs-${generatedId.replaceAll(":", "")}`;
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const moveTo = (index: number) => {
    const item = items[index];
    if (!item) return;
    onChange(item.id);
    window.setTimeout(() => refs.current[index]?.focus(), 0);
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveTo((index + 1) % items.length);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveTo((index - 1 + items.length) % items.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      moveTo(0);
    } else if (event.key === "End") {
      event.preventDefault();
      moveTo(items.length - 1);
    }
  };

  return (
    <div className="overflow-x-auto border-b border-[var(--border)]">
      <div
        aria-orientation="horizontal"
        className="flex min-w-max gap-1"
        role="tablist"
      >
        {items.map((item, index) => {
          const active = item.id === value;
          return (
            <button
              aria-controls={panelDomId(groupId, item.id)}
              aria-selected={active}
              className={clsx(
                "border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text)]",
              )}
              id={tabDomId(groupId, item.id)}
              key={item.id}
              ref={(node) => {
                refs.current[index] = node;
              }}
              role="tab"
              tabIndex={active ? 0 : -1}
              type="button"
              onClick={() => onChange(item.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              {item.label}
              {item.count !== undefined ? (
                <span className="ml-2 rounded-full bg-[var(--surface-subtle)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
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

export function TabPanel({
  tabsId,
  tabId,
  className,
  children,
}: {
  tabsId: string;
  tabId: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      aria-labelledby={tabDomId(tabsId, tabId)}
      className={className}
      id={panelDomId(tabsId, tabId)}
      role="tabpanel"
      tabIndex={0}
    >
      {children}
    </div>
  );
}
