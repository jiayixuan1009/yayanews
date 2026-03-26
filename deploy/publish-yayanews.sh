#!/usr/bin/env bash
# 在服务器 /var/www/yayanews 执行：无 Docker，PM2 + Nginx
set -euo pipefail
cd "$(dirname "$0")/.."
export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://yayanews.cryptooptiontool.com}"
export NODE_ENV=production

# npm ci 需要 package-lock.json；若不存在则回退到 npm install
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

npm run build

if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe yayanews-web >/dev/null 2>&1; then
    pm2 restart yayanews-web
  else
    pm2 start node_modules/next/dist/bin/next --name yayanews-web -- start -H 0.0.0.0 -p 3000
  fi
  pm2 save
else
  echo "未安装 PM2：请先 npm install -g pm2 后重新执行本脚本"
fi
echo "完成。请确认 Nginx 反代 127.0.0.1:3000（见 deploy/nginx-yayanews.conf）"
