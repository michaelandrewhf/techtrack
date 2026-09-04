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
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
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
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {column.header}
                    </dt>
                    <dd className="min-w-0 break-words text-right text-slate-800 dark:text-slate-100">
                      {column.cell(row)}
                    </dd>
                  </div>
                ))}
            </dl>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:block">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
          <thead className="bg-slate-50/80 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950/70 dark:text-slate-400">
            <tr>
              {columns.map((column) => (
                <th className="px-4 py-3 font-semibold" key={column.header}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((row, index) => (
              <tr
                className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
                key={getRowKey?.(row, index) ?? index}
              >
                {columns.map((column) => (
                  <td
                    className="px-4 py-3 align-middle text-slate-700 dark:text-slate-200"
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
