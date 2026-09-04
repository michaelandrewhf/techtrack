# TechTrack API

Esta documentacao registra a primeira versao da API HTTP do TechTrack. A API usa Django REST Framework, JWT, django-filter e drf-spectacular.

## Base URL

```text
/api/v1/
```

Endpoints auxiliares:

```text
GET  /api/health/
POST /api/token/
POST /api/token/refresh/
POST /api/token/verify/
GET  /api/schema/
GET  /api/docs/
```

## Autenticacao

A API de negocio exige usuario autenticado por padrao com `IsAuthenticated`.

A autenticacao principal da API e JWT via `djangorestframework-simplejwt`:

```http
POST /api/token/
Content-Type: application/json

{
  "username": "usuario",
  "password": "senha"
}
```

Use o token de acesso nas chamadas:

```http
Authorization: Bearer <access_token>
```

`SessionAuthentication` continua habilitada para compatibilidade com Django Admin e browsable API em desenvolvimento. CSRF nao foi desabilitado globalmente.

## Convencoes

- URLs usam plural em kebab-case.
- IDs nas URLs sao UUIDs.
- `WorkOrder.number` e o numero amigavel da OS, mas nao substitui o UUID.
- Escrita usa IDs simples com sufixo `_id`, como `customer_id`, `equipment_type_id` e `service_type_id`.
- Leitura usa representacoes resumidas aninhadas quando ajuda a evitar round-trips.
- Nao ha nested writes complexos.
- Campos de auditoria e timestamps sao somente leitura.
- Catalogos inativos continuam aparecendo em historico, mas nao devem ser selecionados em novas operacoes.

## Paginacao, filtros e busca

A paginacao global usa `PageNumberPagination` com `PAGE_SIZE = 25`.

Filtros sao implementados com `django-filter`. Busca e ordenacao usam os filtros do DRF apenas em campos explicitamente permitidos por ViewSet.

## Recursos principais

```text
METHOD | ENDPOINT                                      | AUTH | FINALIDADE
GET    | /api/health/                                 | nao  | Health check simples
POST   | /api/token/                                  | nao  | Obter par JWT
POST   | /api/token/refresh/                          | nao  | Renovar access token
GET    | /api/schema/                                 | nao  | Schema OpenAPI
GET    | /api/docs/                                   | nao  | Swagger UI
GET    | /api/v1/customers/                           | sim  | Listar clientes
POST   | /api/v1/customers/                           | sim  | Criar cliente
GET    | /api/v1/customers/{id}/                       | sim  | Detalhar cliente
PATCH  | /api/v1/customers/{id}/                       | sim  | Atualizar cliente
DELETE | /api/v1/customers/{id}/                       | sim  | Soft delete de cliente
GET    | /api/v1/customers/{id}/equipment/             | sim  | Equipamentos do cliente
GET    | /api/v1/customers/{id}/work-orders/           | sim  | OSs do cliente
GET    | /api/v1/equipment/                           | sim  | Listar equipamentos
POST   | /api/v1/equipment/                           | sim  | Criar equipamento
GET    | /api/v1/equipment/{id}/                       | sim  | Detalhar equipamento
PATCH  | /api/v1/equipment/{id}/                       | sim  | Atualizar equipamento
DELETE | /api/v1/equipment/{id}/                       | sim  | Soft delete de equipamento
GET    | /api/v1/equipment/{id}/components/            | sim  | Listar componentes
POST   | /api/v1/equipment/{id}/components/            | sim  | Registrar componente
POST   | /api/v1/equipment/{id}/components/{id}/remove/| sim  | Registrar remocao de componente
GET    | /api/v1/equipment/{id}/work-orders/           | sim  | OSs do equipamento
GET    | /api/v1/equipment/{id}/maintenance/           | sim  | Preventivas calculadas
GET    | /api/v1/work-orders/                          | sim  | Listar OSs
POST   | /api/v1/work-orders/                          | sim  | Abrir OS via dominio
GET    | /api/v1/work-orders/{id}/                     | sim  | Detalhar OS
PATCH  | /api/v1/work-orders/{id}/                     | sim  | Atualizar campos seguros
PUT    | /api/v1/work-orders/{id}/                     | sim  | Mesmo contrato restrito do PATCH
DELETE | /api/v1/work-orders/{id}/                     | sim  | Bloqueado
GET    | /api/v1/work-orders/{id}/timeline/            | sim  | Timeline da OS
POST   | /api/v1/work-orders/{id}/change-status/       | sim  | Alterar status via dominio
POST   | /api/v1/work-orders/{id}/complete/            | sim  | Concluir OS via dominio
POST   | /api/v1/work-orders/{id}/cancel/              | sim  | Cancelar OS via dominio
GET    | /api/v1/work-orders/{id}/services/            | sim  | Listar servicos da OS
POST   | /api/v1/work-orders/{id}/services/            | sim  | Registrar servico
POST   | /api/v1/work-orders/{id}/services/{id}/void/  | sim  | Invalidar servico
GET    | /api/v1/work-orders/{id}/parts/               | sim  | Listar pecas da OS
POST   | /api/v1/work-orders/{id}/parts/               | sim  | Registrar peca usada
POST   | /api/v1/work-orders/{id}/parts/{id}/void/     | sim  | Invalidar peca
GET    | /api/v1/work-orders/{id}/billing/             | sim  | Consultar cobranca
PUT    | /api/v1/work-orders/{id}/billing/             | sim  | Criar/substituir cobranca
PATCH  | /api/v1/work-orders/{id}/billing/             | sim  | Atualizar cobranca
```

Catalogos configuraveis tambem possuem CRUD protegido:

```text
/api/v1/equipment-types/
/api/v1/component-types/
/api/v1/service-categories/
/api/v1/service-types/
/api/v1/part-categories/
/api/v1/parts/
/api/v1/payment-methods/
/api/v1/work-order-statuses/
```

## WorkOrder

Criacao de OS:

- o cliente envia `customer_id`, `equipment_id`, `title`, `problem_description` e opcionalmente `priority`;
- o status inicial e definido pelo dominio;
- o numero da OS e gerado pela sequencia transacional existente;
- o primeiro registro de `WorkOrderStatusHistory` e criado pelo dominio.

PATCH generico nao aceita:

- `status`;
- `number`;
- `opened_at`;
- `completed_at`;
- `cancelled_at`;
- historico;
- campos de auditoria.

Transicoes usam actions explicitas e chamam `workorders.services`.

## Manutencao preventiva

`GET /api/v1/equipment/{id}/maintenance/` retorna os `ServiceType` recorrentes ativos e calcula:

- ultima execucao valida;
- proxima data prevista;
- status calculado.

Status calculado:

```text
never_performed: nenhum servico valido concluido
overdue: proxima data menor ou igual ao momento atual
upcoming: vence nos proximos 30 dias
ok: existe execucao valida e nao esta proximo do vencimento
```

A resposta ignora:

- servicos de OS nao concluida;
- servicos invalidados;
- `ServiceType` nao recorrente.

`next_due_at` nao e salvo no banco.

## Performance

As ViewSets escolhem QuerySets por acao:

- listagem de OS usa `WorkOrder.objects.with_list_data()`;
- detalhe de OS usa `WorkOrder.objects.with_detail_data()`;
- listagem/detalhe de equipamentos usa os QuerySets de `Equipment`;
- clientes usam annotations de dashboard.

Serializers nao devem executar consultas escondidas para contagens ou ultima manutencao. Veja [query-performance.md](query-performance.md).

## Erros

A API usa o padrao DRF para erros de validacao.

Regras de dominio que lancam `django.core.exceptions.ValidationError` sao convertidas para HTTP 400.

Tentativa de excluir catalogos referenciados retorna HTTP 409.

Tentativa de deletar OS retorna HTTP 405.

`GET /api/v1/work-orders/{id}/billing/` retorna HTTP 404 quando ainda nao existe cobranca cadastrada.
