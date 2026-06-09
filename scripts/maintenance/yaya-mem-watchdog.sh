#!/usr/bin/env bash
set -euo pipefail

LOG_FILE="${LOG_FILE:-/var/log/yaya-mem-watchdog.log}"
MIN_AVAILABLE_MB="${MIN_AVAILABLE_MB:-600}"
MAX_LOAD_1M="${MAX_LOAD_1M:-30}"

log() {
    printf '[%s] %s\n' "$(date '+%F %T')" "$1" >> "$LOG_FILE"
}

available_mb="$(free -m | awk '/^Mem:/ { print $7 }')"
load_1m="$(uptime | awk -F'load average:' '{ print $2 }' | awk -F',' '{ print $1 }' | xargs)"
load_int="$(printf '%s\n' "$load_1m" | awk '{ print int($1) }')"

if [ "${available_mb:-0}" -lt "$MIN_AVAILABLE_MB" ]; then
    log "LOW MEM avail=${available_mb}MB load=${load_1m}; restarting pipeline workers"
    /usr/bin/pm2 restart yaya-worker-articles yaya-worker-flash yaya-pipeline-daemon >> "$LOG_FILE" 2>&1 || true
    /usr/bin/sync
    if [ -w /proc/sys/vm/drop_caches ]; then
        printf '1' > /proc/sys/vm/drop_caches || true
    fi
fi

if [ "$load_int" -gt "$MAX_LOAD_1M" ]; then
    log "HIGH LOAD avail=${available_mb}MB load=${load_1m}; restarting web"
    /usr/bin/pm2 restart yayanews >> "$LOG_FILE" 2>&1 || true
fi
