# Primeira mensalidade de contratos

Ao criar um contrato recorrente, o operador escolhe como tratar a primeira mensalidade:

- **Receber agora**: cria uma conta a receber da competencia inicial com vencimento na data do cadastro e registra um pagamento integral no metodo selecionado. A cobranca fica paga imediatamente.
- **Cobrar no proximo mes**: nao cria conta a receber no mes atual. A primeira competencia faturavel passa a ser o mes seguinte e usa o `billing_day` do contrato.

`ServiceAgreement.first_billing_competence` guarda o primeiro mes permitido para a geracao recorrente. Contratos antigos, nos quais esse campo e nulo, preservam o comportamento anterior e usam o mes de `starts_on` como ancora.

A restricao unica de `Receivable` por `service_agreement + competence` impede duplicacao da competencia recebida na entrada. O comando `generate_monthly_receivables` continua responsavel pelas competencias recorrentes seguintes e ignora meses anteriores a `first_billing_competence`.
