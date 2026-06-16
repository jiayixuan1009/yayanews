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
DEPLOY_SMOKE_PORT="${DEPLOY_SMOKE_PORT:-39102}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
BACKUP_KEEP_LATEST="${BACKUP_KEEP_LATEST:-5}"
REQUIRE_DB_BACKUP="${REQUIRE_DB_BACKUP:-1}"
CLEAN_NEXT_CACHE_BEFORE_DEPLOY="${CLEAN_NEXT_CACHE_BEFORE_DEPLOY:-1}"
MIN_FREE_MB="${MIN_FREE_MB:-3072}"
ALLOW_DIRTY_DEPLOY="${ALLOW_DIRTY_DEPLOY:-0}"
STANDALONE_ROLLBACK_DIR=""
DEPLOY_RELOADED=0
GOOGLE_VERIFICATION_PATH="/google557e7d124058718a.html"
GOOGLE_VERIFICATION_BODY="google-site-verification: google557e7d124058718a.html"
TEXT_VERIFICATION_PATH="/db1162aa32014bba89ab29ba04a5ddba.txt"
TEXT_VERIFICATION_BODY="db1162aa32014bba89ab29ba04a5ddba"

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

on_deploy_exit() {
    local exit_code="$1"

    if [ "$exit_code" -ne 0 ] && [ -n "$STANDALONE_ROLLBACK_DIR" ]; then
        set +e
        if [ "$DEPLOY_RELOADED" -eq 0 ]; then
            log "${YELLOW}Deploy failed before PM2 reload; restoring previous standalone build${NC}"
        else
            log "${YELLOW}Deploy failed after PM2 reload; restoring previous standalone build${NC}"
        fi
        restore_standalone_snapshot
        if [ "$DEPLOY_RELOADED" -eq 1 ] && command -v pm2 >/dev/null 2>&1; then
            log "${YELLOW}Reloading PM2 back onto restored standalone build${NC}"
            pm2 reload ecosystem.config.cjs --update-env || pm2 start ecosystem.config.cjs --update-env
            pm2 save >/dev/null
            wait_for_pm2_online "${CORE_PM2_APPS[@]}" "${PYTHON_PM2_APPS[@]}" || true
        fi
    fi

    if [ "$exit_code" -eq 0 ] && [ -n "$STANDALONE_ROLLBACK_DIR" ]; then
        rm -rf -- "$STANDALONE_ROLLBACK_DIR" 2>/dev/null || true
    fi
}

trap 'on_deploy_exit $?' EXIT

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

assert_http_body_ready() {
    local name="$1"
    local url="$2"
    local code

    for i in $(seq 1 "$HEALTH_RETRIES"); do
        sleep "$HEALTH_INTERVAL"
        code="$(curl -sSL -o /dev/null -w "%{http_code}" "$url" || true)"
        code="${code: -3}"
        case "$code" in
            200|301|302|307|308)
                log "   ${GREEN}${name} ready${NC} (HTTP $code, attempt $i/$HEALTH_RETRIES)"
                return 0
                ;;
        esac
        log "   ${YELLOW}Waiting for ${name}${NC} (HTTP $code, attempt $i/$HEALTH_RETRIES)"
    done

    log "${RED}${name} body health check failed${NC}: $url"
    return 1
}

assert_http_exact_body_ready() {
    local name="$1"
    local url="$2"
    local expected="$3"
    local response
    local code
    local body

    for i in $(seq 1 "$HEALTH_RETRIES"); do
        sleep "$HEALTH_INTERVAL"
        response="$(curl -sS -w '\n%{http_code}' "$url" 2>/dev/null || true)"
        code="${response##*$'\n'}"
        body="${response%$'\n'*}"
        if [ "$code" = "200" ] && [ "$body" = "$expected" ]; then
            log "   ${GREEN}${name} ready${NC} (HTTP $code, exact body, attempt $i/$HEALTH_RETRIES)"
            return 0
        fi
        if [ "$code" = "200" ]; then
            log "   ${YELLOW}Waiting for ${name}${NC} (body mismatch, attempt $i/$HEALTH_RETRIES)"
        else
            log "   ${YELLOW}Waiting for ${name}${NC} (HTTP $code, attempt $i/$HEALTH_RETRIES)"
        fi
    done

    log "${RED}${name} exact body health check failed${NC}: $url"
    return 1
}

assert_pm2_online() {
    local failures
    failures="$(pm2 jlist | node -e "
const fs = require('fs');
const apps = JSON.parse(fs.readFileSync(0, 'utf8'));
const expected = process.argv.slice(1);
const failures = [];
for (const name of expected) {
  const matches = apps.filter(app => app.name === name);
  if (matches.length === 0) {
    failures.push(\`\${name}:missing\`);
    continue;
  }
  const bad = matches
    .map((app, idx) => ({ idx, status: app?.pm2_env?.status || 'unknown' }))
    .filter(app => app.status !== 'online');
  if (bad.length > 0) {
    failures.push(\`\${name}:\${bad.map(app => \`#\${app.idx}=\${app.status}\`).join('|')}\`);
  }
}
if (failures.length) {
  console.error(failures.join(', '));
  process.exit(1);
}
" "$@" 2>&1)" || {
        echo "$failures"
        return 1
    }
}

wait_for_pm2_online() {
    local failures=""
    for i in $(seq 1 "$HEALTH_RETRIES"); do
        if failures="$(assert_pm2_online "$@" 2>&1)"; then
            return 0
        fi
        log "   ${YELLOW}Waiting for PM2 services${NC} ($failures, attempt $i/$HEALTH_RETRIES)"
        sleep "$HEALTH_INTERVAL"
    done

    log "${RED}PM2 services did not become online${NC}: $failures"
    return 1
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

report_search_console_env() {
    local google_verification
    local bing_verification

    google_verification="$(read_env_value NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION 2>/dev/null || read_env_value GOOGLE_SITE_VERIFICATION 2>/dev/null || true)"
    bing_verification="$(read_env_value NEXT_PUBLIC_BING_SITE_VERIFICATION 2>/dev/null || read_env_value BING_SITE_VERIFICATION 2>/dev/null || true)"

    if [ -n "$google_verification" ]; then
        log "   ${GREEN}Google Search Console verification token configured${NC}"
    else
        log "${YELLOW}   Google Search Console verification token is not configured; OK only if using DNS Domain property${NC}"
    fi

    if [ -n "$bing_verification" ]; then
        log "   ${GREEN}Bing Webmaster verification token configured${NC}"
    fi
}

assert_standalone_smoke() {
    local server="$APP_DIR/apps/web/.next/standalone/apps/web/server.js"
    local smoke_log="$APP_DIR/infra/deploy/web-smoke.log"
    local smoke_pid=""

    if [ ! -f "$server" ]; then
        log "${RED}Web standalone server is missing${NC}: $server"
        exit 1
    fi

    cleanup_smoke() {
        if [ -n "$smoke_pid" ] && kill -0 "$smoke_pid" 2>/dev/null; then
            kill "$smoke_pid" 2>/dev/null || true
            wait "$smoke_pid" 2>/dev/null || true
        fi
    }
    trap cleanup_smoke RETURN

    if command -v fuser >/dev/null 2>&1; then
        fuser -k "${DEPLOY_SMOKE_PORT}/tcp" >/dev/null 2>&1 || true
    elif command -v lsof >/dev/null 2>&1; then
        lsof -ti "tcp:${DEPLOY_SMOKE_PORT}" | xargs -r kill >/dev/null 2>&1 || true
    fi

    log "Running web standalone smoke test on port $DEPLOY_SMOKE_PORT..."
    rm -f "$smoke_log"
    (
        cd "$APP_DIR"
        NODE_ENV=production PORT="$DEPLOY_SMOKE_PORT" HOSTNAME=127.0.0.1 \
            node "$APP_DIR/scripts/ops/run-with-env.cjs" "$APP_DIR/.env" node "$server"
    ) >"$smoke_log" 2>&1 &
    smoke_pid="$!"
    sleep 2
    if ! kill -0 "$smoke_pid" 2>/dev/null; then
        log "${RED}Web standalone smoke server exited before health checks${NC}; last log lines:"
        tail -80 "$smoke_log" || true
        trap - RETURN
        return 1
    fi
    local smoke_status=0
    assert_http_body_ready "web smoke /zh" "http://127.0.0.1:$DEPLOY_SMOKE_PORT/zh" || smoke_status=$?
    if [ "$smoke_status" -eq 0 ]; then
        assert_http_body_ready "web smoke logo" "http://127.0.0.1:$DEPLOY_SMOKE_PORT/brand/logo-square.png" || smoke_status=$?
    fi
    if [ "$smoke_status" -eq 0 ]; then
        assert_http_body_ready "web smoke default OG" "http://127.0.0.1:$DEPLOY_SMOKE_PORT/brand/og-default.png" || smoke_status=$?
    fi
    if [ "$smoke_status" -eq 0 ]; then
        assert_http_exact_body_ready "web smoke google verification" "http://127.0.0.1:$DEPLOY_SMOKE_PORT$GOOGLE_VERIFICATION_PATH" "$GOOGLE_VERIFICATION_BODY" || smoke_status=$?
    fi
    if [ "$smoke_status" -eq 0 ]; then
        assert_http_exact_body_ready "web smoke text verification" "http://127.0.0.1:$DEPLOY_SMOKE_PORT$TEXT_VERIFICATION_PATH" "$TEXT_VERIFICATION_BODY" || smoke_status=$?
    fi
    if [ "$smoke_status" -eq 0 ]; then
        assert_http_body_ready "web smoke sitemap" "http://127.0.0.1:$DEPLOY_SMOKE_PORT/sitemap.xml" || smoke_status=$?
    fi
    if [ "$smoke_status" -eq 0 ]; then
        assert_http_body_ready "web smoke news sitemap" "http://127.0.0.1:$DEPLOY_SMOKE_PORT/sitemap-news.xml" || smoke_status=$?
    fi
    cleanup_smoke
    trap - RETURN
    if [ "$smoke_status" -ne 0 ]; then
        log "${RED}Web standalone smoke test failed${NC}; last log lines:"
        tail -80 "$smoke_log" || true
        return "$smoke_status"
    fi
    log "   ${GREEN}Web standalone smoke test passed${NC}"
}

snapshot_standalone_dirs() {
    STANDALONE_ROLLBACK_DIR="$APP_DIR/infra/deploy/standalone-rollback-$CURRENT_COMMIT-$(date '+%Y%m%d%H%M%S')"
    mkdir -p "$STANDALONE_ROLLBACK_DIR"

    if [ -d "$APP_DIR/apps/web/.next/standalone" ]; then
        cp -a "$APP_DIR/apps/web/.next/standalone" "$STANDALONE_ROLLBACK_DIR/web"
    fi

    if [ -d "$APP_DIR/apps/admin/.next/standalone" ]; then
        cp -a "$APP_DIR/apps/admin/.next/standalone" "$STANDALONE_ROLLBACK_DIR/admin"
    fi

    log "   ${GREEN}Standalone rollback snapshot ready${NC}: $STANDALONE_ROLLBACK_DIR"
}

restore_standalone_snapshot() {
    if [ -z "$STANDALONE_ROLLBACK_DIR" ] || [ ! -d "$STANDALONE_ROLLBACK_DIR" ]; then
        return 0
    fi

    if [ -d "$STANDALONE_ROLLBACK_DIR/web" ]; then
        rm -rf "$APP_DIR/apps/web/.next/standalone"
        mkdir -p "$APP_DIR/apps/web/.next"
        cp -a "$STANDALONE_ROLLBACK_DIR/web" "$APP_DIR/apps/web/.next/standalone"
    fi

    if [ -d "$STANDALONE_ROLLBACK_DIR/admin" ]; then
        rm -rf "$APP_DIR/apps/admin/.next/standalone"
        mkdir -p "$APP_DIR/apps/admin/.next"
        cp -a "$STANDALONE_ROLLBACK_DIR/admin" "$APP_DIR/apps/admin/.next/standalone"
    fi

    rm -rf -- "$STANDALONE_ROLLBACK_DIR" 2>/dev/null || true
    STANDALONE_ROLLBACK_DIR=""
    log "   ${GREEN}Standalone rollback snapshot restored${NC}"
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

    local dirty_status
    dirty_status="$(git status --porcelain --untracked-files=normal | grep -Ev '^\?\? infra/deploy/[^/]+\.log(\.[0-9]+)?$' || true)"
    if [ -n "$dirty_status" ]; then
        local snapshot_dir
        snapshot_dir="$(bash "$APP_DIR/infra/scripts/snapshot-worktree.sh")"
        log "${RED}Git worktree is dirty; aborting deploy to avoid overwriting production changes${NC}"
        log "${YELLOW}Dirty status:${NC}"
        printf '%s\n' "$dirty_status" | tee -a "$LOG_FILE"
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
report_search_console_env

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
log "Repairing known migration drift..."
npm run db:migrate:repair-known-drift
log "Running database migrations..."
npm run db:migrate

log "Building workspaces..."
export NODE_ENV=production
if [ "$CLEAN_NEXT_CACHE_BEFORE_DEPLOY" = "1" ]; then
    rm -rf apps/web/.next/cache apps/admin/.next/cache .next/cache .turbo 2>/dev/null || true
fi
assert_disk_space
snapshot_standalone_dirs
npm run build
mkdir -p apps/web/.next/standalone/apps/web/.next
mkdir -p apps/admin/.next/standalone/.next
rm -rf apps/web/.next/standalone/apps/web/public
cp -r apps/web/public apps/web/.next/standalone/apps/web/public
cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static
cp -r apps/admin/.next/static apps/admin/.next/standalone/.next/static 2>/dev/null || true
log "   ${GREEN}Build complete${NC}"
assert_standalone_smoke

log "Running schema repair preflight..."
export PYTHONPATH="$APP_DIR/apps/pipeline"
if [ -f apps/pipeline/scripts/fix_schema.py ]; then
    "$PYTHON_BIN" apps/pipeline/scripts/fix_schema.py
else
    log "${YELLOW}   fix_schema.py not found; skipping${NC}"
fi

log "Reloading PM2 services..."
if ! command -v pm2 >/dev/null 2>&1; then
    log "${RED}PM2 is not installed${NC}"
    exit 1
fi
pm2 reload ecosystem.config.cjs --update-env || pm2 start ecosystem.config.cjs --update-env
DEPLOY_RELOADED=1
pm2 save >/dev/null
wait_for_pm2_online "${CORE_PM2_APPS[@]}" "${PYTHON_PM2_APPS[@]}"
log "   ${GREEN}PM2 services are online${NC}"

log "Running post-deploy health checks..."
assert_http_ready "web" "$WEB_HEALTH_URL"
assert_http_body_ready "web /zh" "$WEB_HEALTH_URL/zh"
assert_http_body_ready "web logo" "$WEB_HEALTH_URL/brand/logo-square.png"
assert_http_exact_body_ready "web google verification" "$WEB_HEALTH_URL$GOOGLE_VERIFICATION_PATH" "$GOOGLE_VERIFICATION_BODY"
assert_http_exact_body_ready "web text verification" "$WEB_HEALTH_URL$TEXT_VERIFICATION_PATH" "$TEXT_VERIFICATION_BODY"
assert_http_body_ready "web sitemap" "$WEB_HEALTH_URL/sitemap.xml"
assert_http_ready "admin" "$ADMIN_HEALTH_URL"
assert_recent_heartbeat "$PREVIOUS_HEARTBEAT_TS"

DEPLOY_END=$(date +%s)
DEPLOY_DURATION=$((DEPLOY_END - DEPLOY_START))
log "${GREEN}Deploy succeeded${NC} duration=${DEPLOY_DURATION}s commit=$CURRENT_COMMIT"
