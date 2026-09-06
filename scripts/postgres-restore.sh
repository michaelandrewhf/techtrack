#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

COMPOSE_FILE=${COMPOSE_FILE:-compose.prod.yaml}
RESTORE_RUN_MIGRATIONS=${RESTORE_RUN_MIGRATIONS:-true}
RESTORE_SAFETY_BACKUP=${RESTORE_SAFETY_BACKUP:-true}

usage() {
  cat <<'EOF'
Usage:
  bash scripts/postgres-restore.sh <backup.dump> --yes

The --yes flag is mandatory because restore is destructive. The application
services are stopped while the database is restored. By default a fresh safety
backup is created immediately before the restore.
EOF
}

if [[ $# -ne 2 || "$2" != "--yes" ]]; then
  usage >&2
  exit 2
fi

case "$RESTORE_SAFETY_BACKUP" in
  true|false) ;;
  *)
    echo "RESTORE_SAFETY_BACKUP must be true or false." >&2
    exit 2
    ;;
esac

case "$RESTORE_RUN_MIGRATIONS" in
  true|false) ;;
  *)
    echo "RESTORE_RUN_MIGRATIONS must be true or false." >&2
    exit 2
    ;;
esac

backup_path=$1
if [[ ! -f "$backup_path" ]]; then
  echo "Backup file not found: $backup_path" >&2
  exit 2
fi

backup_dir=$(cd "$(dirname "$backup_path")" && pwd)
backup_name=$(basename "$backup_path")
backup_path="${backup_dir}/${backup_name}"
checksum_path="${backup_path}.sha256"

if [[ -f "$checksum_path" ]]; then
  echo "Verifying backup checksum..."
  (
    cd "$backup_dir"
    sha256sum -c "${backup_name}.sha256"
  )
else
  echo "Warning: checksum file not found; continuing after archive validation." >&2
fi

compose=(docker compose -f "$COMPOSE_FILE")

# Validate the archive before touching the running application.
"${compose[@]}" exec -T db pg_restore --list < "$backup_path" >/dev/null

if [[ "$RESTORE_SAFETY_BACKUP" == "true" ]]; then
  echo "Creating pre-restore safety backup..."
  COMPOSE_FILE="$COMPOSE_FILE" bash "$(dirname "$0")/postgres-backup.sh"
fi

echo "Stopping application services..."
"${compose[@]}" stop frontend backend

restore_failed() {
  echo "Restore failed. frontend/backend remain stopped to avoid serving a partially restored database." >&2
  echo "Inspect PostgreSQL logs and retry from a known-good backup before restarting the application." >&2
}
trap restore_failed ERR

echo "Restoring PostgreSQL database from: $backup_path"
"${compose[@]}" exec -T db sh -eu -c '
  pg_restore \
    --username="$POSTGRES_USER" \
    --dbname="$POSTGRES_DB" \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    --exit-on-error
' < "$backup_path"

if [[ "$RESTORE_RUN_MIGRATIONS" == "true" ]]; then
  echo "Applying migrations after restore..."
  "${compose[@]}" run --rm --no-deps backend python manage.py migrate --noinput
fi

echo "Starting application services..."
"${compose[@]}" up -d backend frontend

trap - ERR

echo "Restore completed successfully."
