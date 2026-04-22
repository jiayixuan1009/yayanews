# YayaNews Monorepo GitHub 工程治理与协作规范

这份指南专为“当前单人主导、持续重构、且必须保证随时可发布”的 YayaNews Monorepo 量身定制。核心原则是：**极简主义 + 自动化拦截 + 作用域清晰**。

## 1. 推荐分支策略：主干开发 (Trunk-Based Development)
对于单人主导且结构复杂的 Monorepo，严禁使用冗长的 GitFlow（如 `develop` / `release` / `hotfix`）。
- `main` **分支**：唯一的真理来源。任何合并到 `main` 的代码都必须是**随时可打包并安全部署到长连接生产环境**的。
- `feat/xxx` **或** `fix/xxx` **分支**：用于开发耗时超过 2 小时、或者涉及跨包（跨 `apps` 和 `packages`）的大型结构性爆改（如本次的 SQLite 到 PG 迁移）。
- **策略总结**：日常写业务直接向 `main` 推送小提交；结构重构或者破坏性更新，开分支走 PR 自我审查。不需要 `release` 分支，利用 GitHub Releases (Git Tags) 来标记生产环境版本。

## 2. 推荐 Commit 规范 (Conventional Commits for Monorepo)
Monorepo 最怕的就是“不知这行代码改了哪里”。使用带有**工作区标记 (Scope)** 的约定式提交：
- **格式**：`<type>(<scope>): <subject>`
- **<type> 枚举**：
  - `feat`: 新增功能（页面、API）
  - `fix`: 修复 Bug（数据报错、样式穿透）
  - `refactor`: 重构（如代码位移，不改变功能，如 `refactor(database): 抽取种子脚本`）
  - `chore`: 杂项（如升级 npm 包：`chore(deps): bump next.js`）
- **<scope> 枚举**（必须映射到现有目录）：
  - `web`, `admin`, `pipeline`, `ws-server`, `database`, `seo`, `types`, `infra`, `root`。
- **正例**：`feat(admin): 增加行情看板图表组件` / `fix(pipeline): 修复 Finnhub 断连未重试问题`

## 3. 单人 PR 规则建议
单人开发为什么要写 PR？**为了给自己制造“冷静期”和“跑 CI 的沙盒”**。
- **触发条件**：只要触碰了多个 `packages/*`，或者修改了 `ecosystem.config.cjs` / `.env`，必须走 PR。
- **合并策略**：采用 `Squash and merge`（压缩合并）。这能让 `main` 分支的历史像日记一样干净，掩盖掉你在开发分支里的 `fix1`, `fix2`, `test` 这类脏提交。

## 4. Issue 分类建议 (标签化管理)
Issue 是你自己未来的任务栈。设立以下几组正交标签（Label）：
- **按工作区划分 (Scope)**：`[Scope: Web]`, `[Scope: Pipeline]`, `[Scope: Database]`
- **按事件类型 (Type)**：`[Type: Bug]`, `[Type: Feature]`, `[Type: Tech Debt]` (非常重要，记录以后要还的技术债)
- **开发现状 (Status)**：`[Status: On Hold]` (被其他依赖卡住了), `[Status: Blocked]`

## 5. 仓库必须有的文档文件 (The Source of Truth)
Monorepo 最怕几个月后自己拿起来连怎么运行都忘光了。根目录必须长期维系这 3 个文件：
1. **`README.md`**：项目简介、架构图（说明 Web、Admin、Pipeline、WS 是如何与 PG 和 Redis 交互的）、核心技术栈版本。
2. **`CONTRIBUTING.md`**：写明“本地最小启动指北”。例如如何安装 Python 的 `venv`、如何配置 `.env` 里的必须项、运行 `npm run dev` 能够拉起哪些端口。
3. **`infra/deploy/DEPLOYMENT.md`**：记录最新的服务器 Nginx 反代配置（如 3003 端口切 `/admin`）、PM2 启动指令，以及如何升级数据库 Schema。

## 6. `.github` 目录推荐结构
未来一旦上 GitHub Actions，这套结构将让你的持续集成效率最大化：
```text
.github/
├── workflows/
│   ├── ci-main.yml           # 在推送到 main 时全量跑 build 和类型检查
│   ├── pr-web.yml            # 只有 files: apps/web/** 变动时才运行的敏捷测试链
│   ├── pr-pipeline.yml       # 只有 files: apps/pipeline/** 变动时，跑 Python 语法校验
│   └── release.yml           # 监听 Git Tag 起飞，实现自动化发布或打 Docker 镜像
├── CODEOWNERS                # (可选) 声明哪些包是你主导的，防止外人乱提 PR 改结构
├── PULL_REQUEST_TEMPLATE.md  # 强迫你在合 PR 前，在 Checkbox 里打勾验证了哪些项
└── ISSUE_TEMPLATE/
    ├── bug_report.yml        # 利用 GitHub YAML 表单强制必填复现步骤和报错包范围
    └── feature_request.yml
```

## 7. 哪些 GitHub 规则 (Branch Rulesets) 最值得先上？
在 GitHub Settings -> Branches 里，最应该第一时间开启的 2 个限制：
1. **Require status checks to pass before merging**：拦截器！把 `npm run build` 和 Python 的格式检查配置成 Required。只要 CI 编译爆红（例如在 `seo` 里改错了一个类型导致 `web` 不能构建），**绝对禁止 Merge 到 main**。这是保住“随时可运行性”的生命线。
2. **Require linear history**：要求线性历史。禁止在 `main` 里出现错综复杂的合并线，必须采用 Rebase 或 Squash 集成，这在追踪线上诡异 Bug 时会救你一命。

## 8. 保障架构演进稳定性的终极抓手
每次 Monorepo 出现结构级改动（比如将某逻辑抽离为 `packages/new-module`），如何保证整体仍然稳定可用？
1. **严格在工作区跑类型编译**：像本次的改动最后一步我们跑了 `npm run build`。你要把这个命令锁死在 GitHub CI 里，任何 PR 提交，只要触及了 TS 层，必须让机器在干净的环境里帮你跑通。
2. **依赖隔离测试 (Dependency Graph)**：由于现在解耦得足够好，未来改了 `apps/web`，那就只重新编译部署 `web`。
3. **隔离 `NODE_ENV` 验证**：任何跨包的配置修改，比如 PM2 生态、Next standalone 打包，必须在 `feat` 分支上通过跑一遍模拟生产模式 (`npm run build && node apps/web/server.js`)，切忌直接在本地 `npm run dev` 能跑就笃定上了生产不崩。
