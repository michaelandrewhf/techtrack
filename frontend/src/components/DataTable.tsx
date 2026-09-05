import { EmptyState } from "./State";

type Column<T> = {
  header: string;
  cell: (row: T) => React.ReactNode;
  hideOnMobile?: boolean;
};

export function DataTable<T>({
  rows,
  columns,
  empty,
  getRowKey,
}: {
  rows: T[];
  columns: Column<T>[];
  empty: string;
  getRowKey?: (row: T, index: number) => React.Key;
}) {
  if (!rows.length) return <EmptyState title={empty} />;

  return (
    <>
      <div className="space-y-3 md:hidden">
        {rows.map((row, index) => (
          <article
            className="rounded-[var(--tt-radius-md)] border border-[var(--tt-border)] bg-[var(--tt-surface)] p-4 shadow-[var(--tt-shadow-sm)]"
            key={getRowKey?.(row, index) ?? index}
          >
            <dl className="space-y-3">
              {columns
                .filter((column) => !column.hideOnMobile)
                .map((column) => (
                  <div
                    className="grid grid-cols-[110px_1fr] items-start gap-3 text-sm"
                    key={column.header}
                  >
                    <dt className="text-xs font-medium uppercase tracking-wide text-[var(--tt-text-muted)]">
                      {column.header}
                    </dt>
                    <dd className="min-w-0 break-words text-right text-[var(--tt-text)]">
                      {column.cell(row)}
                    </dd>
                  </div>
                ))}
            </dl>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-[var(--tt-radius-md)] border border-[var(--tt-border)] bg-[var(--tt-surface)] md:block">
        <table className="min-w-full divide-y divide-[var(--tt-border)] text-sm">
          <thead className="bg-[var(--tt-surface-subtle)] text-left text-xs uppercase tracking-wide text-[var(--tt-text-muted)]">
            <tr>
              {columns.map((column) => (
                <th className="px-4 py-3 font-semibold" key={column.header}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--tt-border)]">
            {rows.map((row, index) => (
              <tr
                className="transition-colors hover:bg-[var(--tt-surface-subtle)]"
                key={getRowKey?.(row, index) ?? index}
              >
                {columns.map((column) => (
                  <td
                    className="px-4 py-3 align-middle text-[var(--tt-text)]"
                    key={column.header}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
