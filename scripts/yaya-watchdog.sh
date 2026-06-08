#!/bin/bash
# ==============================================================================
# YayaNews Auto-Recovery Watchdog
# Runs via cron every 2 minutes. Designed to survive OOM, hard reboots, and deadlocks.
# ==============================================================================
LOG_FILE="/var/log/yayanews_watchdog.log"
APP_DIR="/var/www/yayanews"
EXPECTED_APPS=(
    yayanews
    yaya-admin
    yaya-ws-gateway
    yaya-finnhub-ws
    yaya-pipeline-daemon
    yaya-worker-flash
    yaya-worker-articles
)

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

# --- 1. Redis Check and Repair ---
if ! systemctl is-active --quiet redis-server; then
    log "[REDIS] Service is down. Attempting recovery..."
    
    # Try to start it first
    systemctl start redis-server
    sleep 2
    
    if ! systemctl is-active --quiet redis-server; then
        log "[REDIS] Start failed. Checking for AOF corruption..."
        MANIFEST="/var/lib/redis/appendonlydir/appendonly.aof.manifest"
        
        if [ -f "$MANIFEST" ]; then
            log "[REDIS] AOF manifest found. Running redis-check-aof --fix..."
            # Auto-accept the fix prompt (y/N)
            redis-check-aof --fix "$MANIFEST" << EOF >> "$LOG_FILE" 2>&1
y
EOF
            log "[REDIS] AOF fix completed. Restarting service..."
            systemctl restart redis-server
            sleep 2
            
            if systemctl is-active --quiet redis-server; then
                log "[REDIS] >> Recovery SUCCESS!"
            else
                log "[REDIS] >> Recovery FAILED! Service still down."
            fi
        else
            log "[REDIS] No AOF manifest found. Cannot auto-repair."
        fi
    else
        log "[REDIS] >> Normal start succeeded."
    fi
fi

# --- 2. PM2 Process Check ---
cd "$APP_DIR" || exit 1

if ! pm2 ping >/dev/null 2>&1; then
    log "[PM2] Daemon not responding. Resurrecting..."
    pm2 resurrect >> "$LOG_FILE" 2>&1 || pm2 startOrRestart ecosystem.config.cjs --update-env >> "$LOG_FILE" 2>&1
    sleep 5
fi

NEEDS_RESTART=0
PM2_JSON=$(pm2 jlist 2>/dev/null || echo "[]")
for app in "${EXPECTED_APPS[@]}"; do
    status=$(printf '%s' "$PM2_JSON" | node -e "
const fs = require('fs');
const apps = JSON.parse(fs.readFileSync(0, 'utf8'));
const name = process.argv[1];
const app = apps.find((item) => item.name === name);
process.stdout.write(app?.pm2_env?.status || 'missing');
" "$app")
    if [ "$status" != "online" ]; then
        log "[PM2] App '$app' is '$status'. Full ecosystem restart required."
        NEEDS_RESTART=1
    fi
done

if [ "$NEEDS_RESTART" -eq 1 ]; then
    pm2 startOrRestart ecosystem.config.cjs --update-env >> "$LOG_FILE" 2>&1
    pm2 save >> "$LOG_FILE" 2>&1 || true
    log "[PM2] >> Ecosystem startOrRestart completed."
fi

# --- 3. HTTP/TCP health checks ---
if ! curl -fsS --max-time 8 http://127.0.0.1:3002/zh >/dev/null; then
    log "[HTTP] Web app failed health check. Restarting yayanews..."
    pm2 restart yayanews >> "$LOG_FILE" 2>&1 || pm2 startOrRestart ecosystem.config.cjs --only yayanews --update-env >> "$LOG_FILE" 2>&1
fi

if ! curl -fsS --max-time 8 http://127.0.0.1:3003/admin >/dev/null; then
    log "[HTTP] Admin app failed health check. Restarting yaya-admin..."
    pm2 restart yaya-admin >> "$LOG_FILE" 2>&1 || pm2 startOrRestart ecosystem.config.cjs --only yaya-admin --update-env >> "$LOG_FILE" 2>&1
fi

if ! (echo > /dev/tcp/127.0.0.1/3001) >/dev/null 2>&1; then
    log "[TCP] WS gateway port 3001 failed health check. Restarting yaya-ws-gateway..."
    pm2 restart yaya-ws-gateway >> "$LOG_FILE" 2>&1 || pm2 startOrRestart ecosystem.config.cjs --only yaya-ws-gateway --update-env >> "$LOG_FILE" 2>&1
fi
