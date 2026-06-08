#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/infra/backups}"
DB_NAME="${DB_NAME:-yayanews}"
KEEP_DAYS="${KEEP_DAYS:-30}"
KEEP_LATEST="${KEEP_LATEST:-10}"

read_env_value() {
    local key="$1"
    node -e "
const fs = require('fs');
const envPath = process.argv[1];
const key = process.argv[2];
const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx === -1) continue;
  const currentKey = trimmed.slice(0, idx).trim();
  if (currentKey !== key) continue;
  let value = trimmed.slice(idx + 1).trim();
  value = value.replace(/^['\"]|['\"]$/g, '');
  process.stdout.write(value);
  process.exit(0);
}
process.exit(1);
" "$APP_DIR/.env" "$key"
}

prune_backups() {
    find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +"$KEEP_DAYS" -delete 2>/dev/null || true
    find "$BACKUP_DIR" -maxdepth 1 -type f -name "*.sql.gz" -printf '%T@ %p\n' \
        | sort -rn \
        | awk -v keep="$KEEP_LATEST" 'NR > keep { sub(/^[^ ]+ /, ""); print }' \
        | while IFS= read -r file; do
            rm -f -- "$file"
        done
}

if [ ! -f "$APP_DIR/.env" ]; then
    echo "[$(date)] ERROR: missing $APP_DIR/.env"
    exit 1
fi

DB_CONN="$(read_env_value DATABASE_URL 2>/dev/null || true)"
if [ -z "$DB_CONN" ]; then
    echo "[$(date)] ERROR: DATABASE_URL is missing in $APP_DIR/.env"
    exit 1
fi

mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date '+%Y%m%d_%H%M%S')"
BACKUP_FILE="$BACKUP_DIR/${TIMESTAMP}_${DB_NAME}.sql.gz"

echo "[$(date)] Starting database backup: $DB_NAME"

if pg_dump "$DB_CONN" | gzip > "$BACKUP_FILE"; then
    SIZE="$(du -h "$BACKUP_FILE" | cut -f1)"
    echo "[$(date)] Backup complete: $(basename "$BACKUP_FILE") ($SIZE)"
else
    echo "[$(date)] ERROR: database backup failed"
    rm -f "$BACKUP_FILE"
    exit 1
fi

prune_backups

echo "[$(date)] Backup count: $(find "$BACKUP_DIR" -maxdepth 1 -type f -name '*.sql.gz' | wc -l)"
