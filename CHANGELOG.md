# YayaNews 更新日志 (Changelog)

所有针对 YayaNews 生产环境的重要架构升级、Bug 修复及新特性，均将以时间倒序的形式记录于此。

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
