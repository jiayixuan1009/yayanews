#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────
# YayaNews 数据库备份脚本
# 用法：bash scripts/backup-db.sh
# Cron：0 2 * * * cd /var/www/yayanews && bash scripts/backup-db.sh
# ────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="$APP_DIR/backups"
DB_NAME="${DB_NAME:-yayanews}"
KEEP_DAYS="${KEEP_DAYS:-30}"

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
BACKUP_FILE="$BACKUP_DIR/${TIMESTAMP}_${DB_NAME}.sql.gz"

echo "[$(date)] 开始备份数据库: $DB_NAME"

if pg_dump "$DB_NAME" | gzip > "$BACKUP_FILE"; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "[$(date)] ✅ 备份完成: $(basename $BACKUP_FILE) ($SIZE)"
else
    echo "[$(date)] ❌ 备份失败！"
    rm -f "$BACKUP_FILE"
    exit 1
fi

# 清理旧备份
DELETED=$(find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$KEEP_DAYS -delete -print | wc -l)
if [ "$DELETED" -gt 0 ]; then
    echo "[$(date)] 🧹 清理 $DELETED 个超过 ${KEEP_DAYS} 天的旧备份"
fi

echo "[$(date)] 当前备份数: $(ls -1 $BACKUP_DIR/*.sql.gz 2>/dev/null | wc -l)"
