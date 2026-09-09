# Observabilidade e logs de produção

## Objetivo

O TechTrack mantém observabilidade básica independente de fornecedor. Backend e Nginx escrevem em `stdout`/`stderr`, permitindo coleta por Docker, EasyPanel, Loki, ELK, Datadog, CloudWatch ou outra plataforma sem acoplamento no código.

## Request ID

Toda requisição que passa pelo Nginx de produção recebe um `X-Request-ID` gerado pelo próprio Nginx. O mesmo identificador é encaminhado ao Django e devolvido na resposta.

Chamadas diretas ao backend também recebem um request ID. Um valor recebido em `X-Request-ID` só é preservado quando contém caracteres seguros (`A-Z`, `a-z`, `0-9`, `.`, `_`, `-`) e no máximo 128 caracteres; valores inválidos são substituídos por um UUID aleatório.

Isso permite correlacionar, por exemplo:

```text
Nginx request_id=abc123
  -> Django request_id=abc123
```

## Logs do backend

Em produção, `OBSERVABILITY_JSON_LOGS=True` por padrão. Cada request de aplicação gera um evento JSON com metadados operacionais:

```json
{"timestamp":"2026-09-08T21:00:00.000Z","level":"INFO","logger":"techtrack.request","message":"HTTP request completed","request_id":"abc123","method":"GET","path":"/api/v1/customers/","status_code":200,"duration_ms":4.2}
```

O middleware registra apenas o caminho (`request.path`), nunca query string, cookies, corpo, Authorization header ou refresh token.

Configuração:

```dotenv
LOG_LEVEL=INFO
OBSERVABILITY_JSON_LOGS=True
OBSERVABILITY_LOG_HEALTH=False
```

`/api/health/` e `/api/ready/` recebem request ID normalmente, mas seus logs de request são suprimidos por padrão para evitar ruído de probes. Ative `OBSERVABILITY_LOG_HEALTH=True` somente quando precisar investigar esses checks.

Em desenvolvimento, logs estruturados ficam desabilitados por padrão para manter leitura humana no terminal.

## Liveness e readiness

Para monitoramento:

```text
/api/health/ -> processo Django vivo
/api/ready/  -> aplicacao pronta e PostgreSQL respondendo a SELECT 1
```

Use `/api/ready/` como alvo do monitor externo e de readiness da plataforma.

## Logs do Nginx

O Nginx usa JSON compacto em `stdout`, incluindo:

- timestamp;
- request ID;
- método;
- URI sem query string;
- status HTTP;
- bytes enviados;
- duração total;
- tempo do upstream.

Erros do Nginx seguem para `stderr`.

## Retenção local do Docker

`compose.prod.yaml` usa o driver `json-file` com rotação para evitar crescimento ilimitado em disco:

```dotenv
LOG_MAX_SIZE=10m
LOG_MAX_FILES=5
```

Esses valores são por container. Em uma plataforma que já centraliza logs, a política do host/plataforma continua sendo a fonte principal de retenção de longo prazo.

## Consultas operacionais

Logs de todos os serviços:

```bash
docker compose -f compose.prod.yaml logs -f
```

Somente backend:

```bash
docker compose -f compose.prod.yaml logs -f backend
```

Somente Nginx/frontend:

```bash
docker compose -f compose.prod.yaml logs -f frontend
```

Buscar um request ID específico:

```bash
docker compose -f compose.prod.yaml logs --no-log-prefix backend frontend | grep 'abc123'
```

## Privacidade

Não registre deliberadamente:

- senhas;
- JWTs;
- cookies;
- headers `Authorization`;
- tokens de reset;
- query strings com dados sensíveis;
- corpo completo de requests/responses.

Ao integrar um coletor externo, trate os logs como dados operacionais potencialmente sensíveis e aplique controle de acesso e retenção adequada.

## Escopo atual

Esta camada cobre logs, correlação e health/readiness. Métricas, tracing distribuído e error tracking dedicado podem ser adicionados depois apenas se houver necessidade operacional concreta.
