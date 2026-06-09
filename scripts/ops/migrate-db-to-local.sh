#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/var/www/yayanews}"
DB_NAME="${DB_NAME:-yayanews}"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/infra/backups/single-server-migration}"
TS="$(date '+%Y%m%d_%H%M%S')"

APPS=(
  yaya-finnhub-ws
  yaya-pipeline-daemon
  yaya-worker-flash
  yaya-worker-articles
  yaya-admin
  yayanews
)

STOPPED=0
ENV_UPDATED=0

log() {
  echo "[$(date '+%F %T')] $*"
}

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
  if (idx < 0) continue;
  if (trimmed.slice(0, idx).trim() !== key) continue;
  let value = trimmed.slice(idx + 1).trim();
  value = value.replace(/^['\"]|['\"]$/g, '');
  process.stdout.write(value);
  process.exit(0);
}
process.exit(1);
" "$APP_DIR/.env" "$key"
}

restart_old_env_on_error() {
  local code=$?
  log "ERROR: migration failed before completion (exit=$code)"
  if [[ "$STOPPED" == "1" && "$ENV_UPDATED" == "0" ]]; then
    log "Restarting apps with the original DATABASE_URL..."
    for app in "${APPS[@]}"; do
      pm2 restart "$app" --update-env >/dev/null 2>&1 || pm2 start "$app" >/dev/null 2>&1 || true
    done
  fi
  exit "$code"
}
trap restart_old_env_on_error ERR

cd "$APP_DIR"
mkdir -p "$BACKUP_DIR"

CURRENT_URL="$(read_env_value DATABASE_URL)"
if [[ -z "$CURRENT_URL" ]]; then
  log "DATABASE_URL is empty; aborting"
  exit 1
fi

eval "$(
  DATABASE_URL="$CURRENT_URL" python3 - <<'PY'
import os
import shlex
from urllib.parse import urlparse, urlunparse, unquote

url = os.environ["DATABASE_URL"]
parsed = urlparse(url)
userinfo = parsed.netloc.rsplit("@", 1)[0] if "@" in parsed.netloc else ""
local_netloc = f"{userinfo}@127.0.0.1:5432" if userinfo else "127.0.0.1:5432"
local = parsed._replace(netloc=local_netloc)

values = {
    "DB_USER": unquote(parsed.username or ""),
    "DB_PASS": unquote(parsed.password or ""),
    "DB_NAME_FROM_URL": (parsed.path or "/").lstrip("/"),
    "CURRENT_HOST": parsed.hostname or "",
    "CURRENT_PORT": str(parsed.port or 5432),
    "LOCAL_URL": urlunparse(local),
}
for key, value in values.items():
    print(f"{key}={shlex.quote(value)}")
PY
)"

if [[ "$DB_NAME_FROM_URL" != "$DB_NAME" ]]; then
  log "DATABASE_URL database is '$DB_NAME_FROM_URL', expected '$DB_NAME'; aborting"
  exit 1
fi

log "Current database host: $CURRENT_HOST:$CURRENT_PORT"
log "Target local database host: 127.0.0.1:5432"
if [[ "$CURRENT_HOST" == "127.0.0.1" || "$CURRENT_HOST" == "localhost" ]]; then
  log "DATABASE_URL already points at local PostgreSQL; nothing to migrate."
  exit 0
fi

log "Checking source database counts..."
psql "$CURRENT_URL" -v ON_ERROR_STOP=1 -Atc \
  "select 'articles='||(select count(*) from articles)||' flash_news='||(select count(*) from flash_news)||' topics='||(select count(*) from topics)"

log "Creating/updating local PostgreSQL role without printing credentials..."
role_sql="$(
  DB_USER="$DB_USER" DB_PASS="$DB_PASS" python3 - <<'PY'
import os

def lit(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"

def ident(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'

user = os.environ["DB_USER"]
password = os.environ["DB_PASS"]
print("DO $$")
print("BEGIN")
print(f"  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = {lit(user)}) THEN")
print(f"    EXECUTE 'CREATE ROLE ' || quote_ident({lit(user)}) || ' LOGIN';")
print("  END IF;")
print("END $$;")
print(f"ALTER ROLE {ident(user)} WITH LOGIN PASSWORD {lit(password)};")
PY
)"
printf '%s\n' "$role_sql" | sudo -u postgres psql -v ON_ERROR_STOP=1 postgres >/dev/null

LOCAL_PRE_BACKUP="$BACKUP_DIR/${TS}_local_pre_migration_${DB_NAME}.sql.gz"
if sudo -u postgres psql -Atc "select 1 from pg_database where datname = '$DB_NAME'" postgres | grep -q '^1$'; then
  log "Backing up existing local database to $LOCAL_PRE_BACKUP"
  sudo -u postgres pg_dump --no-owner --no-acl "$DB_NAME" | gzip > "$LOCAL_PRE_BACKUP"
else
  log "No existing local database named $DB_NAME; skipping local pre-backup"
fi

log "Stopping application processes that can read/write the database..."
for app in "${APPS[@]}"; do
  pm2 stop "$app" >/dev/null || true
done
STOPPED=1

SOURCE_BACKUP="$BACKUP_DIR/${TS}_source_${CURRENT_HOST}_${DB_NAME}.sql.gz"
log "Dumping source database to $SOURCE_BACKUP"
pg_dump --no-owner --no-acl "$CURRENT_URL" | gzip > "$SOURCE_BACKUP"

log "Recreating local database owned by $DB_USER"
sudo -u postgres psql -v ON_ERROR_STOP=1 postgres -c \
  "select pg_terminate_backend(pid) from pg_stat_activity where datname = '$DB_NAME' and pid <> pg_backend_pid();" >/dev/null
sudo -u postgres dropdb --if-exists "$DB_NAME"
sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"

log "Pre-creating non-default extensions used by the source database, when available..."
mapfile -t EXTENSIONS < <(psql "$CURRENT_URL" -Atc "select extname from pg_extension where extname <> 'plpgsql' order by extname")
for ext in "${EXTENSIONS[@]}"; do
  [[ -z "$ext" ]] && continue
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS \"$ext\";" >/dev/null
done

log "Restoring dump into local PostgreSQL as postgres..."
gunzip -c "$SOURCE_BACKUP" | sudo -u postgres psql -d "$DB_NAME" -v ON_ERROR_STOP=1 >/dev/null

log "Granting restored database objects to $DB_USER"
grant_sql="$(
  DB_NAME="$DB_NAME" DB_USER="$DB_USER" python3 - <<'PY'
import os

def ident(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'

db = ident(os.environ["DB_NAME"])
user = ident(os.environ["DB_USER"])
print(f"ALTER SCHEMA public OWNER TO {user};")
print(f"GRANT ALL PRIVILEGES ON DATABASE {db} TO {user};")
print(f"GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO {user};")
print(f"GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO {user};")
print(f"GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO {user};")
print(f"ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO {user};")
print(f"ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO {user};")
print(f"ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON FUNCTIONS TO {user};")
PY
)"
printf '%s\n' "$grant_sql" | sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" >/dev/null

log "Verifying local database counts..."
SOURCE_COUNTS="$(psql "$CURRENT_URL" -v ON_ERROR_STOP=1 -Atc "select (select count(*) from articles)||','||(select count(*) from flash_news)||','||(select count(*) from topics)")"
LOCAL_COUNTS="$(psql "$LOCAL_URL" -v ON_ERROR_STOP=1 -Atc "select (select count(*) from articles)||','||(select count(*) from flash_news)||','||(select count(*) from topics)")"
log "source counts: $SOURCE_COUNTS"
log "local counts:  $LOCAL_COUNTS"
if [[ "$SOURCE_COUNTS" != "$LOCAL_COUNTS" ]]; then
  log "Count mismatch after restore; refusing to switch .env"
  exit 1
fi

ENV_BACKUP="$BACKUP_DIR/${TS}_pre_local_switch.env"
cp -p "$APP_DIR/.env" "$ENV_BACKUP"
log "Backed up .env to $ENV_BACKUP"

log "Switching DATABASE_URL in .env to 127.0.0.1:5432"
LOCAL_URL="$LOCAL_URL" node - <<'NODE'
const fs = require('fs');
const path = '.env';
const localUrl = process.env.LOCAL_URL;
const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/);
let replaced = false;
const next = lines.map((line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return line;
  const idx = line.indexOf('=');
  if (idx < 0) return line;
  if (line.slice(0, idx).trim() !== 'DATABASE_URL') return line;
  replaced = true;
  return `DATABASE_URL=${localUrl}`;
});
if (!replaced) {
  throw new Error('DATABASE_URL line not found');
}
fs.writeFileSync(path, next.join('\n'));
NODE
ENV_UPDATED=1

log "Restarting application processes with local DATABASE_URL..."
for app in "${APPS[@]}"; do
  pm2 restart "$app" --update-env >/dev/null
done

log "New DATABASE_URL target:"
node - <<'NODE'
const fs = require('fs');
const line = fs.readFileSync('.env', 'utf8').split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='));
const value = line.slice('DATABASE_URL='.length).replace(/^['"]|['"]$/g, '');
const url = new URL(value);
console.log(`host=${url.hostname} port=${url.port || 'default'} db=${url.pathname.slice(1)} user=${decodeURIComponent(url.username)}`);
NODE

log "Migration complete."
log "Source backup: $SOURCE_BACKUP"
log "Local pre-migration backup: $LOCAL_PRE_BACKUP"
log "Env backup: $ENV_BACKUP"
