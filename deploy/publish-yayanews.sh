#!/usr/bin/env bash
# 在服务器 /var/www/yayanews（或你的目录）执行：无 Docker，PM2 + Nginx
set -euo pipefail
cd "$(dirname "$0")/.."
export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://yayanews.cryptooptiontool.com}"
export NODE_ENV=production

npm ci
npm run build
if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe yayanews-web >/dev/null 2>&1; then
    pm2 restart yayanews-web
  else
    pm2 start node_modules/next/dist/bin/next --name yayanews-web -- start -H 0.0.0.0 -p 3000
    pm2 set 0:env NODE_ENV production
    pm2 set 0:env NEXT_PUBLIC_SITE_URL "${NEXT_PUBLIC_SITE_URL:-https://yayanews.cryptooptiontool.com}"
  fi
  pm2 save
else
  echo "未安装 PM2：可执行 npx pm2 start node_modules/next/dist/bin/next --name yayanews-web -- start -H 0.0.0.0 -p 3000"
fi
echo "完成。请确认 Nginx 反代 127.0.0.1:3000（见 deploy/nginx-yayanews.conf）"
# 说明：不使用 pm2 start deploy/ecosystem.web.cjs，因部分环境会将其当作脚本执行导致 3000 无监听；改用直接启动 next。
