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
| `yayanews` | Node.js | `apps/web/.next/standalone/.../server.js` | Web 前端 (3002) |
| `yaya-admin` | Node.js | `apps/admin/.next/standalone/.../server.js` | 管理后台 (3003) |
| `yaya-pipeline-daemon` | Python | `pipeline/run_daemon.py` | 管线调度 |
| `yaya-finnhub-ws` | Python | `pipeline/daemon/finnhub_ws_flash` | 实时数据 |
| `yaya-ws-gateway` | Node.js | `apps/ws-server/dist/server.js` | WebSocket 广播 |
| `yaya-worker-flash` | Python | `pipeline/worker.py` ×4 | RQ Flash Worker |
| `yaya-worker-articles` | Python | `pipeline/worker.py` ×6 | RQ Articles Worker |

## 目录结构

```
yayanews-production/
├── apps/
│   ├── web/                # Next.js 前端 (ToC)
│   │   └── src/
│   │       ├── app/
│   │       │   ├── [lang]/   # i18n 路由 (zh/en)
│   │       │   └── api/      # API 路由
│   │       ├── components/   # React 组件
│   │       ├── lib/          # 工具库 (queries, utils)
│   │       └── dictionaries/ # i18n 翻译文件
│   ├── admin/              # Next.js 管理后台
│   ├── pipeline/           # Python 内容管线
│   │   └── pipeline/
│   │       ├── agents/     #   处理 Agent
│   │       ├── config/     #   配置
│   │       ├── daemon/     #   常驻守护进程
│   │       ├── tools/      #   辅助工具
│   │       └── utils/      #   工具 (db, llm, logger)
│   └── ws-server/          # WebSocket 实时推送网关
├── packages/
│   ├── database/           # PostgreSQL 抽象层
│   ├── seo/                # SEO 元数据生成
│   └── types/              # 共享类型定义
├── infra/                  # Docker / 部署基础设施
├── deploy/                 # 部署脚本
├── scripts/                # 工具脚本
└── docs/                   # 项目文档
```
