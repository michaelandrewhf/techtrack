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

Variavel:

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
POST /api/token/
POST /api/token/refresh/
GET  /api/v1/me/
```

Tokens JWT sao enviados por `Authorization: Bearer <access>`.

Nesta etapa, access e refresh ficam no `localStorage` para simplicidade de SPA. Trade-off: isso e mais exposto a XSS do que cookie HttpOnly. A mitigacao atual e manter a aplicacao sem HTML arbitrario de usuario e centralizar chamadas no API client. Uma evolucao futura pode migrar refresh token para cookie HttpOnly.

## API client

Chamadas HTTP ficam centralizadas em:

```text
src/api/client.ts
src/api/endpoints.ts
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
/customers
/customers/:id
/equipment
/equipment/:id
/work-orders
/work-orders/new
/work-orders/:id
/settings/:resource
```

## Regras de dominio

O frontend nao gera numero de OS, nao decide validade final de transicoes e nao calcula status de manutencao preventiva quando a API ja retorna esse dado.

A UI pode desabilitar botoes por conveniencia, mas o backend continua sendo a fonte da verdade.

## Comandos

```bash
corepack pnpm lint
corepack pnpm format:check
corepack pnpm test
corepack pnpm build
```

## Producao futura

Deploy nao foi implementado. Caminhos possiveis:

- build estatico servido por Nginx;
- frontend em static hosting;
- Django e SPA atras de proxy reverso;
- API e frontend em origens separadas com CORS controlado.
