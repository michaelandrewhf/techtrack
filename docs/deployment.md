# Deploy, runtime offline e seguranca operacional

## Objetivos

O TechTrack possui dois fluxos Docker distintos:

- `compose.yaml`: desenvolvimento local, com bind mounts, Django `runserver` e Vite;
- `compose.prod.yaml`: runtime de producao, sem bind mounts de codigo, com Gunicorn e Nginx.

A imagem do backend contem um virtualenv pronto em `/opt/venv`. O startup nao executa `uv sync` nem baixa pacotes. Depois que as imagens estiverem construidas e presentes na maquina, a stack local pode iniciar sem acesso a internet.

## Desenvolvimento e runtime offline

```bash
docker compose build
docker compose up -d
```

O arquivo `compose.offline.yaml` conecta os servicos a uma rede Docker `internal`, sem rota de saida para a internet. O CI sobe as imagens pre-construidas nesse modo e valida backend, frontend e proxy da API usando `/api/ready/`.

Ainda exigem internet:

- primeiro build se imagens/pacotes nao estiverem em cache;
- atualizacao de dependencias;
- envio SMTP real;
- integracoes externas futuras.

## Stack de producao

A stack usa:

```text
PostgreSQL 17
     |
Django + Gunicorn
     |
Nginx nao-root + SPA React compilada
```

Caracteristicas:

- nenhum bind mount de codigo;
- backend executado como UID `10001`;
- Nginx executado como usuario nao-root e escuta internamente em `8080`;
- proxy `/api/` para o backend;
- logs JSON correlacionados por request ID;
- backup/restore PostgreSQL testados no CI;
- frontend publicado em loopback (`127.0.0.1`) por padrao no Compose standalone;
- CSP e headers basicos de seguranca;
- validacao fail-fast das configuracoes essenciais quando `TECHTRACK_PRODUCTION=True`.

Subida standalone:

```bash
docker compose -f compose.prod.yaml build
docker compose -f compose.prod.yaml up -d
```

## PostgreSQL sem DATABASE_URL em producao

A stack de producao passa credenciais em campos separados:

```dotenv
POSTGRES_DB=techtrack
POSTGRES_USER=techtrack
POSTGRES_PASSWORD=<senha-forte>
POSTGRES_HOST=db
POSTGRES_PORT=5432
```

Isso evita que caracteres reservados como `@`, `/`, `?`, `#` ou `:` em uma senha forte alterem o parsing de uma connection string.

`DATABASE_URL` continua suportada em desenvolvimento e CI para compatibilidade.

## Configuracao fail-fast

`compose.prod.yaml` define `TECHTRACK_PRODUCTION=True`. Nesse modo o Django recusa startup quando detectar, entre outros:

- `DJANGO_DEBUG=True`;
- hosts vazios ou `*`;
- credenciais PostgreSQL ausentes;
- `FRONTEND_URL` invalida;
- producao externa sem HTTPS;
- secure cookies desabilitados em dominio externo;
- `DJANGO_CSRF_TRUSTED_ORIGINS` sem a origem do frontend;
- SMTP selecionado sem usuario/senha/remetente;
- TLS e SSL SMTP habilitados simultaneamente.

O container tambem executa:

```bash
python manage.py check --deploy
```

antes das migrations e do Gunicorn.

## Liveness e readiness

Os checks tem papeis diferentes:

```text
GET /api/health/ -> confirma que o processo Django responde
GET /api/ready/  -> executa SELECT 1 e confirma que o PostgreSQL esta acessivel
```

O healthcheck do container backend usa `/api/ready/`. Para monitoramento externo, use tambem `/api/ready/`.

## HTTPS e EasyPanel

O cenario recomendado e:

```text
Internet
   |
EasyPanel / Traefik com HTTPS
   |
Nginx TechTrack (rede privada / porta interna 8080)
   |
Django
```

O Compose standalone publica o frontend em:

```text
127.0.0.1:8080 -> container:8080
```

Ajustes disponiveis:

```dotenv
PROD_BIND_ADDRESS=127.0.0.1
PROD_FRONTEND_PORT=8080
```

Nao exponha a porta HTTP raw publicamente em paralelo ao proxy HTTPS.

Para dominio real configure no EasyPanel:

```dotenv
DJANGO_ALLOWED_HOSTS=techtrack.seudominio.com,backend
DJANGO_CSRF_TRUSTED_ORIGINS=https://techtrack.seudominio.com
DJANGO_TRUST_X_FORWARDED_PROTO=True
DJANGO_USE_X_FORWARDED_HOST=True
DJANGO_SECURE_SSL_REDIRECT=True
DJANGO_SESSION_COOKIE_SECURE=True
DJANGO_CSRF_COOKIE_SECURE=True
AUTH_REFRESH_COOKIE_SECURE=True
FRONTEND_URL=https://techtrack.seudominio.com
```

HSTS deve ser habilitado somente depois de HTTPS estar validado:

```dotenv
DJANGO_SECURE_HSTS_SECONDS=31536000
DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS=True
DJANGO_SECURE_HSTS_PRELOAD=False
```

## Sessao JWT

O navegador nao persiste JWT em `localStorage` ou `sessionStorage`.

- access token: apenas memoria;
- refresh token: cookie `HttpOnly`, limitado a `/api/token/`;
- reload: `POST /api/token/refresh/` restaura o access em memoria;
- logout: expira o cookie e limpa o access.

Defaults:

```dotenv
AUTH_ACCESS_TOKEN_MINUTES=5
AUTH_REFRESH_TOKEN_DAYS=1
AUTH_REFRESH_COOKIE_NAME=techtrack_refresh
AUTH_REFRESH_COOKIE_SAMESITE=Lax
```

## SMTP e recuperacao de senha

Em producao o Compose exige explicitamente:

```dotenv
EMAIL_HOST_USER=...
EMAIL_HOST_PASSWORD=...
DEFAULT_FROM_EMAIL=TechTrack <techtrack@seudominio.com>
FRONTEND_URL=https://techtrack.seudominio.com
```

Quando `EMAIL_BACKEND` e SMTP, o backend tambem valida essas configuracoes no startup. Depois do deploy, teste um reset de senha real para confirmar DNS, credenciais e entrega.

## Rate limiting

Endpoints publicos sensiveis possuem throttling DRF:

```dotenv
THROTTLE_LOGIN_RATE=10/min
THROTTLE_TOKEN_REFRESH_RATE=30/min
THROTTLE_TOKEN_VERIFY_RATE=30/min
THROTTLE_PASSWORD_RESET_RATE=20/hour
THROTTLE_PASSWORD_RESET_CONFIRM_RATE=30/hour
```

Em exposicao publica, complemente no reverse proxy/WAF quando disponivel.

## Headers e CSP

O Nginx envia:

- `X-Content-Type-Options: nosniff`;
- `X-Frame-Options: DENY`;
- `Referrer-Policy: same-origin`;
- `Permissions-Policy` com camera/microfone/geolocalizacao desabilitados;
- `Content-Security-Policy` restrita a recursos da propria aplicacao, sem objetos e sem framing.

## Backup e restore

```bash
bash scripts/postgres-backup.sh
bash scripts/postgres-restore.sh /caminho/backup.dump --yes
```

Backups locais usam `pg_dump` custom, checksum SHA-256, validacao e retencao. `backups/`, `*.dump` e `*.dump.sha256` sao excluidos tanto do Git quanto do contexto Docker para impedir que dados do banco sejam incorporados em imagens durante rebuilds.

Consulte [backups.md](backups.md). Agendamento, copia off-site e alertas pertencem a infraestrutura do EasyPanel/host.

## Observabilidade

Backend e Nginx escrevem em `stdout`/`stderr` com request ID correlacionado. Query strings, cookies, Authorization e bodies nao fazem parte dos access logs estruturados.

Consulte [observability.md](observability.md).

## Release e rollback

O procedimento final esta em [release.md](release.md). Ele cobre:

- backup pre-deploy;
- build/deploy;
- smoke real;
- tag `v1.0.0`;
- rollback de codigo;
- restore do banco quando realmente necessario.

## Pendencias deliberadamente externas

Depois do hardening do repositorio, permanecem apenas:

1. **EasyPanel/infraestrutura:** dominio, TLS, variaveis, SMTP real, scheduler de backup, copia off-site e monitor de `/api/ready/`;
2. **GitHub:** proteger `master` exigindo Pull Request + workflow `Validation`, bloqueando force push e exclusao.

Esses itens nao exigem nova modelagem ou alteracao funcional no TechTrack.
