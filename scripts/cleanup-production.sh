#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
BACKUP_KEEP_LATEST="${BACKUP_KEEP_LATEST:-5}"
LOG_RETENTION_DAYS="${LOG_RETENTION_DAYS:-14}"
SESSIONFILTER_LOG_RETENTION_DAYS="${SESSIONFILTER_LOG_RETENTION_DAYS:-7}"
PM2_FLUSH="${PM2_FLUSH:-0}"
NPM_CACHE_CLEAN="${NPM_CACHE_CLEAN:-0}"
DRY_RUN="${DRY_RUN:-0}"

log() {
    printf '[cleanup] %s\n' "$1"
}

run() {
    if [ "$DRY_RUN" = "1" ]; then
        printf '[dry-run] %q ' "$@"
        printf '\n'
    else
        "$@"
    fi
}

show_disk() {
    log "disk usage:"
    df -h "$APP_DIR" || true
}

dir_size() {
    if [ -d "$1" ]; then
        du -sh "$1" 2>/dev/null | awk '{print $1}'
    else
        printf '0'
    fi
}

prune_backup_dir() {
    local dir="$1"
    [ -d "$dir" ] || return 0

    log "pruning backups in $dir (before: $(dir_size "$dir"))"
    find "$dir" -type f \
        \( -name '*.sql.gz' -o -name '*.dump' -o -name '*.bak' -o -name '*.tar' -o -name '*.tgz' -o -name '*.zip' \) \
        -mtime +"$BACKUP_RETENTION_DAYS" -print \
        | while IFS= read -r file; do
            run rm -f -- "$file"
        done

    find "$dir" -maxdepth 1 -type f \
        \( -name '*.sql.gz' -o -name '*.dump' -o -name '*.bak' -o -name '*.tar' -o -name '*.tgz' -o -name '*.zip' \) \
        -printf '%T@ %p\n' \
        | sort -rn \
        | awk -v keep="$BACKUP_KEEP_LATEST" 'NR > keep { sub(/^[^ ]+ /, ""); print }' \
        | while IFS= read -r file; do
            run rm -f -- "$file"
        done

    log "backup dir after: $(dir_size "$dir")"
}

remove_if_exists() {
    local path="$1"
    if [ -e "$path" ]; then
        log "removing $path ($(dir_size "$path"))"
        run rm -rf -- "$path"
    fi
}

show_disk

prune_backup_dir "$APP_DIR/infra/backups"
prune_backup_dir "$APP_DIR/backups"
prune_backup_dir "$APP_DIR/deploy/backups"

remove_if_exists "$APP_DIR/apps/web/.next/cache"
remove_if_exists "$APP_DIR/apps/admin/.next/cache"
remove_if_exists "$APP_DIR/.next/cache"
remove_if_exists "$APP_DIR/.turbo"

find "$APP_DIR" -type d -name '__pycache__' -prune -print | while IFS= read -r dir; do
    run rm -rf -- "$dir"
done
find "$APP_DIR" -type f -name '*.pyc' -print | while IFS= read -r file; do
    run rm -f -- "$file"
done

find "$APP_DIR" -type f -name '*.log' -mtime +"$LOG_RETENTION_DAYS" -print | while IFS= read -r file; do
    run rm -f -- "$file"
done

if [ -d /var/www/sessionfilter/accesslog ]; then
    log "pruning sessionfilter access logs"
    find /var/www/sessionfilter/accesslog -type f -name '*.log' -mtime +"$SESSIONFILTER_LOG_RETENTION_DAYS" -print | while IFS= read -r file; do
        run rm -f -- "$file"
    done
fi

if [ "$PM2_FLUSH" = "1" ] && command -v pm2 >/dev/null 2>&1; then
    log "flushing PM2 logs"
    run pm2 flush
fi

if [ "$NPM_CACHE_CLEAN" = "1" ] && command -v npm >/dev/null 2>&1; then
    log "cleaning npm cache"
    run npm cache clean --force
fi

show_disk
log "done"
