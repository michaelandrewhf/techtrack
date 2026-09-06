import { ChevronDown, Plus } from "lucide-react";
import {
  type ComponentType,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";

import { Button } from "./ui";

export type QuickCreateItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

export function QuickCreateMenu({ items }: { items: QuickCreateItem[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const trigger = () =>
    rootRef.current?.querySelector<HTMLButtonElement>("[aria-haspopup='menu']");

  const menuItems = () =>
    Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>("[role='menuitem']") ?? [],
    );

  const focusItem = (index: number) => {
    const options = menuItems();
    if (!options.length) return;
    options[(index + options.length) % options.length]?.focus();
  };

  const openAndFocus = (index: number) => {
    setOpen(true);
    window.setTimeout(() => focusItem(index), 0);
  };

  const closeAndRestoreFocus = () => {
    setOpen(false);
    window.setTimeout(() => trigger()?.focus(), 0);
  };

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target)) setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const options = menuItems();
    const index = options.indexOf(document.activeElement as HTMLElement);

    if (event.key === "Escape") {
      event.preventDefault();
      closeAndRestoreFocus();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      focusItem(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusItem(index <= 0 ? options.length - 1 : index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusItem(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusItem(options.length - 1);
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={rootRef}>
      <Button
        aria-controls="quick-create-menu"
        aria-expanded={open}
        aria-haspopup="menu"
        type="button"
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            openAndFocus(0);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            openAndFocus(items.length - 1);
          } else if (event.key === "Escape" && open) {
            event.preventDefault();
            closeAndRestoreFocus();
          }
        }}
      >
        <Plus className="h-4 w-4" />
        Novo
        <ChevronDown className="h-3.5 w-3.5" />
      </Button>

      {open ? (
        <div
          className="absolute left-0 top-11 z-50 w-52 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[var(--shadow-md)]"
          id="quick-create-menu"
          ref={menuRef}
          role="menu"
          onKeyDown={handleMenuKeyDown}
        >
          {items.map((item) => (
            <Link
              className="flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--text)] outline-none hover:bg-[var(--surface-subtle)] focus:bg-[var(--primary-soft)] focus:text-[var(--primary-soft-text)]"
              key={item.to}
              role="menuitem"
              tabIndex={-1}
              to={item.to}
              onClick={() => setOpen(false)}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
