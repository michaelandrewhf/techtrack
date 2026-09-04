# Orcamentos

Orcamento (`Quote`) e uma entidade comercial propria. Ele nao e um status de Ordem de Servico.

Isso permite criar uma proposta que pode ser rejeitada sem nunca gerar uma OS, bem como vincular uma proposta a uma OS de diagnostico ja existente.

## Modelo

```text
Customer
  1 ---- N Quote

Equipment
  1 ---- N Quote (opcional)

WorkOrder
  1 ---- N Quote (opcional)

Quote
  1 ---- N QuoteItem
  1 ---- N GeneratedDocument
```

### Quote

Possui UUID interno e numero sequencial amigavel (`ORC #000001`). O numero usa `QuoteNumberSequence` com lock transacional, sem `max(number) + 1`.

Status:

- `draft`;
- `sent`;
- `approved`;
- `rejected`;
- `cancelled`.

Expiracao pode ser derivada de `valid_until` e nao exige status persistido.

### QuoteItem

Tipos:

- `service`;
- `part`;
- `free`.

Mesmo quando o item referencia `ServiceType` ou `Part`, `description`, `quantity`, `unit_price` e `discount` pertencem ao orcamento e funcionam como snapshot comercial.

O desconto de um item nao pode superar seu subtotal. O desconto global nao pode produzir total negativo ao enviar, aprovar ou emitir o documento.

## Workflow

Operacoes de dominio:

```text
create_quote
add_quote_item
mark_quote_sent
approve_quote
set_quote_terminal_status
create_work_order_from_quote
```

O frontend/API nao deve alterar `status`, `sent_at` ou `approved_at` diretamente.

### Orcamento -> OS

Somente um orcamento aprovado pode gerar OS.

Se `Quote.work_order` ja estiver preenchido, o sistema reutiliza a OS existente. Caso contrario, e necessario um equipamento e `create_work_order_from_quote()` cria uma OS usando cliente, equipamento, titulo e descricao da proposta.

Itens orcados nao sao convertidos automaticamente em `WorkOrderService`: um item previsto comercialmente so vira servico executado quando o atendimento realmente o registra.

## API

```text
GET    /api/v1/quotes/
POST   /api/v1/quotes/
GET    /api/v1/quotes/{id}/
PATCH  /api/v1/quotes/{id}/
POST   /api/v1/quotes/{id}/items/
POST   /api/v1/quotes/{id}/mark-sent/
POST   /api/v1/quotes/{id}/approve/
POST   /api/v1/quotes/{id}/reject/
POST   /api/v1/quotes/{id}/cancel/
POST   /api/v1/quotes/{id}/create-work-order/
GET    /api/v1/quotes/{id}/pdf/
POST   /api/v1/quotes/{id}/issue-pdf/
```

## Frontend

Rotas:

```text
/quotes
/quotes/new
/quotes/:id
```

O detalhe permite adicionar itens enquanto o orcamento esta editavel, executar transicoes, gerar preview, emitir revisao oficial em PDF e criar/abrir a OS vinculada.
