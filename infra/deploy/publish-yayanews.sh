#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
LOG_FILE="$(cd "$(dirname "$0")" && pwd)/deploy.log"
BACKUP_DIR="$(cd "$(dirname "$0")/.." && pwd)/backups"
WEB_HEALTH_URL="http://127.0.0.1:3002"
ADMIN_HEALTH_URL="http://127.0.0.1:3003/admin"
HEARTBEAT_FILE="$APP_DIR/apps/pipeline/data/daemon_heartbeat.txt"
HEALTH_RETRIES=10
HEALTH_INTERVAL=3
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
BACKUP_KEEP_LATEST="${BACKUP_KEEP_LATEST:-5}"
REQUIRE_DB_BACKUP="${REQUIRE_DB_BACKUP:-1}"
CLEAN_NEXT_CACHE_BEFORE_DEPLOY="${CLEAN_NEXT_CACHE_BEFORE_DEPLOY:-1}"
MIN_FREE_MB="${MIN_FREE_MB:-3072}"
ALLOW_DIRTY_DEPLOY="${ALLOW_DIRTY_DEPLOY:-0}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo -e "$msg"
    echo "$msg" >> "$LOG_FILE"
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

assert_http_ready() {
    local name="$1"
    local url="$2"
    local code

    for i in $(seq 1 "$HEALTH_RETRIES"); do
        sleep "$HEALTH_INTERVAL"
        code=$(curl -s -o /dev/null -w "%{http_code}" "$url" || echo "000")
        case "$code" in
            200|301|302|307|308)
                log "   ${GREEN}${name} ready${NC} (HTTP $code, attempt $i/$HEALTH_RETRIES)"
                return 0
                ;;
        esac
        log "   ${YELLOW}Waiting for ${name}${NC} (HTTP $code, attempt $i/$HEALTH_RETRIES)"
    done

    log "${RED}${name} health check failed${NC}: $url"
    return 1
}

assert_pm2_online() {
    pm2 jlist | node -e "
const fs = require('fs');
const apps = JSON.parse(fs.readFileSync(0, 'utf8'));
const expected = process.argv.slice(1);
const failures = [];
for (const name of expected) {
  const match = apps.find(app => app.name === name);
  const status = match?.pm2_env?.status;
  if (!match || status !== 'online') {
    failures.push(\`\${name}:\${status || 'missing'}\`);
  }
}
if (failures.length) {
  console.error(failures.join(', '));
  process.exit(1);
}
" "$@"
}

assert_pipeline_enabled() {
    if [ ! -f "$APP_DIR/.env" ]; then
        log "${RED}.env is missing; production deploy cannot validate pipeline workers${NC}"
        exit 1
    fi

    local enabled
    enabled="$(read_env_value ENABLE_PYTHON_WORKERS 2>/dev/null || true)"
    if [ "$enabled" != "true" ]; then
        log "${RED}ENABLE_PYTHON_WORKERS must be true in production deploys${NC}"
        exit 1
    fi
}

resolve_python_bin() {
    local configured
    configured="$(read_env_value PYTHON_BIN 2>/dev/null || true)"

    if [ -n "$configured" ]; then
        if [ ! -x "$configured" ]; then
            log "${RED}Configured PYTHON_BIN is not executable${NC}: $configured"
            exit 1
        fi
        printf '%s' "$configured"
        return 0
    fi

    if [ -x "$APP_DIR/apps/pipeline/.venv/bin/python" ]; then
        printf '%s' "$APP_DIR/apps/pipeline/.venv/bin/python"
        return 0
    fi

    if command -v python3 >/dev/null 2>&1; then
        command -v python3
        return 0
    fi

    log "${RED}No Python interpreter found; set PYTHON_BIN or create apps/pipeline/.venv${NC}"
    exit 1
}

assert_recent_heartbeat() {
    local previous_ts="$1"
    local current_ts

    for i in $(seq 1 "$HEALTH_RETRIES"); do
        sleep "$HEALTH_INTERVAL"
        if [ -f "$HEARTBEAT_FILE" ]; then
            current_ts=$(stat -c %Y "$HEARTBEAT_FILE" 2>/dev/null || echo 0)
            if [ "$current_ts" -gt "$previous_ts" ]; then
                log "   ${GREEN}Pipeline heartbeat updated${NC} (attempt $i/$HEALTH_RETRIES)"
                return 0
            fi
        fi
        log "   ${YELLOW}Waiting for pipeline heartbeat${NC} (attempt $i/$HEALTH_RETRIES)"
    done

    log "${RED}Pipeline heartbeat did not refresh${NC}: $HEARTBEAT_FILE"
    return 1
}

assert_disk_space() {
    local free_mb
    free_mb=$(df -Pm "$APP_DIR" | awk 'NR == 2 { print $4 }')
    if [ "${free_mb:-0}" -lt "$MIN_FREE_MB" ]; then
        log "${RED}Insufficient disk space${NC}: ${free_mb:-0}MB free, require ${MIN_FREE_MB}MB"
        exit 1
    fi
    log "   ${GREEN}Disk preflight OK${NC}: ${free_mb}MB free"
}

assert_clean_worktree() {
    if [ "$ALLOW_DIRTY_DEPLOY" = "1" ]; then
        log "${YELLOW}ALLOW_DIRTY_DEPLOY=1; skipping worktree cleanliness check${NC}"
        return 0
    fi

    if [ -n "$(git status --porcelain)" ]; then
        local snapshot_dir
        snapshot_dir="$(bash "$APP_DIR/infra/scripts/snapshot-worktree.sh")"
        log "${RED}Git worktree is dirty; aborting deploy to avoid overwriting production changes${NC}"
        log "${YELLOW}Snapshot saved to: $snapshot_dir${NC}"
        log "${YELLOW}Review and commit/stash those changes, or rerun with ALLOW_DIRTY_DEPLOY=1 if intentional.${NC}"
        exit 1
    fi
}

prune_backups() {
    local dir="$1"
    [ -d "$dir" ] || return 0

    find "$dir" -type f -name "*.sql.gz" -mtime +"$BACKUP_RETENTION_DAYS" -delete 2>/dev/null || true
    find "$dir" -maxdepth 1 -type f -name "*.sql.gz" -printf '%T@ %p\n' \
        | sort -rn \
        | awk -v keep="$BACKUP_KEEP_LATEST" 'NR > keep { sub(/^[^ ]+ /, ""); print }' \
        | while IFS= read -r file; do
            rm -f -- "$file"
        done
}

backup_database() {
    local backup_file="$1"
    local database_url

    database_url="$(read_env_value DATABASE_URL 2>/dev/null || true)"
    if [ -z "$database_url" ]; then
        rm -f "$backup_file"
        log "${YELLOW}   DATABASE_URL is missing; skipping database backup${NC}"
        return 1
    fi

    if pg_dump --no-owner --no-acl "$database_url" 2>/dev/null | gzip > "$backup_file"; then
        log "   ${GREEN}Backup complete${NC}: $(basename "$backup_file") ($(du -h "$backup_file" | cut -f1))"
        return 0
    fi

    rm -f "$backup_file"
    log "${YELLOW}   Database backup failed; continuing deploy${NC}"
    return 1
}

cd "$APP_DIR"
mkdir -p "$BACKUP_DIR"
DEPLOY_START=$(date +%s)
CURRENT_COMMIT=$(git rev-parse --short HEAD)
PREV_COMMIT=$(git rev-parse --short HEAD~1 2>/dev/null || echo "none")
PREVIOUS_HEARTBEAT_TS=$(stat -c %Y "$HEARTBEAT_FILE" 2>/dev/null || echo 0)
CORE_PM2_APPS=(yayanews yaya-admin yaya-ws-gateway)
PYTHON_PM2_APPS=(yaya-finnhub-ws yaya-pipeline-daemon yaya-worker-flash yaya-worker-articles)

log "${GREEN}Starting deploy${NC} commit=$CURRENT_COMMIT"
assert_clean_worktree
assert_disk_space

log "Backing up database..."
BACKUP_FILE="$BACKUP_DIR/$(date '+%Y%m%d_%H%M%S')_pre_deploy.sql.gz"
if ! backup_database "$BACKUP_FILE"; then
    if [ "$REQUIRE_DB_BACKUP" = "1" ]; then
        log "${RED}Database backup is required; aborting deploy${NC}"
        exit 1
    fi
fi
prune_backups "$BACKUP_DIR"

assert_pipeline_enabled

log "Installing dependencies..."
unset NODE_ENV
export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://yayanews.cryptooptiontool.com}"
if [ -f package-lock.json ]; then
    npm ci --include=dev
else
    npm install
fi

if [ ! -f apps/pipeline/requirements.txt ]; then
    log "${RED}Missing apps/pipeline/requirements.txt${NC}"
    exit 1
fi
PYTHON_BIN="$(resolve_python_bin)"
"$PYTHON_BIN" -m pip install -q -r apps/pipeline/requirements.txt
log "   ${GREEN}Dependencies ready${NC}"

log "Running database init..."
npm run db:init
log "Running database migrations..."
npm run db:migrate

log "Building workspaces..."
export NODE_ENV=production
if [ "$CLEAN_NEXT_CACHE_BEFORE_DEPLOY" = "1" ]; then
    rm -rf apps/web/.next/cache apps/admin/.next/cache .next/cache .turbo 2>/dev/null || true
fi
assert_disk_space
npm run build
mkdir -p apps/web/.next/standalone/.next
mkdir -p apps/admin/.next/standalone/.next
cp -r apps/web/public apps/web/.next/standalone/public
cp -r apps/web/.next/static apps/web/.next/standalone/.next/static
cp -r apps/admin/.next/static apps/admin/.next/standalone/.next/static 2>/dev/null || true
log "   ${GREEN}Build complete${NC}"

log "Running schema repair preflight..."
export PYTHONPATH="$APP_DIR/apps/pipeline"
if [ -f apps/pipeline/scripts/fix_schema.py ]; then
    "$PYTHON_BIN" apps/pipeline/scripts/fix_schema.py
else
    log "${YELLOW}   fix_schema.py not found; skipping${NC}"
fi

log "Restarting PM2 services..."
if ! command -v pm2 >/dev/null 2>&1; then
    log "${RED}PM2 is not installed${NC}"
    exit 1
fi
pm2 startOrRestart ecosystem.config.cjs --update-env
pm2 save >/dev/null
assert_pm2_online "${CORE_PM2_APPS[@]}" "${PYTHON_PM2_APPS[@]}"
log "   ${GREEN}PM2 services are online${NC}"

log "Running post-deploy health checks..."
assert_http_ready "web" "$WEB_HEALTH_URL"
assert_http_ready "admin" "$ADMIN_HEALTH_URL"
assert_recent_heartbeat "$PREVIOUS_HEARTBEAT_TS"

DEPLOY_END=$(date +%s)
DEPLOY_DURATION=$((DEPLOY_END - DEPLOY_START))
log "${GREEN}Deploy succeeded${NC} duration=${DEPLOY_DURATION}s commit=$CURRENT_COMMIT"
