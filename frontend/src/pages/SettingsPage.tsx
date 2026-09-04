import {
  Boxes,
  CircleDollarSign,
  ClipboardCheck,
  Component,
  Package,
  Settings2,
  Tags,
  Wrench,
} from "lucide-react";
import { Link } from "react-router-dom";

import { PageHeader } from "../components/PageHeader";

const resources = [
  {
    resource: "equipment-types",
    label: "Tipos de equipamento",
    description: "Notebook, desktop, impressora e demais classes de equipamento.",
    icon: Boxes,
  },
  {
    resource: "component-types",
    label: "Tipos de componente",
    description: "Memoria, armazenamento, placa e outros componentes tecnicos.",
    icon: Component,
  },
  {
    resource: "service-categories",
    label: "Categorias de servico",
    description: "Agrupamentos usados para organizar o catalogo de servicos.",
    icon: Tags,
  },
  {
    resource: "service-types",
    label: "Tipos de servico",
    description: "Servicos executados, precos padrao e regras de preventiva.",
    icon: Wrench,
  },
  {
    resource: "part-categories",
    label: "Categorias de peca",
    description: "Organizacao do catalogo de pecas e materiais.",
    icon: Tags,
  },
  {
    resource: "parts",
    label: "Pecas",
    description: "Catalogo reutilizavel de pecas, custos e precos padrao.",
    icon: Package,
  },
  {
    resource: "payment-methods",
    label: "Metodos de pagamento",
    description: "Formas disponiveis ao registrar recebimentos.",
    icon: CircleDollarSign,
  },
  {
    resource: "work-order-statuses",
    label: "Status de OS",
    description: "Etapas configuraveis do fluxo operacional das ordens.",
    icon: ClipboardCheck,
  },
];

export function SettingsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Administracao"
        title="Configuracoes"
        description="Catalogos e parametros operacionais do TechTrack, reunidos em um unico lugar."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {resources.map((item) => (
          <Link
            className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-800"
            key={item.resource}
            to={`/settings/${item.resource}`}
          >
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-slate-100 p-2.5 text-slate-600 transition group-hover:bg-blue-50 group-hover:text-blue-600 dark:bg-slate-800 dark:text-slate-300 dark:group-hover:bg-blue-950 dark:group-hover:text-blue-300">
                <item.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold text-slate-950 dark:text-white">
                  {item.label}
                </div>
                <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">
                  {item.description}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
      <div className="mt-6 flex items-center gap-2 text-xs text-slate-500">
        <Settings2 className="h-4 w-4" />
        Alteracoes nestes catalogos afetam os formularios e fluxos que os utilizam.
      </div>
    </div>
  );
}
