#!/usr/bin/env bash
# 在服务器 /var/www/yayanews 执行：无 Docker，PM2 + Nginx
set -euo pipefail
cd "$(dirname "$0")/.."
export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://yayanews.cryptooptiontool.com}"

# 必须在 npm ci 之前清除 NODE_ENV，否则不会安装打包必须的 devDependencies (如 tailwindcss)
unset NODE_ENV

# npm ci 需要 package-lock.json；若不存在则回退到 npm install
if [ -f package-lock.json ]; then
  npm ci --include=dev
else
  npm install
fi

# 打包时设置为 production
export NODE_ENV=production
npm run build

# standalone 模式需要手动复制 public 和 static 目录
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static

if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe yayanews >/dev/null 2>&1; then
    pm2 restart yayanews
  else
    pm2 start .next/standalone/server.js --name yayanews
  fi
  pm2 save
else
  echo "未安装 PM2：请先 npm install -g pm2 后重新执行本脚本"
fi
echo "完成。请确认 Nginx 反代 127.0.0.1:3002（见 deploy/nginx-yayanews.conf）"

