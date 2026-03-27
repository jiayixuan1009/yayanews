# 🚀 YayaNews 生产引擎架构手册 (Production Manual)
> 本手册为高可用、高并发环境下的灾难恢复与操作说明指南。包含最新的 PostgreSQL 主从链路与 Redis Pub/Sub 极速网关定义。

## 📍 1. 核心链路架构 (The Trinity Architecture)

系统由三路高速管道并行驱动：
1. **写流管道 (PostgreSQL Master)**: 由 6 台连轴转的 Python Agents 驱动，利用 `psycopg2` 疯狂拉取、重写、双语翻译并推库。通过 `pipeline/run.py` 调度。
2. **读流管道 (Next.js SSR/ISR + PG)**: 使用 App Router Server Components 与底层纯异步 `pg` 连接池连接，所有客户端流量被缓冲。
3. **极速广播管道 (Redis 0.1s WebSocket)**: 由 `ws-server.js` (PM2 App: `yaya-ws-gateway`) 常驻。Agent 在插入数据的同一皮秒，向 Redis 网关注入 JSON。WebSocket 会不经过 DB 直接把快讯射向所有客户端。

## 📍 2. 生产环境总控面板 (PM2 Ecosystem)
所有服务器后端的进程都被锁定在 `ecosystem.config.cjs`，操作密码如下：

- 全局重启大盘：`pm2 restart ecosystem.config.cjs` 或 `pm2 restart all`
- 查看 Agent 抓取日志：`pm2 logs yaya-finnhub-ws` 或 `pm2 logs yaya-pipeline-daemon`
- 监控 WebSocket 直播推流：`pm2 logs yaya-ws-gateway`

当前部署的服务有：
- `yayanews`: Node.js Next.js 生产 Web
- `yaya-pipeline-daemon`: Python Agent 核心排班调度引擎
- `yaya-finnhub-ws`: Finnhub 金融极速监听插口
- `yaya-ws-gateway`: Native Node.js Redis-订阅与 WebSocket 广播中心

## 📍 3. 环境配置 (Env Vars)
在部署节点（如 Ubuntu 24.04），需要维持：
```bash
DATABASE_URL="postgresql://yayanews:{password}@127.0.0.1:5432/yayanews"
LLM_API_KEY="sk-xxx"
FINNHUB_KEY="xxxxxx"
```

## 📍 4. 灾难急救措施 (Disaster Recovery Protocols)
**状态 1：快讯突然停止更新**
1. 检查 Redis：`sudo systemctl status redis-server`
2. 检查 Finnhub daemon：`pm2 logs yaya-finnhub-ws --lines 50`

**状态 2：网站全部白屏报错 `500` / Connection Refused**
1. Postgres 是否宕机：`sudo systemctl restart postgresql`
2. 检查 Node 连接池错误：`pm2 logs yayanews`

> Created by the Official Proactive Vibe Partner Agent. 🤖
