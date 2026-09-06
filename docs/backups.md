# Backup e restore do PostgreSQL

## Objetivo

O TechTrack usa PostgreSQL como banco principal. Os scripts em `scripts/` fornecem um fluxo operacional reproduzivel para:

- gerar dumps em formato custom do PostgreSQL;
- validar o arquivo antes de publica-lo como backup concluido;
- gerar checksum SHA-256;
- aplicar retencao local configuravel;
- restaurar de forma explicita e destrutiva, com parada do frontend/backend;
- executar migrations depois do restore;
- validar o procedimento no CI.

Nenhum backup e armazenado dentro do container ou do volume do PostgreSQL. O destino padrao e `./backups/` no host.

## Criar backup

Com a stack de producao em execucao:

```bash
bash scripts/postgres-backup.sh
```

Defaults:

```text
COMPOSE_FILE=compose.prod.yaml
BACKUP_DIR=backups
BACKUP_RETENTION_DAYS=14
BACKUP_PREFIX=techtrack
```

Exemplo usando um diretorio fora do repositorio:

```bash
BACKUP_DIR=/srv/backups/techtrack \
BACKUP_RETENTION_DAYS=30 \
bash scripts/postgres-backup.sh
```

A saida possui dois arquivos:

```text
techtrack_20260906T190000Z.dump
techtrack_20260906T190000Z.dump.sha256
```

O dump usa o formato `custom` do `pg_dump`, permitindo validacao com `pg_restore --list` e restore seletivo se necessario. Os arquivos sao criados sob `umask 077` para evitar leitura por outros usuarios do host por padrao.

## Restaurar

Restore e destrutivo e exige `--yes` explicitamente:

```bash
bash scripts/postgres-restore.sh /srv/backups/techtrack/techtrack_20260906T190000Z.dump --yes
```

Fluxo:

1. valida SHA-256 quando o arquivo `.sha256` esta presente;
2. valida se `pg_restore` consegue ler o archive;
3. cria um backup de seguranca imediatamente antes do restore;
4. para `frontend` e `backend`;
5. restaura com `--clean --if-exists --exit-on-error`;
6. executa `python manage.py migrate --noinput` usando a imagem atual;
7. sobe novamente `backend` e `frontend`.

Se o restore falhar depois da parada da aplicacao, os servicos permanecem parados deliberadamente para evitar que uma base parcialmente restaurada seja servida aos usuarios.

Para um restore controlado em CI ou em um procedimento onde um backup de seguranca ja foi criado:

```bash
RESTORE_SAFETY_BACKUP=false \
bash scripts/postgres-restore.sh backup.dump --yes
```

A opcao `RESTORE_RUN_MIGRATIONS=false` existe apenas para procedimentos especiais em que migrations serao tratadas manualmente.

## Agendamento

O script nao inclui um daemon de cron dentro da stack. Isso evita adicionar outro servico com privilegios sobre o banco e mantem a politica de agendamento no host/plataforma.

Exemplo de cron diario as 02:15:

```cron
15 2 * * * cd /srv/techtrack && BACKUP_DIR=/srv/backups/techtrack BACKUP_RETENTION_DAYS=30 bash scripts/postgres-backup.sh >> /var/log/techtrack-backup.log 2>&1
```

Em EasyPanel ou outra plataforma, prefira o scheduler nativo executando o mesmo comando.

## Retencao e copia externa

A retencao local protege contra crescimento ilimitado de disco, mas **backup no mesmo host nao e estrategia completa de recuperacao de desastre**.

Recomendacao minima:

- backups diarios locais;
- retencao local entre 14 e 30 dias;
- copia automatica para storage externo/off-site;
- criptografia do storage externo;
- teste periodico de restore;
- monitoramento do ultimo backup bem-sucedido e do espaco em disco.

Credenciais, dados de clientes e historico financeiro podem existir no dump. Trate o arquivo como dado sensivel.

## Validacao

A pipeline de producao executa um smoke test real de backup/restore em uma base efemera. O teste cria um marcador, gera o dump, altera o marcador, restaura o dump e confirma que o valor original voltou.

Esse teste valida o mecanismo, mas nao substitui restores periodicos de backups reais em um ambiente isolado.
