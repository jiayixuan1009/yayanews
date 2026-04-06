# 🛠️ YayaNews 开发与混合调试指南 (Dev Setup)

本指南针对“本地开发 + 远程数据库”的混合调试场景，补充记录了不应暴露给常规部署流程的操作约定。

## 1. 混合开发模式 (Local UI + Remote DB)

在多数情况下，开发者在 Windows/Mac 本机开发 React 前端和 Python Pipeline，但**强依赖云端的生产/测试 PostgreSQL 数据**。

**如何配置连接：**
因为 `.env` 被 Git 忽略，你可以安全地将 `DATABASE_URL` 指向云端地址（例如阿里云 ECS 的公网 IP 等）：
```env
DATABASE_URL="postgresql://yayanews_super:YourDBPassword@47.79.x.x:5432/yayanews"
REDIS_URL="redis://:YourRedisPassword@47.79.x.x:6379"
```

> [!WARNING]
> 混合开发时执行 `npm run db:init` 极其危险，它会向 `DATABASE_URL` 所指的库执行 `DROP SCHEMA public CASCADE` 操作。永远不要在指向云端主库时运行带有破坏性的 DDL 命令！

## 2. 方程式新闻 (BWEnews) 封面替换策略
当前项目中存在大量第三方无图数据被判定为"方程式新闻"（低质量默认白底图）。
处理这类数据时，我们：
1. **不使用 DB 直接抹除**，而是依靠 UI 组件层的 `getArticleCoverSrc()` 动态降级拦截
2. 当判断到图片为无效白底图时，由前端赋予 `default_cover_dark_fallback`
3. 任何对 `getArticleCoverSrc()` 的变动必须在多端复测（Web/Admin/移动端）

## 3. Topic (专题) 自动归档流程
专题并非单纯的人工聚合，包含了 LLM 打标。对于历史数据的整理脚本，切忌将批量处理逻辑放在 Next.js 路由中，而必须走 `apps/pipeline/` 的 CLI 工具：
```bash
cd apps/pipeline
# 在虚拟环境中执行清洗/归档脚本
python utils/topic_generator.py --dry-run
```

## 4. 全站 I18n 安全规范
- Flash 页面 (`FlashPageClient.tsx`) 等客户端组件**禁止**调用服务端的 `getDictionary()`，需在 Server Component 这一层取出字典片段后作为 props `dict` 传入。
- 英文路径 (`/en/*`) 下绝不允许出现静态中文字符硬编码，需优先检查 `LiveTicker`、`Flash` 和 `Topics` 页面。

## 5. PostgreSQL + pgvector 环境要求
恢复或导入生产数据库快照前，**必须先在 PostgreSQL 实例中安装并开启 `pgvector` 扩展**：
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```
如果目标环境无此插件（比如某些低版本的云数据库），`apps/pipeline/` 的增量相似度去重将直接宕机。
