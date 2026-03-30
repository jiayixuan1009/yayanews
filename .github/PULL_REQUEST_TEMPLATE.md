## 🛠 修改范围 (Scope)
请勾选你修改了哪些依赖包或者应用服务（可多选）：

- [ ] `apps/web` (前端 C 端)
- [ ] `apps/admin` (后台管理端)
- [ ] `apps/pipeline` (Python 爬虫与大模型任务)
- [ ] `apps/ws-server` (跨端 WebSocket 心跳网关)
- [ ] `packages/database` (PostgreSQL 基础结构或迁移脚本)
- [ ] `packages/seo` (TDK 与结构化数据封装)
- [ ] `packages/types` (全局 TypeScript 接口或字典)
- [ ] `infra/` (根目录部署、Docker、环境配置 .env 模板或 PM2)

---

## 🎯 修复/需求说明 (Purpose)
简短描述本次 PR 的动机与具体改了什么。
- 解决了什么报错？或支持了什么新功能？
- （如果是关联 Bug，请写上 Fixes #Issue号）


## ✅ 本地验收 (Self-Check Requirements)
单人提 PR 也**必须**在自己电脑上通过这套最小健康线检查，严禁将明显跑不通的代码堆到 CI 上：

- [ ] [TS 安全] 我已经在根目录跑过 `npm run build`，两个 `@yayanews` 的 Next.js 应用未报任何红线。
- [ ] [业务联调] 我运行了 `npm run dev`，确认前台能刷出最新修改页面/接口不报 500。
- [ ] [Python 依赖] 若修改了 Pipeline，我确认了 `requirements.txt` 已经同步更新。
- [ ] [重大破坏预警] **注意！** 如果这是对 `schema.sql` (数据库表) 的结构改动或重命名，我已知悉可能会造成线上读写雪崩，需要配合手动跑 SQL 脚本兼容！
