#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────
# YayaNews 生产部署脚本 (v2)
# 在服务器 /var/www/yayanews 执行
# 功能：备份 → 安装 → 构建 → 部署 → 健康检查 → 自动回滚
# ────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_FILE="$APP_DIR/deploy/deploy.log"
BACKUP_DIR="$APP_DIR/backups"
HEALTH_URL="http://127.0.0.1:3002"
HEALTH_RETRIES=5
HEALTH_INTERVAL=3

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo -e "$msg"
    echo "$msg" >> "$LOG_FILE"
}

# ── 0. 准备 ──
cd "$APP_DIR"
mkdir -p "$BACKUP_DIR"
DEPLOY_START=$(date +%s)
CURRENT_COMMIT=$(git rev-parse --short HEAD)
PREV_COMMIT=$(git rev-parse --short HEAD~1 2>/dev/null || echo "none")

log "${GREEN}🚀 部署开始${NC} — commit: $CURRENT_COMMIT"

# ── 1. 数据库备份 ──
log "🗄️  备份数据库..."
BACKUP_FILE="$BACKUP_DIR/$(date '+%Y%m%d_%H%M%S')_pre_deploy.sql.gz"
if pg_dump yayanews 2>/dev/null | gzip > "$BACKUP_FILE"; then
    log "   ✅ 备份完成: $(basename $BACKUP_FILE) ($(du -h $BACKUP_FILE | cut -f1))"
else
    log "${YELLOW}   ⚠️  数据库备份失败（继续部署）${NC}"
fi

# 清理 30 天前的备份
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete 2>/dev/null || true

# ── 2. 安装依赖 ──
log "📦 安装依赖..."
# 必须在 npm ci 之前清除 NODE_ENV，否则不会安装 devDependencies
unset NODE_ENV
export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://yayanews.cryptooptiontool.com}"

if [ -f package-lock.json ]; then
    npm ci --include=dev 2>&1 | tail -1
else
    npm install 2>&1 | tail -1
fi
log "   ✅ Node.js 依赖完成"

# Python 依赖（如果 requirements.txt 有变化）
if [ -f pipeline/requirements.txt ]; then
    pip install -q -r pipeline/requirements.txt 2>/dev/null || true
    log "   ✅ Python 依赖完成"
fi

# ── 3. 构建 ──
log "🔨 构建 Next.js..."
export NODE_ENV=production
npm run build 2>&1 | tail -3

# standalone 模式需要手动复制静态资源
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static
log "   ✅ 构建完成"

# ── 4. 重启服务 ──
log "♻️  重启 PM2 服务..."
if command -v pm2 >/dev/null 2>&1; then
    pm2 restart ecosystem.config.cjs --update-env 2>&1 | tail -5
    pm2 save 2>/dev/null || true
    log "   ✅ PM2 重启完成"
else
    log "${RED}   ❌ PM2 未安装！${NC}"
    exit 1
fi

# ── 5. 健康检查 ──
log "🏥 健康检查..."
HEALTHY=false
for i in $(seq 1 $HEALTH_RETRIES); do
    sleep $HEALTH_INTERVAL
    HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "$HEALTH_URL" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then
        HEALTHY=true
        log "   ✅ 健康检查通过 (HTTP $HTTP_CODE, 尝试 $i/$HEALTH_RETRIES)"
        break
    else
        log "   ⏳ 等待中... (HTTP $HTTP_CODE, 尝试 $i/$HEALTH_RETRIES)"
    fi
done

# ── 6. 回滚（如果健康检查失败）──
if [ "$HEALTHY" = false ]; then
    log "${RED}❌ 健康检查失败！正在回滚到 $PREV_COMMIT...${NC}"

    git checkout "$PREV_COMMIT" -- .
    unset NODE_ENV
    npm ci --include=dev 2>/dev/null
    export NODE_ENV=production
    npm run build 2>/dev/null
    cp -r public .next/standalone/public
    cp -r .next/static .next/standalone/.next/static
    pm2 restart ecosystem.config.cjs --update-env 2>/dev/null

    log "${YELLOW}⏪ 已回滚到 $PREV_COMMIT${NC}"
    log "   请检查日志: pm2 logs yayanews --lines 50"
    exit 1
fi

# ── 7. 完成 ──
DEPLOY_END=$(date +%s)
DEPLOY_DURATION=$((DEPLOY_END - DEPLOY_START))
log "${GREEN}🎉 部署成功！${NC} 耗时: ${DEPLOY_DURATION}s | commit: $CURRENT_COMMIT"
log "───────────────────────────────────────"
