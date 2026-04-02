#!/bin/bash
# deploy-admin.sh — YayaNews Admin 一键部署脚本
# 用法: bash /var/www/yayanews/deploy-admin.sh
set -e

ROOT="/var/www/yayanews"
ADMIN="$ROOT/apps/admin"

echo "▶ [1/5] 拉取最新代码..."
cd "$ROOT"
git pull origin main

echo "▶ [2/5] 安装依赖..."
cd "$ADMIN"
npm install --prefer-offline

echo "▶ [3/5] 构建 Next.js Admin..."
npm run build

echo "▶ [4/5] 同步静态资源到 standalone 目录..."
STANDALONE="$ADMIN/.next/standalone/apps/admin"
cp -r "$ADMIN/.next/static"  "$STANDALONE/.next/static"
cp -r "$ADMIN/public"         "$STANDALONE/public" 2>/dev/null || true

echo "▶ [5/5] 重启 PM2 进程..."
cd "$ROOT"
pm2 restart yaya-admin

echo "✅ Admin 部署完成！"
pm2 status yaya-admin
