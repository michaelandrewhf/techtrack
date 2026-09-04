# Documentos de cliente

O TechTrack gera PDFs de Orcamento e Ordem de Servico a partir de snapshots de dados.

## Regra principal

A camada visual do PDF nao altera a regra de imutabilidade dos documentos emitidos.

Fluxo de emissao oficial:

```text
dados atuais -> snapshot -> GeneratedDocument(version/checksum) -> renderer PDF
```

Uma revisao historica e sempre renderizada a partir do snapshot persistido naquela versao. O renderer pode evoluir sem reconsultar o estado atual da entidade para reconstruir um documento antigo.

## Renderer

`config/pdf.py` contem um renderer A4 sem dependencia nativa adicional, com:

- cabecalho de documento;
- hierarquia tipografica;
- blocos de informacao;
- tabelas com quebra de pagina;
- totais destacados;
- observacoes;
- rodape com paginacao e revisao;
- identidade visual compartilhada entre Orcamento e OS.

Os dados especificos de cada documento continuam sendo montados em `quotes/services.py`.

## Orcamento

Estrutura atual:

1. identificacao, data, validade e status;
2. prestador;
3. cliente;
4. equipamento, quando definido;
5. solicitacao/escopo;
6. tabela de itens;
7. subtotal, desconto e total final;
8. observacoes;
9. rodape comercial.

## Ordem de Servico

Estrutura atual:

1. identificacao, abertura, conclusao, status e responsavel;
2. prestador;
3. cliente;
4. equipamento;
5. problema relatado, diagnostico, execucao e solucao;
6. servicos validos realizados;
7. pecas validas utilizadas;
8. resumo financeiro quando houver valores relevantes;
9. rodape comercial.

`internal_notes` nao faz parte do snapshot destinado ao documento e nao deve ser apresentado no PDF.

Lancamentos de servico ou peca invalidados tambem nao fazem parte do snapshot novo emitido. Documentos historicos ja emitidos continuam preservando exatamente o snapshot da sua versao.

## Previa e versoes

Previews usam o estado atual e recebem a marcacao `PREVIA` no rodape.

Emissoes oficiais recebem `vN`, onde `N` e a versao persistida em `GeneratedDocument`.
