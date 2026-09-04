import {
  Boxes,
  ChevronDown,
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {sidebarOpen ? (
        <button
          aria-label="Fechar menu"
          className="fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-sm lg:hidden"
          type="button"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform dark:border-slate-800 dark:bg-slate-900 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5 dark:border-slate-800">
          <Link className="flex items-center gap-3" to="/">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold tracking-tight text-slate-950 dark:text-white">
                TechTrack
              </div>
              <div className="text-xs text-slate-500">Gestao de suporte TI</div>
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

        <nav className="flex-1 space-y-5 overflow-y-auto p-3" aria-label="Principal">
          {groups.map((group, groupIndex) => (
            <div key={group.label ?? groupIndex}>
              {group.label ? (
                <div className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {group.label}
                </div>
              ) : null}
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavLink
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-200"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
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

        <div className="border-t border-slate-200 p-3 dark:border-slate-800">
          <NavLink
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-slate-100 text-slate-950 dark:bg-slate-800 dark:text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
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
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-3 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90 sm:px-5">
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
              <Button type="button" onClick={() => setCreateOpen((value) => !value)}>
                <Plus className="h-4 w-4" />
                Novo
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
              {createOpen ? (
                <div className="absolute left-0 top-11 z-50 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                  {quickCreate.map((item) => (
                    <Link
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                      key={item.to}
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
              size="sm"
              type="button"
              variant="ghost"
              onClick={() => setDark((value) => !value)}
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <div className="hidden border-l border-slate-200 pl-3 text-right dark:border-slate-800 sm:block">
              <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                {user?.username}
              </div>
              <div className="text-xs text-slate-500">Usuario autenticado</div>
            </div>
            <Button aria-label="Sair" size="sm" type="button" variant="ghost" onClick={logout}>
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
