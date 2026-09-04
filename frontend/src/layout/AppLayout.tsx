import {
  Boxes,
  BriefcaseBusiness,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Settings,
  Sun,
  Users,
  WalletCards,
  Wrench,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { Button } from "../components/ui";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/customers", label: "Clientes", icon: Users },
  { to: "/equipment", label: "Equipamentos", icon: Boxes },
  { to: "/work-orders", label: "Ordens de Servico", icon: ClipboardList },
  { to: "/quotes", label: "Orcamentos", icon: FileText },
  { to: "/finance", label: "Financeiro", icon: WalletCards },
];

const settings = [
  ["equipment-types", "Tipos de Equipamento"],
  ["component-types", "Tipos de Componente"],
  ["service-categories", "Categorias de Servico"],
  ["service-types", "Tipos de Servico"],
  ["part-categories", "Categorias de Peca"],
  ["parts", "Pecas"],
  ["payment-methods", "Metodos de Pagamento"],
  ["work-order-statuses", "Status de OS"],
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dark, setDark] = useState(
    () => localStorage.getItem("techtrack.theme") === "dark",
  );
  const location = useLocation();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("techtrack.theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => setSidebarOpen(false), [location.pathname]);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-slate-200 bg-white transition dark:border-slate-800 dark:bg-slate-900 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5 dark:border-slate-800">
          <Wrench className="h-6 w-6 text-blue-600" />
          <div>
            <div className="font-semibold text-slate-950 dark:text-white">
              TechTrack
            </div>
            <div className="text-xs text-slate-500">Suporte e manutencao</div>
          </div>
        </div>
        <nav className="space-y-1 p-3">
          {nav.map((item) => (
            <NavLink
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
                  isActive
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-100"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                }`
              }
              end={item.to === "/"}
              key={item.to}
              to={item.to}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
          <div className="px-3 pt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Configuracoes
          </div>
          {settings.map(([resource, label]) => (
            <NavLink
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm ${
                  isActive
                    ? "bg-slate-200 text-slate-950 dark:bg-slate-800 dark:text-white"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`
              }
              key={resource}
              to={`/settings/${resource}`}
            >
              {resource === "parts" ? (
                <BriefcaseBusiness className="h-4 w-4" />
              ) : (
                <Settings className="h-4 w-4" />
              )}
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
          <button
            className="rounded-md p-2 lg:hidden"
            type="button"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Abrir menu</span>
          </button>
          <div className="text-sm text-slate-500">{user?.username}</div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setDark((value) => !value)}
            >
              {dark ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
              Tema
            </Button>
            <Button variant="secondary" type="button" onClick={logout}>
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </header>
        <main className="mx-auto max-w-7xl p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
