#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

COMPOSE_FILE=${COMPOSE_FILE:-compose.prod.yaml}
BACKUP_DIR=${BACKUP_DIR:-backups}
BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-14}
BACKUP_PREFIX=${BACKUP_PREFIX:-techtrack}

if ! [[ "$BACKUP_RETENTION_DAYS" =~ ^[0-9]+$ ]]; then
  echo "BACKUP_RETENTION_DAYS must be a non-negative integer." >&2
  exit 2
fi

mkdir -p "$BACKUP_DIR"

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_name="${BACKUP_PREFIX}_${timestamp}.dump"
backup_path="${BACKUP_DIR%/}/${backup_name}"
tmp_path="${backup_path}.tmp"
checksum_path="${backup_path}.sha256"

cleanup_tmp() {
  rm -f "$tmp_path"
}
trap cleanup_tmp EXIT

compose=(docker compose -f "$COMPOSE_FILE")

echo "Creating PostgreSQL backup: $backup_path"
"${compose[@]}" exec -T db sh -eu -c '
  pg_dump \
    --username="$POSTGRES_USER" \
    --dbname="$POSTGRES_DB" \
    --format=custom \
    --compress=6 \
    --no-owner \
    --no-privileges
' > "$tmp_path"

if [[ ! -s "$tmp_path" ]]; then
  echo "Backup failed: generated dump is empty." >&2
  exit 1
fi

# Verify that PostgreSQL can parse the generated archive before publishing it.
"${compose[@]}" exec -T db pg_restore --list < "$tmp_path" >/dev/null

mv "$tmp_path" "$backup_path"
(
  cd "$BACKUP_DIR"
  sha256sum "$backup_name" > "${backup_name}.sha256"
)

# Retention only touches files produced by this script and their checksums.
find "$BACKUP_DIR" -maxdepth 1 -type f \
  \( -name "${BACKUP_PREFIX}_*.dump" -o -name "${BACKUP_PREFIX}_*.dump.sha256" \) \
  -mtime "+${BACKUP_RETENTION_DAYS}" -delete

trap - EXIT

echo "Backup completed: $backup_path"
echo "Checksum: $checksum_path"
