#!/bin/bash
# ==============================================================================
# YayaNews Auto-Recovery Watchdog
# Runs via cron every 2 minutes. Designed to survive OOM, hard reboots, and deadlocks.
# ==============================================================================
LOG_FILE="/var/log/yayanews_watchdog.log"
APP_DIR="/var/www/yayanews"

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

# --- 2. PostgreSQL Check ---
if ! systemctl is-active --quiet postgresql; then
    log "[PGSQL] Service is down. Starting..."
    systemctl start postgresql
fi

# --- 3. PM2 Process Check ---
# Get the number of errored or stopped processes
ERRORED_COUNT=$(pm2 list | grep -iE 'errored|stopped' | wc -l)

if [ "$ERRORED_COUNT" -gt 0 ]; then
    log "[PM2] Detected $ERRORED_COUNT errored/stopped processes. Resetting and restarting..."
    cd "$APP_DIR" || exit 1
    # Reset restart counters and attempt to revive
    pm2 reset all >> "$LOG_FILE" 2>&1
    pm2 restart all >> "$LOG_FILE" 2>&1
    log "[PM2] >> Processes restarted."
fi
