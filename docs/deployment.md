# Deploy, runtime offline e segurança operacional

## Objetivos

O TechTrack possui dois fluxos Docker distintos:

- `compose.yaml`: desenvolvimento local, com bind mounts, Django `runserver` e Vite;
- `compose.prod.yaml`: runtime de produção, sem bind mounts de código, com Gunicorn e Nginx.

A imagem do backend contém um virtualenv pronto em `/opt/venv`. O startup não executa mais `uv sync` nem baixa pacotes. Depois que as imagens necessárias estiverem construídas e presentes na máquina, a stack local pode iniciar sem acesso à internet.

## Desenvolvimento local

```bash
docker compose build
docker compose up -d
```

Depois de um build bem-sucedido, uma queda de internet não deve impedir um novo `docker compose up`, desde que as imagens Docker já estejam disponíveis localmente.

O arquivo `compose.offline.yaml` existe para validação automatizada. Ele conecta os serviços a uma rede Docker `internal`, sem rota de saída para a internet:

```bash
docker compose build
docker compose -f compose.yaml -f compose.offline.yaml up -d --no-build
```

Esse modo é usado no CI para garantir que backend, frontend e proxy da API iniciem sem downloads em runtime.

### O que ainda exige internet

A independência é de **runtime**, não de instalação inicial. Ainda exigem rede:

- primeiro `docker compose build`, se imagens/pacotes não estiverem em cache;
- atualização/rebuild de dependências;
- envio real de e-mail SMTP para recuperação de senha;
- qualquer integração externa adicionada futuramente.

Para uma instalação totalmente air-gapped seria necessário distribuir também as imagens Docker já construídas, por exemplo com `docker save`/`docker load`.

## Produção

A stack de produção usa:

- PostgreSQL 17;
- Django via Gunicorn;
- frontend compilado pelo Vite e servido pelo Nginx;
- proxy `/api/` do Nginx para o backend;
- código da aplicação embutido nas imagens, sem bind mounts;
- backend executado como usuário não-root (`uid 10001`).

Variáveis mínimas obrigatórias:

```dotenv
POSTGRES_PASSWORD=use-uma-senha-forte
DJANGO_SECRET_KEY=use-uma-chave-longa-e-aleatoria
DJANGO_ALLOWED_HOSTS=techtrack.seudominio.com,backend
FRONTEND_URL=https://techtrack.seudominio.com
```

Subida:

```bash
docker compose -f compose.prod.yaml build
docker compose -f compose.prod.yaml up -d
```

Por padrão o frontend é publicado na porta `8080`. Altere com `PROD_FRONTEND_PORT` quando necessário.

## Sessão JWT

O navegador não persiste mais JWTs em `localStorage` ou `sessionStorage`.

A sessão funciona em duas camadas:

1. o **access token** é retornado pelo login e mantido apenas em memória pelo frontend;
2. o **refresh token** é emitido em cookie `HttpOnly`, limitado ao path `/api/token/` e inacessível ao JavaScript.

Quando a página é recarregada, o frontend chama `POST /api/token/refresh/`. O backend lê o refresh token diretamente do cookie e devolve um novo access token. O corpo da requisição de refresh não aceita o refresh token como credencial alternativa.

O logout chama `POST /api/token/logout/`, remove o access token da memória e expira o cookie de refresh.

Configurações disponíveis:

```dotenv
AUTH_ACCESS_TOKEN_MINUTES=5
AUTH_REFRESH_TOKEN_DAYS=1
AUTH_REFRESH_COOKIE_NAME=techtrack_refresh
AUTH_REFRESH_COOKIE_SAMESITE=Lax
```

Em desenvolvimento, `AUTH_REFRESH_COOKIE_SECURE=False`. O `compose.prod.yaml` usa `AUTH_REFRESH_COOKIE_SECURE=True` por padrão e essa configuração deve permanecer ativa quando a aplicação estiver publicada via HTTPS.

A implantação desta mudança invalida intencionalmente as sessões antigas que ainda dependiam de tokens no `localStorage`. O frontend remove as chaves legadas e o usuário precisa autenticar novamente uma vez.

## HTTPS e reverse proxy

O cenário recomendado é terminar TLS no proxy da plataforma (Traefik, Caddy, Nginx externo, EasyPanel etc.) e encaminhar o tráfego para o container frontend.

A stack aceita `X-Forwarded-Proto`. Depois de confirmar que o proxy preserva corretamente o protocolo original, configure:

```dotenv
DJANGO_TRUST_X_FORWARDED_PROTO=True
DJANGO_USE_X_FORWARDED_HOST=True
DJANGO_SECURE_SSL_REDIRECT=True
DJANGO_SESSION_COOKIE_SECURE=True
DJANGO_CSRF_COOKIE_SECURE=True
DJANGO_CSRF_TRUSTED_ORIGINS=https://techtrack.seudominio.com
AUTH_REFRESH_COOKIE_SECURE=True
```

HSTS deve ser habilitado somente depois de HTTPS estar estável:

```dotenv
DJANGO_SECURE_HSTS_SECONDS=31536000
DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS=True
DJANGO_SECURE_HSTS_PRELOAD=False
```

Não habilite `HSTS_PRELOAD` sem entender as consequências de longo prazo para o domínio e subdomínios.

## Rate limiting de autenticação

Os endpoints públicos sensíveis possuem throttling DRF por IP:

```dotenv
THROTTLE_LOGIN_RATE=10/min
THROTTLE_TOKEN_REFRESH_RATE=30/min
THROTTLE_TOKEN_VERIFY_RATE=30/min
THROTTLE_PASSWORD_RESET_RATE=20/hour
THROTTLE_PASSWORD_RESET_CONFIRM_RATE=30/hour
```

Esses limites são uma barreira de aplicação. Em exposição pública, mantenha também rate limiting no reverse proxy/WAF quando disponível.

## Headers

Django aplica baseline de segurança incluindo `nosniff`, `DENY` para framing e política de referrer. O Nginx do frontend também envia:

- `X-Content-Type-Options: nosniff`;
- `X-Frame-Options: DENY`;
- `Referrer-Policy: same-origin`;
- `Permissions-Policy` desabilitando câmera, microfone e geolocalização.

## Próximos hardenings

A persistência de refresh JWT no navegador foi removida. Como evolução posterior de segurança de sessão, pode-se adicionar blacklist/rotação de refresh tokens para revogação server-side imediata, caso a aplicação passe a exigir esse nível de controle.

Também permanecem como etapas operacionais posteriores:

- política automatizada de backup/restore do PostgreSQL;
- observabilidade/logging de produção;
- regras de proteção obrigatória da branch `master` no GitHub.
