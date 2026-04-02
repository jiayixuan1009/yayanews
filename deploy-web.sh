#!/bin/bash
# deploy-web.sh — YayaNews Web 一键部署脚本
# 用法: bash /var/www/yayanews/deploy-web.sh
set -e

ROOT="/var/www/yayanews"
WEB="$ROOT/apps/web"

echo "▶ [1/5] 拉取最新代码..."
cd "$ROOT"
git pull origin main

echo "▶ [2/5] 安装依赖..."
cd "$WEB"
npm install --prefer-offline

echo "▶ [3/5] 构建 Next.js..."
npm run build

echo "▶ [4/5] 同步静态资源到 standalone 目录..."
STANDALONE="$WEB/.next/standalone/apps/web"
cp -r "$WEB/.next/static"  "$STANDALONE/.next/static"
cp -r "$WEB/public"         "$STANDALONE/public"

echo "▶ [5/5] 重启 PM2 进程..."
cd "$ROOT"
pm2 restart yayanews

echo "✅ Web 部署完成！"
pm2 status yayanews
