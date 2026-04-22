# YayaNews 极简且坚不可摧的发布与版本控制策略

作为单兵主导但架构宏大的 Monorepo，你不需要企业级火车发布模型 (Release Train)。你真正需要的是：**一旦你在服务器上输入 `pm2 restart` 后全站挂掉，你必须能在 1 分钟内通过一行代码退回前一天的稳态。**

本策略的核心理念：**Git Tag 就是你的“游戏存档”**。

---

## 1. 适合当前阶段的版本号策略 (Simplified SemVer)
不要空谈严格的语义化版本（因为你不做对外发布的 npm 包），建议直接使用**“应用型语义化”**：
- **格式**：`v1.X.Y` (目前主版本号永远锁定为 1)
- **`Y` (Patch 补丁版)**：如 `v1.0.1 -> v1.0.2`。只要修复了 Bug，或者爬虫管线小小调优，每次往服务器拉取前必须加 1。
- **`X` (Minor 进化版)**：如 `v1.1.0 -> v1.2.0`。发生结构级重构（像这次拆分 Admin）、数据库加字段、前端出新的大看板时加 1，并将 `Y` 归零。

## 2. 是否需要 Tag？如何打 Tag？
**绝对需要！这是你保命和回滚的唯一锚点。**
- **打法**：在本地提完代码、确信要更新生产线前，只需要敲：
  ```bash
  npm version patch  # Node 会自动帮你把所有 package.json 的 Y 版本 + 1，并自动打好 v1.X.Y 的 tag
  git push --follow-tags
  ```
- **回滚原理**：如果上线后服务器炸了，只需 `git checkout v1.0.1`（上个 tag），重新 `build`，服务就满血复活了。

## 3. “开发完成” vs “可发布完成” 的残酷界限
单人开发最容易在本地脑补“我写完了”。
- **开发完成 (Dev Complete)**：在本地跑了 `npm run dev` 看不见报错，且刚好推送到 `main` 分支。
- **可发布完成 (Release Ready)**：代码不仅推上了 `main`，而且你在 GitHub 看板上看到咱们刚写的**那 3 条 CI/CD 流水线全部亮起绿灯 (Passed)**！只有熬过了隔离沙盒里的脱水打包、Python 依赖安装、和冒烟探测的洗礼，这段代码才配被打上 Tag 并带到生产 VPS 上去。

## 4. CHANGELOG 的“懒人维护法”
单人维护项目如果手写更新日志是逆人性的。因为我们上一步已经**强制使用了 `feat:` / `fix:` 开头的规范性 Commit**，你完全不需要手动管理。
- **推荐做法**：每次 GitHub 界面上打 Release Tag （或者直接看 `git log`），所有的 `feat(admin)` 自动就是你的“新功能”，所有的 `fix(pipeline)` 就是你的“修复项”。将更新说明全权托付给规范的 Commit 历史。

## 5. 每次发布前必须检查的“生死 4 问” (Pre-Release Checklist)
准备去敲 `npm version patch` 前，问自己：
1. **[防线 1：包引用]**：刚才有没有在 `package.json` 或 `requirements.txt` 加了新库？如果有，确保它们不是只装在全局域。
2. **[防线 2：环境锁]**：有没有新增读取 `.env` 的环境变量指令？如果有，服务器上的 `.env` 文件你手动加上去填好值了吗？
3. **[防线 3：数据库]**：有没有修改 `schema.sql` 或任何表结构？如果有，你是否写了补救或者刷新该表的 SQL（并在本地化执行无误）？
4. **[防线 4：CI 护照]**：GitHub 最后一次 Push 是否全是绿灯？

## 6. 如何保证结构变更不破坏整体连通性？
Monorepo 会让你患上“牵一发动全身病”，比如你改了 `@yayanews/types`，你不知道 Web 还是 Admin 会挂。
**保障手法：利用单体原子发布 (Atomic Deploy)**。
永远不要在服务器上“只重启某一个 App”。每次只要打了 Tag，就是一整架航母重新起飞：
1. `git pull` 后必须 `npm ci`（严格按照锁文件重新锁包）。
2. 必须 `npm run build` 跨包编译，只要打包完成产生脱水产物（Standalone），就证明全站接口的 `Types` 与 `UI` 是全盘吻合的。
3. `pm2 restart ecosystem.config.cjs`，所有节点拉齐生命周期。

## 7. YayaNews 专供：单人主导的黄金发布三段流

这套流程既兼顾了版本追踪，又能护送稳定：

**A 阶段：编码与拦截（本地 💻）**
1. 改代码：`feat(web): add k-line chart`，推送到 GitHub。
2. **等待 1-2 分钟**，去泡杯茶，等待 GitHub Actions（ci-node / ci-smoke）绿灯通行。

**B 阶段：归档与存档点（本地 💻）**
3. `npm version patch`（生成一个带 Tag 的存档，比如 `v1.0.5`）。
4. `git push --follow-tags`，把存盘点推向云端。

**C 阶段：接管与重燃（服务器 ☁️）**
5. SSH 连入 VPS：
   ```bash
   git pull origin main --tags
   npm ci
   npm run build
   pm2 restart ecosystem.config.cjs
   ```
6. （如遇火情）： `git checkout v1.0.4`（退回上个存档点），再执行一次 `build` 和 `restart`，瞬间灭火！
