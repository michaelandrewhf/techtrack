# Modelagem de Dominio

Este documento foi substituido pela modelagem revisada em:

- [docs/domain-model.md](domain-model.md)

A referencia atual registra as decisoes vigentes:

- uma `WorkOrder` pertence exatamente a um `Equipment`;
- `WorkOrderService` nao possui `equipment_id`;
- tipos, categorias, metodos de pagamento e status da OS que precisam evoluir pelo negocio sao catalogos configuraveis;
- enums permanecem apenas para semanticas internas do sistema.
