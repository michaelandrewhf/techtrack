import {
  Boxes,
  Building2,
  CircleDollarSign,
  ClipboardCheck,
  Component,
  Package,
  Settings2,
  Tags,
  UserRound,
  Wrench,
} from "lucide-react";
import { Link } from "react-router-dom";

import { PageHeader } from "../components/PageHeader";

const accountSettings = [
  {
    to: "/profile",
    label: "Meu perfil",
    description: "Nome, usuario e e-mail da sua conta no TechTrack.",
    icon: UserRound,
  },
  {
    to: "/settings/business-profile",
    label: "Dados da empresa",
    description:
      "Prestador, documento e contatos usados nos PDFs de OS e orcamento.",
    icon: Building2,
  },
];

const resources = [
  {
    resource: "equipment-types",
    label: "Tipos de equipamento",
    description:
      "Notebook, desktop, impressora e demais classes de equipamento.",
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

const cardClass =
  "group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-800";

export function SettingsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Administracao"
        title="Configuracoes"
        description="Conta, dados dos documentos e parametros operacionais do TechTrack reunidos em um unico lugar."
      />

      <div className="mb-7 grid gap-4 sm:grid-cols-2">
        {accountSettings.map((item) => (
          <Link className={cardClass} key={item.to} to={item.to}>
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600 transition dark:bg-blue-950 dark:text-blue-300">
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

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
        Catalogos operacionais
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {resources.map((item) => (
          <Link
            className={cardClass}
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
        Alteracoes nestes catalogos afetam os formularios e fluxos que os
        utilizam.
      </div>
    </div>
  );
}
