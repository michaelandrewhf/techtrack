# TechTrack Domain Model

Este documento e a referencia atual da modelagem de dominio e banco de dados do TechTrack.

## Fundacao do projeto

- Gerenciador oficial: `uv`.
- Arquivo de dependencias: `pyproject.toml`.
- Lockfile versionavel: `uv.lock`.
- Versao local de Python: `.python-version`.
- Tipo de projeto uv: `no-package`.

O TechTrack e uma aplicacao Django web, nao uma biblioteca Python publicavel. Por isso a raiz permanece em layout Django tradicional, com `manage.py`, `config/` e apps no topo, sem `src/` e sem `build-system`.

## Decisoes arquiteturais aplicadas

- Uma `WorkOrder` pertence exatamente a um `Equipment`.
- Se um cliente trouxer dois equipamentos, devem existir duas OSs.
- `WorkOrder.equipment` e obrigatorio.
- `WorkOrder.customer` tambem e mantido por semantica de dominio e facilidade de consulta.
- A regra `WorkOrder.customer == WorkOrder.equipment.customer` e validada no dominio/modelo, pois nao e uma `CheckConstraint` simples entre colunas da mesma tabela.
- Em PostgreSQL, essa mesma regra tambem e reforcada por trigger na migration `workorders.0003_work_order_customer_equipment_trigger`.
- `WorkOrderService` nao possui `equipment_id`; o equipamento vem de `WorkOrderService -> WorkOrder -> Equipment`.
- A fonte da verdade para manutencoes e `WorkOrderService`.
- Campos derivados como `last_cleaning`, `last_thermal_paste_change` e `next_due_at` nao devem ser salvos em `Equipment`.
- Entidades principais usam UUID como chave primaria.
- `WorkOrder.number` e o numero amigavel da OS, separado do UUID.
- Status da OS e classificacoes de negocio usam catalogos configuraveis.
- Enums permanecem apenas onde representam regras internas do software.
- Regras centrais de negocio ficam em servicos explicitos, nao em signals.

## Divisao dos apps

```text
accounts
- User

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
- WorkOrderNumberSequence
- WorkOrderStatus
- WorkOrderStatusHistory
- WorkOrderService
- WorkOrderPart
- WorkOrderBilling
- servicos de dominio
```

`catalog` agrupa entidades de catalogo reutilizaveis, como tipos de servico e pecas. `workorders/services.py` fica reservado para regras de aplicacao, como criar OS, mudar status, concluir OS, registrar servico e calcular manutencao preventiva.

## Identificadores

Entidades principais usam UUID:

```python
id = UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
```

`WorkOrder` tambem possui:

```text
number: PositiveBigIntegerField(unique=True)
```

O numero visivel pode ser formatado como `OS #000124`.

Para evitar race conditions, o numero e gerado por `WorkOrderNumberSequence`, uma linha bloqueada com `select_for_update()` dentro de transacao. A estrategia evita `max(number) + 1`.

## Entidades

### accounts.User

Usuario customizado criado desde a primeira migration para permitir evolucao futura de tecnicos, responsaveis, permissoes e historico por usuario.

Campos principais:

- `id`
- campos padrao de `AbstractUser`
- `created_at`
- `updated_at`

### Customer

Representa cliente pessoa fisica ou empresa.

Campos:

- `id`
- `name`
- `phone`
- `whatsapp`
- `email`
- `notes`
- `customer_since`
- `status`
- `created_at`
- `updated_at`
- `deleted_at`

Soft delete faz sentido aqui para preservar historico vinculado.

### Equipment

Representa um equipamento individual de um cliente.

Campos:

- `id`
- `customer`
- `equipment_type`
- `manufacturer`
- `model`
- `serial_number`
- `asset_tag`
- `operating_system`
- `specifications`
- `acquired_at`
- `notes`
- `status`
- `created_at`
- `updated_at`
- `deleted_at`

`Equipment` guarda caracteristicas gerais. Nao possui colunas especificas como `cpu`, `ram`, `ssd`, `gpu` ou `motherboard`.

### EquipmentType

Catalogo configuravel de tipos de equipamento.

Campos:

- `id`
- `name`
- `slug`
- `description`
- `is_active`
- `created_at`
- `updated_at`

Valores iniciais por data migration:

- Desktop
- Notebook
- Impressora
- Servidor
- Roteador

Novos tipos, como NVR, NAS, Switch, Access Point ou Nobreak, devem ser cadastrados como dados, sem alterar codigo.

### EquipmentComponent

Representa componentes instalados no equipamento.

Campos:

- `id`
- `equipment`
- `component_type`
- `manufacturer`
- `model`
- `serial_number`
- `capacity`
- `specifications`
- `installed_at`
- `removed_at`
- `source_work_order`
- `notes`
- `created_at`
- `updated_at`

Regra:

- `removed_at = NULL` significa componente atualmente instalado.
- `removed_at >= installed_at` quando ambos existirem.

Isso permite reconstruir historicamente a configuracao do equipamento sem transformar o sistema em inventario complexo.

### ComponentType

Catalogo configuravel de tipos de componente.

Campos:

- `id`
- `name`
- `slug`
- `description`
- `is_active`
- `created_at`
- `updated_at`

Valores iniciais por data migration:

- Processador
- Memoria RAM
- SSD
- HD
- Placa-mae
- Placa de video
- Fonte
- Bateria

### ServiceType

Catalogo estruturado de servicos/manutencoes.

Campos:

- `id`
- `name`
- `slug`
- `description`
- `category`
- `is_recurring`
- `recommended_interval_value`
- `recommended_interval_unit`
- `is_active`
- `created_at`
- `updated_at`

`recommended_interval_unit` usa `TextChoices`:

- `DAYS`
- `MONTHS`
- `YEARS`

Constraint:

- se `is_recurring = true`, `recommended_interval_value` deve existir e ser maior que zero;
- se `is_recurring = true`, `recommended_interval_unit` deve existir;
- se `is_recurring = false`, os campos de intervalo podem ficar nulos/em branco.

### ServiceCategory

Catalogo configuravel opcional para agrupar tipos de servico.

Campos:

- `id`
- `name`
- `slug`
- `description`
- `is_active`
- `created_at`
- `updated_at`

Valores iniciais por data migration:

- Preventiva
- Corretiva
- Software
- Hardware
- Backup

### Part

Catalogo de pecas/produtos.

Campos:

- `id`
- `name`
- `brand`
- `model`
- `category`
- `default_cost`
- `default_price`
- `is_active`
- `created_at`
- `updated_at`
- `deleted_at`

Soft delete faz sentido para nao remover pecas usadas em OSs antigas.

### PartCategory

Catalogo configuravel de categorias de peca.

Campos:

- `id`
- `name`
- `slug`
- `description`
- `is_active`
- `created_at`
- `updated_at`

Valores iniciais por data migration:

- Armazenamento
- Memoria
- Bateria
- Fonte
- Placa
- Periferico

### WorkOrder

Representa uma OS para exatamente um equipamento.

Campos:

- `id`
- `number`
- `customer`
- `equipment`
- `title`
- `problem_description`
- `status`
- `priority`
- `opened_at`
- `started_at`
- `completed_at`
- `cancelled_at`
- `diagnosis`
- `service_description`
- `solution`
- `internal_notes`
- `responsible_user`
- `created_at`
- `updated_at`

Constraints de banco:

- `started_at >= opened_at`;
- `completed_at >= opened_at`;
- `cancelled_at >= opened_at`;

Validacao de dominio:

- `WorkOrder.customer` deve ser o mesmo cliente de `WorkOrder.equipment`.
- status semanticamente concluido exige `completed_at`;
- status semanticamente cancelado exige `cancelled_at`;
- status ativo nao pode manter `completed_at` ou `cancelled_at`.

Validacao de banco:

- em PostgreSQL, trigger `work_order_customer_equipment_match` impede insert/update quando o cliente da OS diverge do cliente do equipamento;
- em SQLite local/testes, essa protecao de banco fica inativa e a regra e coberta pela validacao de dominio.

### WorkOrderStatusHistory

Timeline da OS.

Campos:

- `id`
- `work_order`
- `status`
- `changed_at`
- `changed_by`
- `comment`
- `description`
- `created_at`

Regras:

- tabela conceitualmente append-only;
- registros nao devem ser apagados normalmente;
- registros nao devem ser editados livremente;
- toda mudanca real de status deve criar um novo historico;
- ao criar uma OS, o primeiro evento de status e criado explicitamente no servico `create_work_order()`.

### WorkOrderStatus

Catalogo configuravel de status da OS.

Campos:

- `id`
- `name`
- `code`
- `description`
- `kind`
- `is_initial`
- `is_active`
- `sort_order`
- `created_at`
- `updated_at`

`kind` e um enum de sistema com:

- `active`
- `completed`
- `cancelled`

Essa propriedade centraliza a semantica do status. O codigo nao compara `name` nem `code` para decidir se uma OS esta concluida ou cancelada.

Regras:

- deve existir um unico status inicial;
- status de catalogo nao devem ser apagados quando usados;
- status antigos devem ser desativados com `is_active = False`;
- historico aponta para `WorkOrderStatus` com `PROTECT`.

Valores iniciais por data migration:

- Aberta
- Aguardando diagnostico
- Aguardando cliente
- Aguardando peca
- Em andamento
- Concluida
- Cancelada

### WorkOrderService

Servico realizado dentro de uma OS.

Campos:

- `id`
- `work_order`
- `service_type`
- `performed_at`
- `performed_by`
- `description`
- `notes`
- `labor_price`
- `voided_at`
- `voided_by`
- `void_reason`
- `created_at`
- `updated_at`

`WorkOrderService` nao possui `equipment_id`.

O equipamento e obtido por:

```text
WorkOrderService -> WorkOrder -> Equipment
```

Campos de invalidadacao foram incluidos desde ja porque servicos sao fonte de historico tecnico. Se um servico estiver errado, a regra futura deve invalidar o registro em vez de apaga-lo.

### WorkOrderPart

Peca utilizada em uma OS.

Campos:

- `id`
- `work_order`
- `work_order_service`
- `part`
- `installed_component`
- `description`
- `quantity`
- `unit_cost`
- `unit_price`
- `serial_number`
- `warranty_until`
- `voided_at`
- `voided_by`
- `void_reason`
- `created_at`
- `updated_at`

`WorkOrderPart` armazena snapshots de descricao, custo, preco, quantidade, serial e garantia. Mesmo que `Part` mude depois, a OS antiga preserva os dados usados no momento.

Campos `voided_*` tambem fazem sentido aqui porque pecas afetam historico tecnico e financeiro.

### WorkOrderBilling

Fechamento financeiro simples da OS.

Relacao:

```text
WorkOrder 1:0..1 WorkOrderBilling
```

Campos:

- `id`
- `work_order`
- `labor_total`
- `parts_total`
- `discount`
- `total_amount`
- `payment_status`
- `payment_method`
- `paid_at`
- `notes`
- `created_at`
- `updated_at`

Dinheiro usa `DecimalField`, nunca `float`.

Decisao: os totais ficam armazenados como snapshot de fechamento. Os itens detalhados continuam em `WorkOrderService` e `WorkOrderPart`. Isso evita recalcular OS antiga caso valores de catalogo mudem, mas nao transforma o sistema em ERP.

### PaymentMethod

Catalogo configuravel de formas de pagamento.

Campos:

- `id`
- `name`
- `slug`
- `description`
- `is_active`
- `created_at`
- `updated_at`

Valores iniciais por data migration:

- Dinheiro
- PIX
- Cartao de credito
- Cartao de debito
- Transferencia bancaria

## Enums de sistema e catalogos configuraveis

Enums de sistema mantidos:

- `CustomerStatus`: estado cadastral simples do cliente;
- `EquipmentStatus`: estado operacional com baixa volatilidade;
- `WorkOrderPriority`: prioridade ordenada usada pelo sistema;
- `WorkOrderStatusKind`: semantica interna do status da OS;
- `PaymentStatus`: situacao financeira com comportamento sistemico;
- `IntervalUnit`: unidade usada pela logica de calculo preventivo.

Catalogos configuraveis:

- `EquipmentType`
- `ComponentType`
- `ServiceCategory`
- `PartCategory`
- `PaymentMethod`
- `WorkOrderStatus`
- `ServiceType`

Catalogos configuraveis possuem `is_active`. Opcoes antigas devem ser desativadas, nao apagadas, especialmente quando ja aparecem em registros historicos.

## on_delete

Estrategia:

- `Customer` em `Equipment` e `WorkOrder`: `PROTECT`.
- `Equipment` em `WorkOrder`, `EquipmentComponent` e historico tecnico: `PROTECT`.
- `ServiceType` em `WorkOrderService`: `PROTECT`.
- `WorkOrderStatus` em `WorkOrder` e `WorkOrderStatusHistory`: `PROTECT`.
- Catalogos configuraveis usados por registros: `PROTECT`.
- `WorkOrder` em historicos, servicos, pecas e billing: `PROTECT`.
- `User` em registros historicos/operacionais: `SET_NULL`.
- `Part` em `WorkOrderPart`: `SET_NULL`, porque a linha da OS possui snapshot.
- `PaymentMethod` em `WorkOrderBilling`: `PROTECT`.
- `installed_component` em `WorkOrderPart`: `SET_NULL`.
- `source_work_order` em `EquipmentComponent`: `SET_NULL`.

Objetivo: preservar historico tecnico e financeiro, evitando perda silenciosa.

## Indices

Indices principais:

- `Customer.name`
- `Customer.status`
- `Customer.email`
- `Equipment.customer`
- `Equipment.equipment_type`
- `Equipment.status`
- `Equipment.serial_number`
- `Equipment.asset_tag`
- `WorkOrder.customer`
- `WorkOrder.equipment`
- `WorkOrder.status`
- `WorkOrder.opened_at`
- `WorkOrder.completed_at`
- `WorkOrderStatusHistory(work_order, changed_at)`
- `WorkOrderService(work_order, service_type, performed_at)`
- `WorkOrderService(service_type, performed_at)`
- `ServiceType.slug`
- `ServiceType.is_recurring`
- `WorkOrderPart.work_order`
- `WorkOrderPart.work_order_service`

Como `WorkOrderService` nao possui `equipment_id`, consultas de manutencao preventiva usam JOIN:

```text
Equipment
-> WorkOrder
-> WorkOrderService
-> ServiceType
```

## Ultima manutencao

A ultima execucao valida de um servico e calculada em `WorkOrderService`.

Regra atual para manutencao preventiva:

- considerar apenas `WorkOrderService` cuja `WorkOrder.status.kind = completed`;
- ignorar `WorkOrderService` com `voided_at` preenchido;
- ordenar por `performed_at DESC`;
- em empate, usar `created_at DESC`.

Consulta conceitual:

```text
WorkOrderService
where work_order.equipment = Equipment X
and service_type = ServiceType Y
and work_order.status.kind = completed
and voided_at is null
order by performed_at desc, created_at desc
```

## Proxima manutencao

Nao armazenar `next_due_at` inicialmente.

Calculo:

```text
ultima execucao valida + intervalo recomendado do ServiceType
```

Razoes:

- alteracao futura do intervalo;
- lancamento retroativo de OS;
- correcao de servico;
- invalidacao de servico;
- mudanca futura de regra.

## OS concluida

Regra arquitetural:

- uma OS concluida nao deve ser modificada livremente;
- servicos, pecas, diagnostico, solucao e datas importantes exigem regra explicita;
- a base atual prepara futura `AuditLog`;
- servicos e pecas incorretos devem ser invalidados, nao apagados.

O Django Admin foi configurado para reduzir o risco de alteracao acidental de OS concluida/cancelada:

- historico de status fica readonly e sem exclusao;
- inlines de servicos e pecas nao permitem adicao/alteracao quando a OS esta fechada;
- admins diretos de servicos, pecas e billing bloqueiam salvamento quando a OS esta fechada.

## Servicos de dominio

Arquivo:

```text
workorders/services.py
```

Funcoes iniciais:

- `create_work_order(...)`
- `change_work_order_status(...)`
- `complete_work_order(...)`
- `register_work_order_service(...)`
- `invalidate_work_order_service(...)`
- `invalidate_work_order_part(...)`
- `get_last_valid_maintenance(...)`
- `calculate_next_maintenance_due_at(...)`

Essas regras sao explicitas e testaveis. Signals nao sao usados para a criacao de historico de status.

## EquipmentMaintenancePlan futuro

Nao implementado agora.

Encaixe futuro:

```text
EquipmentMaintenancePlan

id
equipment
service_type
interval_value
interval_unit
is_active
created_at
updated_at
```

Ele permitiria sobrescrever o intervalo padrao de `ServiceType` para um equipamento especifico.

Exemplo:

- `ServiceType`: limpeza interna a cada 12 meses.
- `EquipmentMaintenancePlan`: PC da marcenaria com limpeza interna a cada 4 meses.

A arquitetura atual nao bloqueia essa evolucao porque a manutencao preventiva ja consulta `Equipment + ServiceType`.

## Diagrama ER textual

```text
Customer
1 ----- N Equipment

EquipmentType
1 ----- N Equipment

Customer
1 ----- N WorkOrder

Equipment
1 ----- N WorkOrder

Equipment
1 ----- N EquipmentComponent

ComponentType
1 ----- N EquipmentComponent

WorkOrder
1 ----- N WorkOrderStatusHistory

WorkOrderStatus
1 ----- N WorkOrder

WorkOrderStatus
1 ----- N WorkOrderStatusHistory

WorkOrder
1 ----- N WorkOrderService

ServiceCategory
1 ----- N ServiceType

ServiceType
1 ----- N WorkOrderService

WorkOrder
1 ----- N WorkOrderPart

WorkOrderService
1 ----- N WorkOrderPart

PartCategory
1 ----- N Part

Part
1 ----- N WorkOrderPart

WorkOrder
1 ----- 0..1 WorkOrderBilling

PaymentMethod
1 ----- N WorkOrderBilling

User
1 ----- N WorkOrder

User
1 ----- N WorkOrderStatusHistory

User
1 ----- N WorkOrderService
```

## Possiveis evolucoes futuras

Nao implementadas agora:

- DRF;
- frontend;
- autenticacao e permissoes avancadas;
- multiusuario com roles;
- anexos e fotos nas OSs;
- geracao de PDF da OS;
- assinatura do cliente;
- orcamento e aprovacao;
- envio por WhatsApp;
- notificacoes;
- manutencao preventiva automatizada;
- `EquipmentMaintenancePlan`;
- estoque;
- fornecedores;
- garantias avancadas;
- dashboards;
- IA;
- resumo automatico de historico;
- sugestao de diagnostico;
- deteccao de problemas recorrentes.
