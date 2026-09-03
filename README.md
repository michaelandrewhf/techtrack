# TechTrack

TechTrack e uma base Django para gerenciamento de clientes de suporte e manutencao de TI, com foco inicial em modelagem de dominio e banco de dados.

Esta etapa implementa apenas a base de dominio:

- clientes;
- equipamentos;
- componentes;
- ordens de servico;
- historico de status;
- servicos realizados;
- pecas utilizadas;
- fechamento financeiro simples;
- regras de manutencao preventiva calculadas pelo historico.

Nao ha DRF, frontend, Celery, Redis, IA ou Docker nesta fase.

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
```

## Modelo de dominio resumido

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

WorkOrder
1 ----- 0..1 WorkOrderBilling

PaymentMethod
1 ----- N WorkOrderBilling
```

Decisoes importantes:

- uma `WorkOrder` pertence exatamente a um `Equipment`;
- `WorkOrder.equipment` e obrigatorio;
- `WorkOrder.customer` e mantido explicitamente;
- `WorkOrderService` nao possui `equipment_id`;
- ultima e proxima manutencao sao calculadas pelo historico de `WorkOrderService`;
- servicos de OS nao concluida nao contam para preventiva;
- servicos invalidados nao contam para preventiva;
- tipos de equipamento, tipos de componente, categorias, metodos de pagamento e status da OS sao catalogos configuraveis;
- dinheiro usa `DecimalField`, nunca `float`.

Veja a documentacao completa em [docs/domain-model.md](docs/domain-model.md).

Para padroes de consulta, indices e prevencao de N+1, veja [docs/query-performance.md](docs/query-performance.md).

## Requisitos

- Python 3.13+
- uv 0.10+
- Django 5.2.x
- PostgreSQL para uso real
- SQLite pode ser usado para desenvolvimento local simples e testes iniciais

## Configuracao local

Instale as dependencias e sincronize o ambiente com `uv`:

```bash
uv sync
```

O `uv` cria e gerencia `.venv` automaticamente. O fluxo oficial do projeto usa `uv run`, sem depender de ativar o ambiente manualmente.

O TechTrack e configurado como um projeto uv `no-package`: ele e uma aplicacao Django web, nao uma biblioteca Python para publicacao. Por isso nao ha `src/`, `build-system` nem instalacao do proprio projeto dentro do virtualenv.

Copie o exemplo de ambiente se quiser usar variaveis locais:

```bash
cp .env.example .env
```

O projeto usa SQLite quando `DATABASE_URL` nao esta definido.

Para PostgreSQL, defina:

```bash
DATABASE_URL=postgresql://usuario:senha@localhost:5432/techtrack
```

## Dependencias

Adicionar dependencia de producao:

```bash
uv add pacote
```

Adicionar dependencia de desenvolvimento:

```bash
uv add --dev pacote
```

As dependencias ficam declaradas em `pyproject.toml`, e a resolucao reproduzivel fica em `uv.lock`.

## Variaveis de ambiente

- `DJANGO_SECRET_KEY`: chave secreta do Django.
- `DJANGO_DEBUG`: `True` ou `False`.
- `DJANGO_ALLOWED_HOSTS`: hosts separados por virgula.
- `DATABASE_URL`: URL PostgreSQL. Se ausente, usa SQLite local.

O valor padrao de `DJANGO_SECRET_KEY` existe apenas para desenvolvimento local com `DJANGO_DEBUG=True`. Com `DJANGO_DEBUG=False`, a aplicacao exige `DJANGO_SECRET_KEY` configurado.

## Migrations

```bash
uv run python manage.py migrate
```

Verificar se ha migrations pendentes:

```bash
uv run python manage.py makemigrations --check --dry-run
```

## Superuser

```bash
uv run python manage.py createsuperuser
```

## Servidor local

```bash
uv run python manage.py runserver
```

## Testes

```bash
uv run pytest
```

## Checks

```bash
uv run python manage.py check
```

## Ruff

```bash
uv run ruff check .
uv run ruff format --check .
```

## Observacoes de seguranca e historico

- `WorkOrderStatusHistory` e conceitualmente append-only.
- `WorkOrderService` e `WorkOrderPart` possuem campos `voided_*` para invalidar registros sem apagar historico.
- FKs historicas usam `PROTECT` ou `SET_NULL` de forma seletiva.
- OS concluida nao deve ser modificada livremente por fluxos comuns.
