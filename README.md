# TechTrack

TechTrack e uma aplicacao para gerenciamento de clientes, equipamentos e servicos de suporte/manutencao de TI, com backend Django/DRF e frontend React.

O projeto inclui:

- clientes e equipamentos;
- componentes e historico tecnico;
- ordens de servico e timeline de status;
- servicos realizados e pecas utilizadas;
- manutencao preventiva calculada pelo historico;
- orcamentos com workflow de aprovacao;
- conversao de orcamento aprovado em OS;
- contas a receber, pagamentos e cobrancas recorrentes;
- emissao versionada de documentos/PDFs de orcamento e OS;
- API REST autenticada com JWT;
- schema OpenAPI com drf-spectacular;
- SPA React em `frontend/`;
- ambiente local completo com Docker Compose e PostgreSQL.

## Arquitetura dos apps

```text
accounts
- User customizado

customers
- Customer

inventory
- Equipment
- EquipmentComponent

catalog
- ServiceCategory
- ServiceType
- PartCategory
- Part
- PaymentMethod

workorders
- WorkOrder
- WorkOrderStatus
- WorkOrderStatusHistory
- WorkOrderService
- WorkOrderPart
- WorkOrderBilling
- servicos de dominio

quotes
- Quote
- QuoteItem
- QuoteNumberSequence
- GeneratedDocument
- workflow de orcamento
- emissao de PDF/snapshot

finance
- ServiceAgreement
- Receivable
- Payment
- BusinessProfile
- cobrancas recorrentes
```

## Documentacao

- [Modelo de dominio](docs/domain-model.md)
- [Consultas, indices e N+1](docs/query-performance.md)
- [API](docs/api.md)
- [Financeiro](docs/finance.md)
- [Orcamentos](docs/quotes.md)
- [Deploy, runtime offline e seguranca operacional](docs/deployment.md)
- [Frontend](frontend/README.md)

## Requisitos

Para o fluxo recomendado com Docker:

- Docker Engine
- Docker Compose v2

Para executar sem Docker:

- Python 3.13+
- uv 0.10+
- Node.js 22+
- pnpm 11.25 via Corepack
- PostgreSQL para reproduzir o ambiente principal; SQLite continua suportado para desenvolvimento/testes simples.

## Atualizar o codigo local

Se o repositorio ja estiver clonado e sua branch local estiver limpa:

```bash
git switch master
git pull origin master
```

Antes de atualizar, confirme com `git status` se voce possui alteracoes locais nao commitadas.

## Forma recomendada: Docker Compose

Na raiz do projeto:

```bash
docker compose up --build
```

O Compose sobe:

```text
PostgreSQL 17
    ^
    |
Django/DRF        http://localhost:8001
    ^
    | /api
React/Vite        http://localhost:5173
```

As migrations sao aplicadas no startup do backend. O frontend usa proxy para acessar o backend dentro da rede Docker. Depois que as imagens estiverem construidas, o startup nao sincroniza dependencias e pode funcionar sem internet.

Para criar um superusuario:

```bash
docker compose exec backend python manage.py createsuperuser
```

Para acompanhar os containers:

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
```

Para encerrar sem apagar o banco:

```bash
docker compose down
```

Para encerrar e tambem remover os volumes locais, incluindo os dados do PostgreSQL:

```bash
docker compose down -v
```

Use `down -v` somente quando realmente quiser reiniciar o banco do zero.

## Variaveis de ambiente do Compose

Os principais valores podem ser sobrescritos por variaveis de ambiente:

```text
POSTGRES_DB=techtrack
POSTGRES_USER=techtrack
POSTGRES_PASSWORD=techtrack
DJANGO_SECRET_KEY=...
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,backend
BACKEND_PORT=8001
FRONTEND_PORT=5173
```

Os defaults do `compose.yaml` sao adequados somente para desenvolvimento local.

## Runtime de producao

Existe uma stack separada em `compose.prod.yaml`, sem bind mounts de codigo, com Gunicorn no backend e Nginx servindo o frontend compilado.

Consulte [docs/deployment.md](docs/deployment.md) antes de publicar. O fluxo basico e:

```bash
docker compose -f compose.prod.yaml build
docker compose -f compose.prod.yaml up -d
```

A stack exige `POSTGRES_PASSWORD`, `DJANGO_SECRET_KEY` e `DJANGO_ALLOWED_HOSTS` configurados explicitamente.

## Backend sem Docker

Sincronize o ambiente:

```bash
uv sync
```

Sem `DATABASE_URL`, o Django usa SQLite local. Para PostgreSQL, configure uma URL como:

```bash
export DATABASE_URL=postgresql://usuario:senha@localhost:5432/techtrack
```

Aplique as migrations:

```bash
uv run python manage.py migrate
```

Crie um usuario administrador, se necessario:

```bash
uv run python manage.py createsuperuser
```

Inicie o backend:

```bash
uv run python manage.py runserver
```

Nesse modo ele fica em `http://localhost:8000`.

## Frontend sem Docker

Em outro terminal:

```bash
cd frontend
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm install --frozen-lockfile
pnpm dev
```

O Vite fica em `http://localhost:5173` e, por padrao, encaminha `/api` para `http://localhost:8000`.

## API

Endpoints basicos:

```text
GET  /api/health/
POST /api/token/
POST /api/token/refresh/
GET  /api/schema/
GET  /api/docs/
```

Os recursos de negocio ficam sob `/api/v1/`, incluindo clientes, equipamentos, OS, orcamentos e financeiro.

Endpoints autenticados usam:

```http
Authorization: Bearer <access_token>
```

## Validacao do backend

Executar a suite:

```bash
uv run pytest -q
```

Validar Django, migrations, lint, formato e OpenAPI:

```bash
uv run python manage.py check
uv run python manage.py makemigrations --check --dry-run
uv run ruff check .
uv run ruff format --check .
uv run python manage.py spectacular --file /tmp/techtrack-openapi.yaml --validate
```

## Validacao do frontend

Dentro de `frontend/`:

```bash
pnpm lint
pnpm format:check
pnpm test
pnpm build
```

## Smoke test com a stack completa

O mesmo fluxo validado pelo CI pode ser reproduzido localmente com:

```bash
docker compose config
docker compose build
docker compose up -d
docker compose ps
curl --fail http://localhost:8001/api/health/
curl --fail http://localhost:5173/api/health/
```

Para validar especificamente o startup sem internet depois do build:

```bash
docker compose down
docker compose -f compose.yaml -f compose.offline.yaml up -d --no-build
```

Depois:

```bash
docker compose -f compose.yaml -f compose.offline.yaml down
```

## Cobrancas recorrentes

Para gerar as cobrancas recorrentes da competencia atual:

```bash
uv run python manage.py generate_monthly_receivables
```

Ou para uma competencia especifica:

```bash
uv run python manage.py generate_monthly_receivables --competence 2026-09
```

A geracao e idempotente para acordo/competencia: repetir o comando nao deve duplicar a mesma cobranca.

## Decisoes importantes de dominio

- uma `WorkOrder` pertence exatamente a um equipamento e cliente coerentes entre si;
- historico de status e preservado;
- servicos/pecas invalidados deixam de participar dos calculos sem destruir o historico;
- manutencao preventiva e derivada de servicos validos em OS concluidas;
- dinheiro usa `DecimalField`, nunca `float`;
- pagamentos podem ser parciais e podem ser invalidados preservando auditoria;
- documentos oficialmente emitidos guardam snapshot, versao e checksum;
- alteracoes posteriores no cadastro nao reescrevem o conteudo conceitual de documentos ja emitidos;
- notas internas da OS nao fazem parte do documento entregue ao cliente.

## CI

O workflow de validacao cobre:

- backend com SQLite;
- backend com PostgreSQL 17;
- frontend (lint, formato, testes e build);
- smoke test do Docker Compose de desenvolvimento;
- novo startup da stack preconstruida em rede sem acesso a internet;
- smoke test da stack de producao com Gunicorn e Nginx.

O objetivo e detectar erros de aplicacao, diferencas entre SQLite/PostgreSQL, problemas de integracao e dependencias acidentais de rede durante o runtime.
