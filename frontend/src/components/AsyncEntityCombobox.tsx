import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Loader2, Search, X } from "lucide-react";
import { useEffect, useId, useState } from "react";

export type AsyncEntityOption = {
  id: string;
  label: string;
  description?: string;
};

export function AsyncEntityCombobox({
  value,
  onChange,
  queryKey,
  loadOptions,
  loadValue,
  placeholder = "Selecione",
  searchPlaceholder = "Digite para buscar",
  emptyText = "Nenhum resultado encontrado.",
  disabled = false,
  allowClear = true,
  ariaInvalid = false,
}: {
  value: string;
  onChange: (value: string) => void;
  queryKey: readonly unknown[];
  loadOptions: (search: string) => Promise<AsyncEntityOption[]>;
  loadValue?: (id: string) => Promise<AsyncEntityOption>;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  allowClear?: boolean;
  ariaInvalid?: boolean;
}) {
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedSearch(inputValue.trim()),
      250,
    );
    return () => window.clearTimeout(timeout);
  }, [inputValue]);

  const options = useQuery({
    queryKey: [...queryKey, "options", debouncedSearch],
    queryFn: () => loadOptions(debouncedSearch),
    enabled: open && !disabled,
    staleTime: 30_000,
  });

  const selected = useQuery({
    queryKey: [...queryKey, "selected", value],
    queryFn: () => loadValue!(value),
    enabled: Boolean(value && loadValue),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!open) {
      setInputValue(value ? (selected.data?.label ?? "") : "");
    }
  }, [open, selected.data?.label, value]);

  const rows = options.data ?? [];

  function choose(option: AsyncEntityOption) {
    onChange(option.id);
    setInputValue(option.label);
    setOpen(false);
    setActiveIndex(-1);
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-subtle)]"
          aria-hidden="true"
        />
        <input
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={open}
          aria-invalid={ariaInvalid || undefined}
          aria-activedescendant={
            open && activeIndex >= 0
              ? `${listboxId}-option-${activeIndex}`
              : undefined
          }
          autoComplete="off"
          className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] py-2 pl-9 pr-16 text-sm text-[var(--text)] shadow-[var(--shadow-sm)] transition-[border-color,box-shadow,background-color] placeholder:text-[var(--text-subtle)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary)_18%,transparent)] disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-[var(--danger)]"
          disabled={disabled}
          placeholder={value ? placeholder : searchPlaceholder}
          role="combobox"
          value={inputValue}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onChange={(event) => {
            if (value) onChange("");
            setInputValue(event.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((index) =>
                Math.min(index + 1, Math.max(rows.length - 1, 0)),
              );
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((index) => Math.max(index - 1, 0));
            } else if (event.key === "Enter" && open && activeIndex >= 0) {
              event.preventDefault();
              const option = rows[activeIndex];
              if (option) choose(option);
            } else if (event.key === "Escape") {
              setOpen(false);
              setActiveIndex(-1);
            }
          }}
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {options.isFetching && open ? (
            <Loader2
              className="h-4 w-4 animate-spin text-[var(--text-subtle)]"
              aria-label="Buscando"
            />
          ) : null}
          {allowClear && value && !disabled ? (
            <button
              aria-label="Limpar selecao"
              className="rounded p-1 text-[var(--text-subtle)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text)]"
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange("");
                setInputValue("");
                setOpen(true);
              }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <ChevronDown
              className="h-4 w-4 text-[var(--text-subtle)]"
              aria-hidden="true"
            />
          )}
        </div>
      </div>

      {open && !disabled ? (
        <div
          className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-1 shadow-[var(--shadow-md)]"
          id={listboxId}
          role="listbox"
        >
          {options.isLoading ? (
            <div className="px-3 py-2 text-sm text-[var(--text-muted)]">
              Buscando...
            </div>
          ) : options.error ? (
            <div className="px-3 py-2 text-sm text-[var(--danger)]">
              Nao foi possivel carregar os resultados.
            </div>
          ) : rows.length ? (
            rows.map((option, index) => (
              <button
                aria-selected={option.id === value}
                className={`flex w-full items-start justify-between gap-3 rounded-[var(--radius-sm)] px-3 py-2 text-left text-sm transition-colors ${
                  activeIndex === index
                    ? "bg-[var(--primary-soft)] text-[var(--primary-soft-text)]"
                    : "text-[var(--text)] hover:bg-[var(--surface-subtle)]"
                }`}
                id={`${listboxId}-option-${index}`}
                key={option.id}
                role="option"
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(option)}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {option.label}
                  </span>
                  {option.description ? (
                    <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">
                      {option.description}
                    </span>
                  ) : null}
                </span>
                {option.id === value ? (
                  <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                ) : null}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-[var(--text-muted)]">
              {emptyText}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
