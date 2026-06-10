# YayaNews PM2 Deployment Guide

本文档描述生产环境的标准部署方式：Ubuntu + PM2 + PostgreSQL + Redis。

## Services

- `yayanews`: Web app, bound to `127.0.0.1:3002`
- `yaya-admin`: Admin app, bound to `127.0.0.1:3003` and served under `/admin`
- `yaya-ws-gateway`: WebSocket gateway, bound to `127.0.0.1:3001`
- `yaya-pipeline-daemon`: content scheduler
- `yaya-worker-flash`: flash news worker
- `yaya-worker-articles`: article worker
- `yaya-finnhub-ws`: market and flash-news stream collector

Nginx should be the only public `80/443` entry point. App services should bind to loopback only.

## Required Env

The production `.env` in `/var/www/yayanews` must include at least:

```dotenv
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
ADMIN_API_TOKEN=<set-a-long-random-token>
INDEXING_WEBHOOK_SECRET=<set-a-long-random-token>
ENABLE_PYTHON_WORKERS=true
PYTHON_BIN=/var/www/yayanews/apps/pipeline/.venv/bin/python

LLM_BASE_URL=https://...
LLM_API_KEY=<secret>
LLM_MODEL=...
```

Notes:

- `ADMIN_API_TOKEN` must be a long random secret.
- `ENABLE_PYTHON_WORKERS=true` is required for production content generation.
- API keys should never be printed in logs or copied into chat.

## Deploy

The production deploy logic lives in:

```bash
infra/deploy/publish-yayanews.sh
```

It performs:

- database backup
- dependency installation
- `npm run db:init`
- `npm run db:migrate`
- `npm run build`
- `pm2 start ecosystem.config.cjs --update-env`
- web/admin/pipeline health checks

For the compatibility wrapper:

```bash
scripts/safe-deploy.sh
```

## Health Check

Run the read-only health report before and after deploys:

```bash
cd /var/www/yayanews
npm run ops:health
```

The report checks `.env` presence, PM2 status, pipeline heartbeat, RQ queues, and draft/review article counts. It reports only safe secret metadata such as `set` and value length, never plaintext secrets.

## Common Troubleshooting

```bash
pm2 list
pm2 logs yayanews --lines 100
pm2 logs yaya-admin --lines 100
pm2 logs yaya-pipeline-daemon --lines 100
pm2 logs yaya-worker-articles --lines 100
python3 apps/pipeline/scripts/inspect_rq.py --limit 5
curl -I http://127.0.0.1:3002/zh
curl -I http://127.0.0.1:3003/admin
cat apps/pipeline/data/daemon_heartbeat.txt
```

If the public site works but news is no longer updating, check in this order:

1. `.env` has `ENABLE_PYTHON_WORKERS=true`.
2. `pm2 list` shows `yaya-pipeline-daemon`, `yaya-worker-flash`, and `yaya-worker-articles` as `online`.
3. `apps/pipeline/data/daemon_heartbeat.txt` is refreshing.
4. `npm run ops:health` shows RQ queues are not stuck and `LLM_API_KEY` is set.

When `.env` or `ecosystem.config.cjs` changes, reload PM2 with:

```bash
pm2 start ecosystem.config.cjs --update-env
pm2 save
```
