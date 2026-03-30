# YayaNews 系统架构

> 金融新闻自动采集、AI 加工、双语发布平台

## 技术栈

| 层 | 技术 | 说明 |
|------|------|------|
| **前端** | Next.js 14 (App Router) | SSR/ISR，i18n 双语路由 |
| **样式** | Tailwind CSS 3 | 响应式设计 |
| **后端 API** | Next.js API Routes | RESTful，Admin 鉴权 |
| **内容管线** | Python 3 | 6 个 Agent 串行处理 |
| **数据库** | PostgreSQL 16 + pgvector | 结构化存储 + 语义去重 |
| **消息队列** | Redis + RQ | 异步任务调度 |
| **实时推送** | WebSocket (ws) + Redis Pub/Sub | 快讯实时广播 |
| **进程管理** | PM2 | 5 个常驻进程 |
| **反向代理** | Nginx + Let's Encrypt | HTTPS + 静态资源 |

## 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      Nginx (443/80)                         │
│                 yayanews.cryptooptiontool.com                │
└──────────┬──────────────────────────────────┬───────────────┘
           │                                  │
           ▼                                  ▼
┌──────────────────┐              ┌───────────────────────┐
│  Next.js (3002)  │              │  WS Gateway (ws)      │
│  SSR/ISR Pages   │              │  Redis Pub/Sub 订阅   │
│  API Routes      │              │  实时快讯广播          │
│  Admin Dashboard │              └───────────┬───────────┘
└────────┬─────────┘                          │
         │                                    │
         ▼                                    ▼
┌──────────────────────────────────────────────────────────────┐
│                    PostgreSQL 16 + pgvector                   │
└──────────────────────────┬───────────────────────────────────┘
                           ▲
                           │ 写入
┌──────────────────────────┴───────────────────────────────────┐
│                    Python Pipeline (6 Agents)                 │
│  Agent1: 采集 → Agent2: AI改写 → Agent3: 审核                │
│  Agent4: SEO优化 → Agent5: 发布 → Agent6: 英文翻译           │
├──────────────────────────────────────────────────────────────┤
│  Finnhub WebSocket Daemon  │  Pipeline Scheduler Daemon      │
│  (实时金融数据)              │  (定时调度 Agent 流水线)         │
└──────────────────────────────────────────────────────────────┘
```

## PM2 进程清单

| 进程名 | 类型 | 入口 | 功能 |
|--------|------|------|------|
| `yayanews` | Node.js | `.next/standalone/server.js` | Web 前端 |
| `yaya-pipeline-daemon` | Python | `pipeline.run_daemon` | 管线调度 |
| `yaya-finnhub-ws` | Python | `pipeline.daemon.finnhub_ws_flash` | 实时数据 |
| `yaya-ws-gateway` | Node.js | `src/ws-server.js` | WebSocket 广播 |
| `yaya-pipeline-worker` | Python | `pipeline.worker` | RQ Worker |

## 目录结构

```
yayanews-production/
├── src/                  # Next.js 前端源码
│   ├── app/              #   App Router 页面
│   │   ├── [lang]/       #     i18n 路由 (zh/en)
│   │   ├── admin/        #     管理后台
│   │   └── api/          #     API 路由
│   ├── components/       #   React 组件
│   ├── lib/              #   工具库 (db, queries, types)
│   └── dictionaries/     #   i18n 翻译文件
├── pipeline/             # Python 内容管线
│   ├── agents/           #   6 个处理 Agent
│   ├── config/           #   管线配置
│   ├── daemon/           #   常驻守护进程
│   ├── utils/            #   工具 (db, llm, logger)
│   ├── tools/            #   辅助工具 (PSI, benchmark)
│   └── migrations/       #   数据库迁移脚本（历史）
├── deploy/               # 部署配置
├── scripts/              # 工具脚本
├── docs/                 # 项目文档
└── public/               # 静态资源
```
