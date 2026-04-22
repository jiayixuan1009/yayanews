# YayaNews PM2 Deployment Guide

本文件描述当前生产环境的标准部署方式：`Ubuntu + PM2 + Native PostgreSQL + Redis`。

## 服务拓扑

- `@yayanews/web`: `127.0.0.1:3002`
- `@yayanews/admin`: `127.0.0.1:3003`，通过 `/admin` 提供后台页面
- `@yayanews/ws-server`: WebSocket 网关
- `yaya-pipeline-daemon`: 内容调度进程
- `yaya-worker-flash`: 快讯 worker
- `yaya-worker-articles`: 文章 worker
- `yaya-finnhub-ws`: 行情/快讯采集进程

生产机上的 Nginx 负责把外部流量转发到 `3002` 和 `3003`。

## GitHub 发布流程

1. 在本地完成修改并提交。
2. 打上以 `v` 开头的 tag，例如 `v1.3.0`。
3. 推送 `main` 和对应 tag。
4. GitHub Actions 会登录 VPS，执行 `deploy/publish-yayanews.sh`。
5. `deploy/publish-yayanews.sh` 会转调 `infra/deploy/publish-yayanews.sh`，并执行：
   - 依赖安装
   - `npm run db:init`
   - `npm run build`
   - `pm2 restart ecosystem.config.cjs --update-env`
   - Web / Admin / Pipeline 健康检查

只要任一步失败，部署就应该失败，而不是静默显示成功。

## 生产环境变量

服务器根目录的 `.env` 至少需要包含：

```dotenv
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
ADMIN_API_TOKEN=<set-a-long-random-token>
INDEXING_WEBHOOK_SECRET=<set-a-long-random-token>
ENABLE_PYTHON_WORKERS=true
PYTHON_BIN=/var/www/yayanews/apps/pipeline/.venv/bin/python
```

注意：

- `ADMIN_API_TOKEN` 必须是长随机串，不能使用固定示例值。
- `INDEXING_WEBHOOK_SECRET` 未配置时，索引 webhook 会直接拒绝请求。
- `ENABLE_PYTHON_WORKERS=true` 是生产内容流水线必需项；未开启时，Web 可能正常，但内容生产会停滞。

## 常用排障

```bash
pm2 list
pm2 logs yayanews --lines 100
pm2 logs yaya-admin --lines 100
pm2 logs yaya-pipeline-daemon --lines 100
curl -I http://127.0.0.1:3002
curl -I http://127.0.0.1:3003/admin
cat apps/pipeline/data/daemon_heartbeat.txt
```

如果出现“前台可访问，但新闻不再更新”，优先检查：

1. `.env` 中是否存在 `ENABLE_PYTHON_WORKERS=true`
2. `pm2 list` 里 `yaya-pipeline-daemon`、`yaya-worker-flash`、`yaya-worker-articles` 是否为 `online`
3. `apps/pipeline/data/daemon_heartbeat.txt` 是否持续刷新
