import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";

import { Button } from "./ui";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function Modal({
  open,
  title,
  description,
  children,
  onClose,
  size = "md",
}: {
  open: boolean;
  title: string;
  description?: string;
  children: React.ReactNode;
  onClose: () => void;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;

    const dialog = dialogRef.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusable = dialog?.querySelector<HTMLElement>(focusableSelector);
    (focusable ?? dialog)?.focus();

    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;

      const elements = Array.from(
        dialog.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => element.getAttribute("aria-hidden") !== "true");

      if (!elements.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const width = {
    sm: "max-w-md",
    md: "max-w-xl",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  }[size];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--tt-overlay)] p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        ref={dialogRef}
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-[var(--tt-radius-lg)] border border-[var(--tt-border)] bg-[var(--tt-surface)] shadow-[var(--tt-shadow-md)] sm:rounded-[var(--tt-radius-lg)] ${width}`}
        role="dialog"
        tabIndex={-1}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--tt-border)] bg-[var(--tt-surface)] px-5 py-4">
          <div>
            <h2
              className="text-lg font-semibold text-[var(--tt-text)]"
              id={titleId}
            >
              {title}
            </h2>
            {description ? (
              <p
                className="mt-1 text-sm text-[var(--tt-text-muted)]"
                id={descriptionId}
              >
                {description}
              </p>
            ) : null}
          </div>
          <Button
            aria-label="Fechar"
            size="sm"
            type="button"
            variant="ghost"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-5">{children}</div>
      </section>
    </div>
  );
}
