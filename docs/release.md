# Release, deploy e rollback da V1

## Objetivo

Este runbook fecha o procedimento de publicacao do TechTrack sem acoplar o projeto a uma plataforma especifica. O codigo ja valida runtime de producao, readiness do PostgreSQL, backup/restore, headers, autenticacao, startup offline e logs correlacionados no CI.

As duas configuracoes deliberadamente externas ao repositorio sao:

1. infraestrutura do EasyPanel/reverse proxy (dominio, TLS, variaveis, scheduler/backup externo e monitoramento);
2. protecao obrigatoria da branch `master` no GitHub.

## Pre-requisitos para o primeiro deploy

Antes de publicar:

- a PR final deve estar mergeada em `master` com a workflow `Validation` verde;
- configure a protecao de `master` para exigir PR e a workflow `Validation`, bloquear force push e exclusao;
- configure dominio e HTTPS no EasyPanel;
- deixe o container frontend acessivel apenas pelo proxy confiavel; o Compose standalone usa `127.0.0.1` como bind padrao;
- configure todas as variaveis obrigatorias de producao;
- configure SMTP real e valide envio;
- configure backup automatico e copia off-site;
- configure um monitor externo consultando `/api/ready/`.

## Variaveis minimas de producao

Exemplo conceitual:

```dotenv
POSTGRES_DB=techtrack
POSTGRES_USER=techtrack
POSTGRES_PASSWORD=<senha-forte>
DJANGO_SECRET_KEY=<chave-longa-e-aleatoria>
DJANGO_ALLOWED_HOSTS=techtrack.seudominio.com,backend
DJANGO_CSRF_TRUSTED_ORIGINS=https://techtrack.seudominio.com
DJANGO_TRUST_X_FORWARDED_PROTO=True
DJANGO_USE_X_FORWARDED_HOST=True
DJANGO_SECURE_SSL_REDIRECT=True
DJANGO_SESSION_COOKIE_SECURE=True
DJANGO_CSRF_COOKIE_SECURE=True
AUTH_REFRESH_COOKIE_SECURE=True
FRONTEND_URL=https://techtrack.seudominio.com
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.zoho.com
EMAIL_PORT=587
EMAIL_HOST_USER=<usuario-smtp>
EMAIL_HOST_PASSWORD=<senha-smtp>
EMAIL_USE_TLS=True
EMAIL_USE_SSL=False
DEFAULT_FROM_EMAIL=TechTrack <techtrack@seudominio.com>
```

Com `TECHTRACK_PRODUCTION=True`, o backend falha no startup se detectar configuracao essencial ausente ou uma URL externa sem HTTPS/secure cookies.

## Health checks

Existem dois endpoints distintos:

```text
GET /api/health/  -> liveness do processo
GET /api/ready/   -> readiness, incluindo SELECT 1 no PostgreSQL
```

Use `/api/ready/` para monitoramento externo e readiness da plataforma.

## Procedimento de release

### 1. Confirmar o commit

```bash
git switch master
git pull origin master
git status
git log -1 --oneline
```

O working tree deve estar limpo e o commit deve ser exatamente o aprovado no CI.

### 2. Criar backup antes do deploy

Com a versao anterior ainda em execucao:

```bash
BACKUP_DIR=/srv/backups/techtrack bash scripts/postgres-backup.sh
```

Confirme a existencia do `.dump` e do `.sha256`.

### 3. Build e deploy

```bash
docker compose -f compose.prod.yaml build
docker compose -f compose.prod.yaml up -d
```

O backend executa `manage.py check --deploy` e migrations antes de iniciar o Gunicorn. Se a configuracao for invalida, o container deve falhar em vez de servir uma aplicacao parcialmente configurada.

### 4. Smoke test pos-deploy

Validar, nesta ordem:

```bash
curl -f https://techtrack.seudominio.com/api/health/
curl -f https://techtrack.seudominio.com/api/ready/
```

Depois validar manualmente:

- login e restauracao da sessao apos reload;
- logout;
- recuperacao de senha recebendo e-mail real;
- Dashboard;
- abrir cliente e equipamento;
- criar/editar uma OS de teste;
- criar um orcamento e gerar PDF;
- abrir Financeiro e registrar/invalidar um pagamento de teste quando aplicavel;
- conferir logs sem dados sensiveis.

### 5. Marcar a release

Somente depois do smoke real:

```bash
git tag -a v1.0.0 -m "TechTrack V1"
git push origin v1.0.0
```

Crie a GitHub Release a partir da mesma tag, registrando o commit implantado.

## Rollback de codigo

Se o problema estiver apenas na aplicacao e o schema do banco continuar compativel:

1. selecione a tag/commit anterior conhecido como bom;
2. gere novamente as imagens desse commit;
3. suba a stack;
4. valide `/api/health/` e `/api/ready/`;
5. execute o smoke principal.

Evite `git reset --hard` diretamente no servidor como estrategia de release. Prefira sempre um commit/tag conhecido e imagens reconstruiveis.

## Rollback com banco

Restaurar o banco e destrutivo e so deve ocorrer quando:

- uma migration ou operacao de dados tornou o schema/dados incompativeis com a versao anterior; ou
- houve corrupcao/alteracao de dados que nao pode ser corrigida de forma segura.

Fluxo:

```bash
bash scripts/postgres-restore.sh /srv/backups/techtrack/techtrack_YYYYMMDDTHHMMSSZ.dump --yes
```

O script valida checksum/archive, cria safety backup por padrao, para backend/frontend, restaura em transacao, reaplica migrations e so depois volta a subir a aplicacao.

## Backup externo e monitoramento

O mecanismo de backup esta no repositorio; agendamento e destino externo pertencem a infraestrutura. No EasyPanel/host configure:

- backup diario;
- retencao local de 14-30 dias;
- copia automatica criptografada para storage off-site;
- alerta quando o backup falhar;
- teste periodico de restore em ambiente isolado;
- monitor de uptime apontando para `/api/ready/`;
- alerta de disco/uso do volume PostgreSQL.

## Checklist de encerramento da V1

A V1 pode ser considerada publicada quando:

- `master` estiver protegida;
- dominio HTTPS estiver ativo no EasyPanel;
- as variaveis externas estiverem configuradas;
- `/api/ready/` estiver monitorado;
- SMTP estiver validado;
- backup off-site estiver automatizado;
- a workflow `Validation` estiver verde no commit implantado;
- smoke pos-deploy estiver concluido;
- a tag `v1.0.0` apontar para o commit implantado.
