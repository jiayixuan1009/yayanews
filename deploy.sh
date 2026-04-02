#!/bin/bash
set -e

echo "=========================================="
echo "    YayaNews Production Deploy Script     "
echo "=========================================="

echo "[1/4] Pulling latest code from main..."
git pull origin main

echo "[2/4] Installing Node dependencies..."
npm install

echo "[3/4] Building Workspace & Copying Standalone..."
# 必须在根目录执行 npm run build，以触发 infra/scripts/copy-standalone.mjs
npm run build

echo "[4/4] Restarting PM2 processes..."
# 因为静态资源 chunk 发生了改变，web 必须用 restart 彻底清空旧内存，避免 ChunkLoadError
pm2 restart yayanews
# 其他后台服务可用 reload 实现零停机
pm2 reload yaya-admin || echo "yaya-admin reload failed, skipping"
pm2 reload yaya-ws-gateway || echo "yaya-ws-gateway reload failed, skipping"
pm2 reload yaya-worker-flash || echo "workers reload failed"
pm2 reload yaya-worker-articles || echo "workers reload failed"
pm2 reload yaya-pipeline-daemon || echo "daemon reload failed"

echo "=========================================="
echo "      Deployment Complete! ✅             "
echo "=========================================="
