#!/usr/bin/env bash
set -euo pipefail

echo "== [1/6] 基础状态 =="
date
hostname
uptime
pm2 list || true

echo "== [2/6] 立刻止血 =="
pm2 stop yaya-worker-articles || true
pm2 stop yaya-finnhub-ws || true
pm2 restart yaya-worker-flash || true

echo "== [3/6] 队列长度 =="
redis-cli llen rq:queue:yayanews:flash || true
redis-cli llen rq:queue:yayanews:articles:high || true
redis-cli llen rq:queue:yayanews:articles:default || true
redis-cli llen rq:queue:yayanews:articles:low || true

echo "== [4/6] 写入保守参数(.env) =="
if [ ! -f .env ]; then
  echo "未找到 .env 请先 cd 到项目根目录后重试"
  exit 1
fi

cp .env ".env.bak.$(date +%F-%H%M%S)"

upsert_env () {
  local k="$1"
  local v="$2"
  if grep -q "^${k}=" .env; then
    sed -i "s#^${k}=.*#${k}=${v}#g" .env
  else
    echo "${k}=${v}" >> .env
  fi
}

upsert_env FLASH_CONCURRENCY 2
upsert_env DAEMON_FLASH_SEC 180
upsert_env DAEMON_FLASH_COUNT 6
upsert_env DAEMON_ARTICLE_SEC 3600
upsert_env DAEMON_ARTICLE_COUNT 4
upsert_env PIPELINE_LLM_WORKERS 2
upsert_env PIPELINE_COLLECT_WORKERS 2

echo "== [5/6] 重启生效 =="
pm2 restart ecosystem.config.cjs --update-env
pm2 save

echo "== [6/6] 复核 =="
sleep 3
pm2 list
echo "--- TOP CPU ---"
ps -eo pid,ppid,pcpu,pmem,cmd --sort=-pcpu | head -n 20
echo "--- UPTIME ---"
uptime
echo "完成。"
