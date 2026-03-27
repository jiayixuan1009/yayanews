# YayaNews 更新日志 (Changelog)

所有针对 YayaNews 生产环境的重要架构升级、Bug 修复及新特性，均将以时间倒序的形式记录于此。

## [2026-03-27] - 全域 Bug 审查、生产部署稳定化与三端版本对齐

### 🐛 关键 Bug 修复 (Critical Fixes)

- **【agent6 SQLite 残留崩溃】**：`agent6_translator.py` 在 PostgreSQL 迁移后仍调用已删除的 `get_conn()` 函数及 SQLite `?` 占位符语法，翻译任务触发即 `NameError` 崩溃。修复为 `get_pool().getconn()` + psycopg2 `$1` 语法及 `RealDictCursor`。
- **【flash_collector N-gram 去重崩溃】**：`_get_recent_flash_texts()` 同样调用了已删除的 `get_conn()`，每次快讯采集时去重逻辑均会异常。修复为连接池模式。
- **【speed_benchmark 全面 SQLite 残留】**：`speed_benchmark.py` 整体仍使用 `sqlite3` 直连、`?` 占位符及 SQLite 特有 `datetime('now', ...)` 语法，任何 benchmark 调用即崩溃。全文重写为 `psycopg2` + PostgreSQL `INTERVAL` 语法。
- **【PM2 Python 进程路径错误】**：`ecosystem.config.cjs` 使用 `script: "python"` 导致 PM2 找不到可执行文件，所有 Python 守护进程无法启动。改为 `interpreter: "none"` + `python3` 模式，并加入 `yayanews` Next.js 进程入口。

### 🔨 构建系统修复 (Build Fixes)

- **【generateStaticParams DB 容错】**：`topics/[slug]` 和 `guide/[slug]` 页面的 `generateStaticParams` 在构建时直连数据库，DB 不可用时整个 `npm run build` 崩溃。加入 `try-catch` 兜底，失败时返回空数组改为按需渲染。
- **【sitemap.ts 构建崩溃】**：`/sitemap.xml` 路由 export 阶段 4 个 DB 查询均无错误处理。重构为 `Promise.all` 并发查询 + `.catch(() => [])` 兜底，并加入 `export const dynamic = 'force-dynamic'` 改为运行时生成。

### 📦 依赖修复 (Dependency Fixes)

- **【ws npm 包未列入正式依赖】**：`ws` 包仅存在于 `node_modules`，未写入 `package.json`，重新部署后 `yaya-ws-gateway` 启动即报 `MODULE_NOT_FOUND`。已 `npm install ws --save` 并提交。
- **【Python 系统级依赖补装】**：服务器 Python 环境缺少 `redis`, `rq`, `psycopg2-binary`, `pgvector`, `websocket-client`, `feedparser` 等包。通过清华 PyPI 镜像 + `--break-system-packages` 完整补装。

### 🔄 版本对齐 (Version Sync)

- **【三端历史分叉修复】**：本地、GitHub、云端 VPS 三方代码版本长期分叉（VPS 停留在 `c8307ff`，本地有未推送提交）。通过 `git pull --rebase` + `git reset --hard origin/main` 完成历史清洗，三端统一对齐至 `d0df465`。

## [2026-03-26] - 双语引擎重构与生成管线极速加固

### 🚀 新增特性 (Features)
- **【全站双语 i18n 路由架构】**：Next.js 全面重写为 `app/[lang]` 模式，加入 `src/middleware.ts` 进行无感语言重定向，并提供动态中英文词典 (`zh.json` & `en.json`) 加载。
- **【N-gram 语义去重 (Semantic Deduplication)】**：在 `flash_collector.py` 中引入 Jaccard 相似度算法，自动拦截 >45% 相似度的新闻快讯，大幅优化 LLM 翻译成本。
- **【Agent 6 深度英文特稿引擎】**：于 `pipeline/agents/agent6_translator.py` 部署了全新独立 Agent。能在保存原始 HTML 格式的前提下，全自动将中文深度研报 1:1 翻译为纯正英文特稿，双端 SEO 同步爆发。

### 🛠️ 修复与增强 (Fixes & Optimizations)
- **【SQLite 并发写锁死锁防御】**：针对后台 Python PM2 守护进程与前台 Next.js 节点的高并发冲突，为 `database.py` 及 `src/lib/db.ts` 植入 `PRAGMA busy_timeout=15000` 与 `WAL` 模式补丁，消除 500 假死报错。
- **【Google Indexing SEO 验证】**：确认了 `agent5_publisher` 的实时 `/ping?sitemap` 主动通知逻辑正在稳定服役。
- **【UI 组件隔离与映射】**：抽离 `LocalizedLink`，将硬编码路径全部抹除。

### 📅 下一步路线规划 (Next in Pipeline)
- [A] PostgreSQL 主从架构 (读写分离 CQRS 大迁徙)
- [B] Redis Pub/Sub 真实时 WebSocket 快讯网关
- [C] 全局核心代码中英文标准注释补全与灾备稳定
