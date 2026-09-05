import { Button } from "./ui";

export function Pagination({
  page,
  count,
  pageSize = 25,
  onPageChange,
}: {
  page: number;
  count: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  return (
    <div className="flex items-center justify-between gap-3 text-sm text-[var(--tt-text-muted)]">
      <span>
        Pagina {page} de {totalPages}
      </span>
      <div className="flex gap-2">
        <Button
          disabled={page <= 1}
          variant="secondary"
          type="button"
          onClick={() => onPageChange(page - 1)}
        >
          Anterior
        </Button>
        <Button
          disabled={page >= totalPages}
          variant="secondary"
          type="button"
          onClick={() => onPageChange(page + 1)}
        >
          Proxima
        </Button>
      </div>
    </div>
  );
}
