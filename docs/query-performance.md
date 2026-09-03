# Query Performance

Este documento registra os padroes de acesso ao banco do TechTrack para reduzir N+1 queries antes da chegada de DRF, serializers e frontend.

## Principios

- Listagens usam `select_related()` apenas para FKs/OneToOne exibidos na lista.
- Detalhes usam `prefetch_related()`/`Prefetch()` para colecoes 1:N.
- Serializers futuros nao devem decidir performance; ViewSets devem escolher QuerySets preparados.
- Campos derivados de manutencao preventiva continuam calculados pelo historico.
- Nao ha cache, denormalizacao, materialized views ou SQL manual espalhado nesta etapa.

## Relacionamentos e estrategia de carregamento

| Relacao | Tipo | Estrategia normal |
| --- | --- | --- |
| `Customer -> equipments` | 1:N | `prefetch_related()` no detalhe do cliente |
| `Customer -> work_orders` | 1:N | `Prefetch()` com `WorkOrder.objects.with_list_data()` |
| `Equipment -> customer` | FK | `select_related("customer")` em listas/detalhes |
| `Equipment -> equipment_type` | FK | `select_related("equipment_type")` em listas/detalhes |
| `Equipment -> components` | 1:N | `Prefetch()` no detalhe, filtrando atuais quando aplicavel |
| `Equipment -> work_orders` | 1:N | `Prefetch()` no detalhe |
| `EquipmentComponent -> component_type` | FK | `select_related("component_type")` |
| `WorkOrder -> customer` | FK | `select_related("customer")` |
| `WorkOrder -> equipment` | FK | `select_related("equipment", "equipment__equipment_type")` |
| `WorkOrder -> status` | FK | `select_related("status")` |
| `WorkOrder -> responsible_user` | FK | `select_related("responsible_user")` |
| `WorkOrder -> billing` | OneToOne reverso | `select_related("billing", "billing__payment_method")` no detalhe |
| `WorkOrder -> status_history` | 1:N | `Prefetch()` com `select_related("status", "changed_by")` |
| `WorkOrder -> services` | 1:N | `Prefetch()` com servicos validos e `select_related("service_type")` |
| `WorkOrder -> parts` | 1:N | `Prefetch()` com pecas validas e `select_related()` dos FKs |
| `WorkOrderService -> service_type` | FK | `select_related("service_type", "service_type__category")` |
| `WorkOrderPart -> part` | FK | `select_related("part", "part__category")` |
| `WorkOrderPart -> work_order_service` | FK | `select_related("work_order_service", "work_order_service__service_type")` |
| `WorkOrderBilling -> payment_method` | FK | `select_related("payment_method")` |

## QuerySets customizados

### Customer

- `Customer.objects.with_dashboard_data()`
  - anota `equipment_count`;
  - anota `active_work_order_count`;
  - anota `latest_work_order_at`.

- `Customer.objects.with_detail_data()`
  - prefetch de equipamentos com dados de lista;
  - prefetch de OSs com dados de lista.

### Equipment

- `Equipment.objects.with_list_data()`
  - `select_related("customer", "equipment_type")`.

- `Equipment.objects.with_detail_data()`
  - dados de lista;
  - componentes atuais em `current_components`;
  - OSs recentes em `recent_work_orders`.

- `Equipment.objects.with_latest_service_at(service_type)`
  - usa `Subquery`/`OuterRef` para anotar a ultima execucao valida de um tipo de servico por equipamento.

### EquipmentComponent

- `EquipmentComponent.objects.current()`
  - filtra `removed_at IS NULL`.

- `EquipmentComponent.objects.with_list_data()`
  - `select_related("component_type")`.

### WorkOrder

- `WorkOrder.objects.with_list_data()`
  - `select_related("customer", "equipment", "equipment__equipment_type", "status", "responsible_user")`.

- `WorkOrder.objects.with_detail_data()`
  - dados de lista;
  - `select_related("billing", "billing__payment_method")`;
  - timeline com status/usuario;
  - servicos validos com tipo/categoria/usuario;
  - pecas validas com part/categoria/servico/componente.

- `WorkOrder.objects.active()`
- `WorkOrder.objects.completed()`
- `WorkOrder.objects.cancelled()`

### WorkOrderService

- `WorkOrderService.objects.valid()`
  - filtra `voided_at IS NULL`.

- `WorkOrderService.objects.for_preventive_history()`
  - considera servicos validos em OS com `status.kind = completed`.

- `WorkOrderService.objects.for_equipment(equipment)`
  - filtra pelo equipamento via `work_order__equipment`.

### WorkOrderPart

- `WorkOrderPart.objects.valid()`
  - filtra `voided_at IS NULL`.

- `WorkOrderPart.objects.with_list_data()`
  - carrega FKs normalmente exibidas no detalhe da OS.

## Casos de uso principais

### Lista de clientes

Use:

```python
Customer.objects.with_dashboard_data()
```

Evita:

```python
for customer in customers:
    customer.equipments.count()
    customer.work_orders.count()
```

### Detalhe do cliente

Use:

```python
Customer.objects.with_detail_data().get(pk=customer_id)
```

### Lista de equipamentos

Use:

```python
Equipment.objects.with_list_data()
```

### Detalhe do equipamento

Use:

```python
Equipment.objects.with_detail_data().get(pk=equipment_id)
```

Componentes atuais ficam em:

```python
equipment.current_components
```

OSs recentes ficam em:

```python
equipment.recent_work_orders
```

### Lista de OS

Use:

```python
WorkOrder.objects.with_list_data()
```

Este QuerySet foi preparado para acesso a:

```python
work_order.customer.name
work_order.equipment.model
work_order.equipment.equipment_type.name
work_order.status.name
work_order.responsible_user
```

### Detalhe da OS

Use:

```python
WorkOrder.objects.with_detail_data().get(pk=work_order_id)
```

Este QuerySet foi preparado para:

- cliente;
- equipamento;
- tipo do equipamento;
- status;
- responsavel;
- billing;
- timeline;
- servicos validos;
- pecas validas.

## Manutencao preventiva

### Uma manutencao especifica

Use:

```python
get_last_valid_maintenance(equipment=equipment, service_type=service_type)
```

Regra:

- `WorkOrder.status.kind = completed`;
- `WorkOrderService.voided_at IS NULL`;
- maior `performed_at`;
- desempate por `created_at`.

### Todas as ultimas manutencoes de um equipamento

Use:

```python
get_latest_valid_maintenances_by_service_type(equipment=equipment)
```

Essa funcao faz uma unica consulta para o equipamento e monta um dicionario em memoria por `service_type_id`, evitando uma query para cada tipo de servico.

### Varios equipamentos e um tipo de servico

Use:

```python
Equipment.objects.with_list_data().with_latest_service_at(service_type)
```

Isso usa `Subquery`/`OuterRef` para anotar `latest_service_at` em cada equipamento sem executar uma query por equipamento.

## Indices

### Indices implicitos

Django cria indice automaticamente para `ForeignKey`. Por isso foram removidos indices explicitos redundantes em FKs simples, como:

- `WorkOrder.customer`;
- `WorkOrder.equipment`;
- `WorkOrder.status`;
- `Equipment.customer`;
- `Equipment.equipment_type`;
- `WorkOrderPart.work_order`;
- `WorkOrderPart.work_order_service`;
- categorias FK em catalogos.

Campos `unique=True`, como `slug`/`code`, tambem ja possuem indice unico. Indices explicitos duplicados foram removidos.

### Indices mantidos ou adicionados

- `Customer.name`: busca por nome.
- `Customer.status`: filtro cadastral.
- `Customer.email`: busca por e-mail.
- `Equipment.status`: filtro por estado operacional.
- `Equipment.serial_number`: busca direta.
- `Equipment.asset_tag`: busca direta.
- `Equipment(customer, status)`: equipamentos de um cliente por status.
- `EquipmentComponent(equipment, component_type, removed_at)`: historico por equipamento/componente.
- `EquipmentComponent(equipment, installed_at) WHERE removed_at IS NULL`: componentes atualmente instalados.
- `WorkOrder.opened_at`: ordenacao/listas cronologicas.
- `WorkOrder.completed_at`: filtros por conclusao.
- `WorkOrder(status, opened_at)`: lista de OS por status.
- `WorkOrder(customer, opened_at)`: OSs recentes de um cliente.
- `WorkOrder(equipment, opened_at)`: OSs recentes de um equipamento.
- `WorkOrderStatusHistory(work_order, changed_at)`: timeline.
- `WorkOrderService(work_order, service_type, performed_at)`: servicos de uma OS por tipo/data.
- `WorkOrderService(service_type, performed_at) WHERE voided_at IS NULL`: ultima execucao valida por tipo.
- `WorkOrderService(work_order, performed_at) WHERE voided_at IS NULL`: servicos validos de uma OS por data.
- `WorkOrderPart(work_order, created_at) WHERE voided_at IS NULL`: pecas validas de uma OS.
- `ServiceType.is_recurring`: busca por servicos recorrentes.
- `WorkOrderStatus.kind`: filtros por semantica do status.
- `is_active` em catalogos configuraveis: telas/admin/API futuras para opcoes ativas.

## JSONField

Campos `specifications` em `Equipment` e `EquipmentComponent` nao receberam indice GIN.

Motivo: ainda nao existe caso real de busca por chaves internas do JSON. Em listagens, esses campos devem ser evitados se crescerem muito. `only()`/`defer()` pode ser usado futuramente em listagens densas, mas nao foi aplicado agora para evitar queries escondidas ao acessar campos deferidos.

## Propriedades e `__str__`

- `WorkOrderService.equipment` foi removida para nao esconder acesso ao banco atras de uma propriedade.
- Acesso ao equipamento do servico deve ser explicito: `service.work_order.equipment`.
- `Equipment.__str__` usa campos locais quando possivel e evita depender de FK como fallback.
- Admins que exibem objetos relacionados usam `list_select_related`.

## Admin

ModelAdmins de entidades com FKs frequentes usam `list_select_related`, especialmente:

- `EquipmentAdmin`;
- `EquipmentComponentAdmin`;
- `ServiceTypeAdmin`;
- `PartAdmin`;
- `WorkOrderAdmin`;
- `WorkOrderStatusHistoryAdmin`;
- `WorkOrderServiceAdmin`;
- `WorkOrderPartAdmin`;
- `WorkOrderBillingAdmin`.

## Testes de query count

Testes em `workorders/test_query_performance.py` protegem os caminhos principais.

Resultados atuais em SQLite de teste:

```text
Listagem de 1 OS: 1 query
Listagem de 20 OS: 1 query

Detalhe de OS com 10 servicos/pecas: 4 queries
Detalhe de OS com 50 servicos/pecas: 4 queries

Listagem de 20 equipamentos: 1 query
Detalhe de equipamento com componentes e OSs: 3 queries
Dashboard de 20 clientes com contagens: 1 query
```

Esses testes medem quantidade de queries, nao plano de execucao nem performance real do PostgreSQL.

## EXPLAIN

Para validar planos no PostgreSQL:

```python
print(WorkOrder.objects.with_list_data().explain(analyze=False))
print(Equipment.objects.with_latest_service_at(service_type).explain(analyze=False))
print(WorkOrder.objects.with_detail_data().filter(pk=work_order_id).explain(analyze=False))
```

Em PostgreSQL real, tambem pode ser usado:

```python
queryset.explain(analyze=True, buffers=True)
```

Nao tirar conclusoes fortes de planner usando SQLite.

## DRF futuro

ViewSets futuros devem escolher QuerySets por acao:

```python
class WorkOrderViewSet(ModelViewSet):
    def get_queryset(self):
        if self.action == "list":
            return WorkOrder.objects.with_list_data()
        return WorkOrder.objects.with_detail_data()
```

Serializers devem consumir objetos ja preparados, nao chamar `.select_related()` ou `.prefetch_related()`.

