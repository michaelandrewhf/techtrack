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
    <div className="overflow-x-auto border-b border-slate-200 dark:border-slate-800">
      <div className="flex min-w-max gap-1" role="tablist">
        {items.map((item) => {
          const active = item.id === value;
          return (
            <button
              aria-selected={active}
              className={clsx(
                "border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "border-blue-600 text-blue-700 dark:text-blue-300"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100",
              )}
              key={item.id}
              role="tab"
              type="button"
              onClick={() => onChange(item.id)}
            >
              {item.label}
              {item.count !== undefined ? (
                <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
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
