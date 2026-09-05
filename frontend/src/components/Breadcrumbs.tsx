import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

export function Breadcrumbs({
  items,
}: {
  items: Array<{ label: string; to?: string }>;
}) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 overflow-x-auto">
      <ol className="flex min-w-max items-center gap-1 text-xs text-[var(--tt-text-muted)]">
        {items.map((item, index) => (
          <li
            className="flex items-center gap-1"
            key={`${item.label}-${index}`}
          >
            {index ? (
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            ) : null}
            {item.to ? (
              <Link
                className="transition-colors hover:text-[var(--tt-text)]"
                to={item.to}
              >
                {item.label}
              </Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
