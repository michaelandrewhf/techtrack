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
            className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]"
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
                    <dt className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                      {column.header}
                    </dt>
                    <dd className="min-w-0 break-words text-right text-[var(--text)]">
                      {column.cell(row)}
                    </dd>
                  </div>
                ))}
            </dl>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] md:block">
        <table className="min-w-full divide-y divide-[var(--border)] text-sm">
          <thead className="bg-[var(--surface-subtle)] text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
            <tr>
              {columns.map((column) => (
                <th className="px-4 py-3 font-semibold" key={column.header}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.map((row, index) => (
              <tr
                className="transition-colors hover:bg-[var(--surface-subtle)]"
                key={getRowKey?.(row, index) ?? index}
              >
                {columns.map((column) => (
                  <td
                    className="px-4 py-3 align-middle text-[var(--text)]"
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
