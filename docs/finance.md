# Financeiro

O modulo `finance` separa composicao de valor, cobranca e pagamento.

## Principios

- Uma OS registra o trabalho tecnico e seus itens.
- `Receivable` representa uma conta a receber.
- `Payment` representa dinheiro efetivamente recebido.
- Um cliente mensalista continua tendo OSs tecnicas; a mensalidade nasce de `ServiceAgreement`, nao de cada OS.
- Pagamentos podem ser parciais.
- Pagamentos incorretos sao invalidados (`voided_*`), nunca apagados silenciosamente.
- Vencimento em atraso e calculado por saldo pendente + `due_date`; nao existe status `OVERDUE` persistido.
- `WorkOrderBilling` foi preservado temporariamente como snapshot financeiro legado da OS. Novos pagamentos e baixas usam `Receivable` + `Payment`.

## Entidades

```text
Customer
  1 ---- N ServiceAgreement
  1 ---- N Receivable

ServiceAgreement
  1 ---- N Receivable

WorkOrder
  1 ---- N Receivable

Receivable
  1 ---- N Payment

PaymentMethod
  1 ---- N Payment
```

### ServiceAgreement

Representa um acordo recorrente de suporte/manutencao. Campos principais:

- cliente;
- nome/descricao;
- status;
- inicio/fim;
- frequencia;
- valor;
- dia de vencimento.

Frequencias suportadas: mensal, trimestral, semestral e anual. A V1 de interface prioriza mensalidade.

### Competencia

`Receivable.competence` usa sempre o primeiro dia do mes. Existe constraint de unicidade condicional em `(service_agreement, competence)`, impedindo duas mensalidades do mesmo acordo para a mesma competencia.

A geracao e idempotente:

```bash
uv run python manage.py generate_monthly_receivables --competence 2026-09
```

Rodar o comando novamente nao duplica cobrancas.

### Receivable

Pode ter origem:

- `work_order`;
- `agreement`;
- `manual`.

Campos importantes:

- `amount`: valor cobrado;
- `paid_amount`: calculado pela soma de pagamentos validos;
- `balance`: `amount - paid_amount`;
- `status`: `pending`, `partial`, `paid`, `cancelled`;
- `is_overdue`: calculado, nao persistido.

### Payment

O service `register_payment()`:

1. bloqueia a cobranca com `select_for_update()`;
2. valida metodo e valor;
3. rejeita overpayment;
4. cria o pagamento;
5. recalcula o status da cobranca.

`void_payment()` invalida um pagamento e recalcula novamente o saldo/status.

## API

Principais recursos:

```text
GET/POST /api/v1/service-agreements/
POST     /api/v1/service-agreements/{id}/generate-receivable/
GET/POST /api/v1/receivables/
POST     /api/v1/receivables/{id}/payments/
GET      /api/v1/payments/
POST     /api/v1/payments/{id}/void/
GET      /api/v1/finance/dashboard/
GET      /api/v1/business-profile/
```

O dashboard financeiro retorna total pendente, vencido, recebido no mes, proximos vencimentos e pagamentos recentes.

## Frontend

A rota `/finance` concentra:

- saldo a receber;
- recebido no mes;
- valores em atraso;
- contas a receber;
- baixa de pagamento;
- acordos/mensalistas;
- recebimentos recentes.

O detalhe do cliente mostra acordos e historico financeiro. O detalhe da OS exibe composicao tecnica e cobrancas vinculadas, mas a baixa e feita no modulo Financeiro.

## Evolucoes futuras

Fora do escopo atual:

- SLA/franquia de horas por contrato;
- cobertura automatica de OS pelo contrato;
- contas a pagar;
- conciliacao bancaria;
- emissao fiscal;
- cobranca automatica por gateway;
- Celery/cron para disparar a geracao recorrente.
