import {
  Boxes,
  ChevronDown,
  CircleUserRound,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Plus,
  Settings,
  Sun,
  Users,
  WalletCards,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { Button } from "../components/ui";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
};

const groups: Array<{ label?: string; items: NavItem[] }> = [
  {
    items: [{ to: "/", label: "Inicio", icon: LayoutDashboard, end: true }],
  },
  {
    label: "Clientes",
    items: [{ to: "/customers", label: "Clientes", icon: Users }],
  },
  {
    label: "Operacao",
    items: [
      { to: "/work-orders", label: "Ordens de Servico", icon: ClipboardList },
      { to: "/quotes", label: "Orcamentos", icon: FileText },
      { to: "/equipment", label: "Equipamentos", icon: Boxes },
    ],
  },
  {
    label: "Gestao",
    items: [{ to: "/finance", label: "Financeiro", icon: WalletCards }],
  },
];

const quickCreate: NavItem[] = [
  { to: "/customers?new=1", label: "Cliente", icon: Users },
  { to: "/equipment?new=1", label: "Equipamento", icon: Boxes },
  { to: "/work-orders/new", label: "Ordem de Servico", icon: ClipboardList },
  { to: "/quotes/new", label: "Orcamento", icon: FileText },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [dark, setDark] = useState(
    () => localStorage.getItem("techtrack.theme") === "dark",
  );
  const location = useLocation();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("techtrack.theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    setSidebarOpen(false);
    setCreateOpen(false);
  }, [location.pathname]);

  const displayName =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    user?.username ||
    "Usuario";

  return (
    <div className="min-h-screen bg-[var(--tt-bg)] text-[var(--tt-text)]">
      {sidebarOpen ? (
        <button
          aria-label="Fechar menu"
          className="fixed inset-0 z-30 bg-[var(--tt-overlay)] backdrop-blur-sm lg:hidden"
          type="button"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-[var(--tt-border)] bg-[var(--tt-surface)] transition-transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-[var(--tt-border)] px-5">
          <Link className="flex items-center gap-3" to="/">
            <div className="flex h-9 w-9 items-center justify-center rounded-[var(--tt-radius-md)] bg-[var(--tt-brand)] text-[var(--tt-brand-contrast)] shadow-sm">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold tracking-tight text-[var(--tt-text)]">
                TechTrack
              </div>
              <div className="text-xs text-[var(--tt-text-muted)]">
                Gestao de suporte TI
              </div>
            </div>
          </Link>
          <Button
            aria-label="Fechar menu"
            className="lg:hidden"
            size="sm"
            type="button"
            variant="ghost"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav
          className="flex-1 space-y-5 overflow-y-auto p-3"
          aria-label="Principal"
        >
          {groups.map((group, groupIndex) => (
            <div key={group.label ?? groupIndex}>
              {group.label ? (
                <div className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--tt-text-subtle)]">
                  {group.label}
                </div>
              ) : null}
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavLink
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-[var(--tt-radius-sm)] px-3 py-2.5 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-[var(--tt-brand-soft)] text-[var(--tt-brand)]"
                          : "text-[var(--tt-text-muted)] hover:bg-[var(--tt-surface-subtle)] hover:text-[var(--tt-text)]"
                      }`
                    }
                    end={item.end}
                    key={item.to}
                    to={item.to}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-[var(--tt-border)] p-3">
          <NavLink
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-[var(--tt-radius-sm)] px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[var(--tt-surface-subtle)] text-[var(--tt-text)]"
                  : "text-[var(--tt-text-muted)] hover:bg-[var(--tt-surface-subtle)] hover:text-[var(--tt-text)]"
              }`
            }
            to="/settings"
          >
            <Settings className="h-4 w-4" />
            Configuracoes
          </NavLink>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[var(--tt-border)] bg-[var(--tt-surface)] px-3 sm:px-5">
          <div className="flex items-center gap-2">
            <Button
              aria-label="Abrir menu"
              className="lg:hidden"
              size="sm"
              type="button"
              variant="ghost"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="relative">
              <Button
                aria-expanded={createOpen}
                aria-haspopup="menu"
                type="button"
                onClick={() => setCreateOpen((value) => !value)}
              >
                <Plus className="h-4 w-4" />
                Novo
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
              {createOpen ? (
                <div
                  className="absolute left-0 top-11 z-50 w-52 overflow-hidden rounded-[var(--tt-radius-md)] border border-[var(--tt-border)] bg-[var(--tt-surface)] p-1.5 shadow-[var(--tt-shadow-md)]"
                  role="menu"
                >
                  {quickCreate.map((item) => (
                    <Link
                      className="flex items-center gap-3 rounded-[var(--tt-radius-sm)] px-3 py-2 text-sm text-[var(--tt-text)] hover:bg-[var(--tt-surface-subtle)]"
                      key={item.to}
                      role="menuitem"
                      to={item.to}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              aria-label={dark ? "Usar tema claro" : "Usar tema escuro"}
              aria-pressed={dark}
              size="sm"
              type="button"
              variant="ghost"
              onClick={() => setDark((value) => !value)}
            >
              {dark ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
            <Link
              aria-label="Abrir meu perfil"
              className="flex items-center gap-2 rounded-[var(--tt-radius-sm)] px-2.5 py-1.5 text-[var(--tt-text-muted)] transition-colors hover:bg-[var(--tt-surface-subtle)] hover:text-[var(--tt-text)]"
              to="/profile"
            >
              <CircleUserRound className="h-4 w-4" />
              <div className="hidden text-right sm:block">
                <div className="max-w-40 truncate text-sm font-medium text-[var(--tt-text)]">
                  {displayName}
                </div>
                <div className="max-w-40 truncate text-xs text-[var(--tt-text-muted)]">
                  @{user?.username}
                </div>
              </div>
            </Link>
            <Button
              aria-label="Sair"
              size="sm"
              type="button"
              variant="ghost"
              onClick={logout}
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </header>

        <main className="mx-auto max-w-[1500px] p-4 sm:p-5 lg:p-7">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
