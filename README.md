# 🌐 YayaNews 金融媒体智能生产终端

> **The Next Generation Financial Intelligence Engine.** 🚀  
> 基于纯粹的 PostgreSQL 与 Next.js `App Router` 打造的一体化企业级资讯分发平台。

## 🎯 系统架构概览
本仓库采纳扁平化 **Monorepo** 隔离结构。全站划分为独立的业务流、管理流和爬虫清洗流，彻底解耦。

### 📁 根生态地图 (`/apps` & `/packages`)

- **🌌 表现与交互网关 (`apps/`)**:
  - [`@yayanews/web`](apps/web): ToC 高并发客户端。借助 Tailwind CSS + Next.js Server Components 实现急速 SSR 和全链路多语言 (zh/en)。
  - [`@yayanews/admin`](apps/admin): ToB 的图表与人工审核台。拦截 `/admin` 路由，完全重构并运行于独立 Node 服务簇 (`3003`)，享有独立资源沙盒隔离。
  - [`@yayanews/pipeline`](apps/pipeline): Python 引擎中枢。对接 Finnhub 和数十个三方行情提供商，并通过大模型双擎路由（DeepSeek-V3 常规处理 / DeepSeek-R1 深度解析）润色资讯。以 `daemon` + `worker` 双切片模式被 PM2 并发挂起。
  - [`@yayanews/ws-server`](apps/ws-server): 实时脉搏总线。负责通过 Redis Subscription 向所有订阅了相关标的 Web 用户或 Admin 图表推送毫秒级快讯更新。

- **🔧 硬核地基引擎 (`packages/`)**:
  - [`@yayanews/database`](packages/database): 纯粹对底层 PostgreSQL 联通的抽象。不再挂载本地的 `better-sqlite3`（已全局清理）。它只响应环境变量 `DATABASE_URL`。所有的迁移 (`init-db`) 都在此包闭环。
  - [`@yayanews/seo`](packages/seo): “SEO 黑匣子”。全局页面 Header 的元数据生成厂，负责抹平各大社交媒体卡片渲染 (`OpenGraph` / `Twitter`) 和 Google 搜索引擎爬虫所需的微结构数据 (`JSON-LD`)。
  - [`@yayanews/types`](packages/types): **The Single Source of Truth**. 这是贯穿前/后台与持久层中间的类型切面（TDK 接口，图表属性映射等全在这里）。

## 🛡️ 本地开发与贡献
请阅读根目录最新的 [`CONTRIBUTING.md`](CONTRIBUTING.md) 和 [`github_governance_plan.md`](github_governance_plan.md) 了解如何最小耗时构建这头性能怪兽。

## 📦 生产环境打包流
依靠 `ecosystem.config.cjs` 作为 PM2 的集群神谕：
1. 它同时吞吐 Node 和 Python 隔离进程。
2. 它监听自动抽离至 `.next/standalone` 的脱水镜像包，对 CPU 进行均衡负载。
