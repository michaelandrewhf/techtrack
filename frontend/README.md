# TechTrack Frontend

SPA web do TechTrack, separada do backend Django e consumindo exclusivamente a API HTTP.

## Stack

- React
- TypeScript strict
- Vite
- Tailwind CSS
- React Router
- TanStack Query
- React Hook Form
- Zod
- pnpm via Corepack
- Vitest + Testing Library
- oxlint + Prettier

Nao ha Redux/Zustand nesta fase. TanStack Query gerencia server state; contexto local gerencia apenas autenticacao e tema.

## Direcao de UX

A interface e orientada a tarefas, nao aos apps internos do backend.

Principios adotados:

- cliente e um dos principais centros de navegacao;
- acoes aparecem no contexto em que fazem sentido;
- Financeiro continua sendo uma visao consolidada, mas nao e a unica porta para pagamentos e contratos;
- equipamento permite iniciar OS e orcamento sem voltar a uma listagem global;
- OS separa fluxo, conteudo tecnico, execucao, financeiro e historico;
- orcamento separa composicao comercial, workflow e documentos emitidos;
- configuracoes ficam reunidas em um hub unico;
- tabelas viram apresentacao em cards no mobile em vez de depender apenas de scroll horizontal;
- dark/light usam os mesmos componentes e estados sem duplicar telas.

O status avulso/mensalista nao e armazenado em `Customer`: ele e derivado da existencia de contrato ativo. Encerrar um contrato preserva o historico e faz o cliente voltar naturalmente ao contexto avulso.

## Tema

O tema claro/escuro usa a classe `dark` no elemento `html` e a variante customizada do Tailwind v4. A preferencia e persistida em `localStorage` pela chave `techtrack.theme` e reaplicada ao iniciar a aplicacao, inclusive na tela de login.

## Componentes de interface

A base reutilizavel esta concentrada em `src/components`:

```text
Breadcrumbs
DataTable
Modal
PageHeader
Tabs
ConfirmDialog
State
ui.tsx
```

`ui.tsx` contem primitives compartilhadas como `Button`, `Field`, `Input`, `Select`, `Textarea`, `Badge`, `Panel`, `MetricCard`, `Notice` e `DescriptionList`.

## Instalacao

Na pasta `frontend/`:

```bash
corepack pnpm install
```

## Ambiente

Crie um `.env` local se precisar alterar a URL base:

```bash
cp .env.example .env
```

Variaveis:

```text
VITE_API_BASE_URL=/api
VITE_API_PROXY_TARGET=http://localhost:8000
```

Em desenvolvimento, o Vite faz proxy de `/api` para `http://localhost:8000`, evitando CORS local.

## Execucao

Suba o backend Django em outro terminal:

```bash
uv run python manage.py runserver
```

Depois rode o frontend:

```bash
corepack pnpm dev
```

## Autenticacao

O login usa:

```text
POST  /api/token/
POST  /api/token/refresh/
GET   /api/v1/me/
PATCH /api/v1/me/
```

Tokens JWT sao enviados por `Authorization: Bearer <access>`.

A tela de login permite mostrar/ocultar a senha e lembrar apenas o nome de usuario pela chave `techtrack.rememberedUsername`. A senha nunca e armazenada por essa opcao. O link "Esqueci minha senha" esta reservado na interface, mas o fluxo de recuperacao de senha ainda nao foi implementado.

O usuario autenticado pode editar seu proprio nome de usuario, nome, sobrenome e e-mail em `/profile`. A atualizacao reflete imediatamente no cabecalho da aplicacao.

Nesta etapa, access e refresh ficam no `localStorage` para simplicidade de SPA. Trade-off: isso e mais exposto a XSS do que cookie HttpOnly. A mitigacao atual e manter a aplicacao sem HTML arbitrario de usuario e centralizar chamadas no API client. Uma evolucao futura pode migrar refresh token para cookie HttpOnly.

## Dados da empresa e documentos

`/settings/business-profile` edita o `BusinessProfile` usado como prestador nos PDFs de orcamento e ordem de servico:

- nome / razao social;
- CPF / CNPJ;
- telefone;
- WhatsApp;
- e-mail;
- endereco.

Somente administradores podem alterar esses dados. Novas previas e novas emissoes usam o cadastro atualizado. Documentos oficiais ja emitidos continuam usando o snapshot historico salvo na respectiva versao.

## API client

Chamadas HTTP ficam centralizadas em:

```text
src/api/client.ts
src/api/endpoints.ts
src/api/profile.ts
src/api/businessProfile.ts
```

O client:

- aplica `VITE_API_BASE_URL`;
- envia JWT;
- tenta refresh uma vez em HTTP 401;
- limpa tokens quando refresh falha;
- converte erros HTTP em `ApiError`.

Tipos gerados a partir do OpenAPI ficam em:

```text
src/api/schema.ts
```

Gerar novamente:

```bash
corepack pnpm generate:api-types
```

## Organizacao

```text
src/api
src/auth
src/components
src/layout
src/pages
src/utils
```

## Rotas

```text
/login
/
/profile
/customers
/customers/:id
/equipment
/equipment/:id
/work-orders
/work-orders/new
/work-orders/:id
/quotes
/quotes/new
/quotes/:id
/finance
/settings
/settings/business-profile
/settings/:resource
```

Fluxos de criacao aceitam contexto por query string quando aplicavel:

```text
/work-orders/new?customer=<uuid>&equipment=<uuid>
/quotes/new?customer=<uuid>&equipment=<uuid>
```

As tabs do cliente e Financeiro usam query string para manter URLs navegaveis e compartilhadas, por exemplo:

```text
/customers/<uuid>?tab=finance
/customers/<uuid>?tab=quotes
/finance?tab=agreements
```

## Regras de dominio

O frontend nao gera numero de OS, nao decide validade final de transicoes, nao recria regras financeiras e nao calcula status de manutencao preventiva quando a API ja retorna esse dado.

A UI pode desabilitar botoes por conveniencia, mas o backend continua sendo a fonte da verdade.

A tela de cliente usa os agregados retornados pelo detalhe da API (`equipment_count`, `active_work_order_count`, `latest_work_order_at`) apenas para apresentacao operacional.

## Comandos

```bash
corepack pnpm lint
corepack pnpm format:check
corepack pnpm test
corepack pnpm build
```

A workflow de validacao tambem executa backend em SQLite/PostgreSQL e smoke test do Docker Compose antes de merge para `master`.
