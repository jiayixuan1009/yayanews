# YayaNews 极简且坚固的 CI/CD 架构方案

身为单兵作战的开发者，CI/CD 最忌讳“唯工具论”的过度设计（比如搞极其复杂的 Dagger/Jenkins 管道）。你需要的是一个**“在你合入烂代码时能精准扇你耳光，但在没有改动该模块时绝对安静”**的自动化哨兵。

基于这个原则，我打磨了以下轻量但覆盖面 100% 的 GitHub Actions 方案，专攻**“可运行性 (Run-ability) 断裂拦截”**。

---

## 🏗️ 1. 推荐的 GitHub Actions 结构
在 `.github/workflows/` 下只需保留这 3 个黄金骨架：

```text
.github/workflows/
├── ci-node.yml      # (Node生态防线) 拦截 Web / Admin / 包依赖 / TS 爆雷
├── ci-python.yml    # (算法管线防线) 拦截爬虫改崩、缺包、语法缩进错误
└── ci-smoke.yml     # (运行时真火防线) 检查环境集成与底层配置连通性
```

## 🎯 2. 不同目录变更时的“精准打击” (Smart Triggers)
没必要每次改了 `README` 或 `Python` 文件就等 5 分钟去编译前端。利用 `paths` 进行切割：

| Workflow | 触发路径监听 (`paths`) | 执行重点逻辑 |
| :--- | :--- | :--- |
| **`ci-node.yml`** | `apps/web/**`, `apps/admin/**`, `apps/ws-server/**`, `packages/**`, `package*.json` | 安装依赖 $\rightarrow$ `npm run lint` $\rightarrow$ `tsc` (若单独设) $\rightarrow$ `npm run build` |
| **`ci-python.yml`**| `apps/pipeline/**` | Pip 安装 $\rightarrow$ Flake8/MyPy 基础扫描 $\rightarrow$ Pytest (若有) |
| **`ci-smoke.yml`** | `.env*`, `ecosystem.config.cjs`, `infra/**`, `package.json` | 配置正确性，模拟进程拉起 |

## 🛡️ 3. 必须有的核心 Workflow 及作用 (Must-haves)

### A. 全栈打包隔离校验 (`ci-node.yml`)
- **不只查格式**：前端很容易因为在 `packages/types` 里改掉一个类型，导致另一端的 Admin 崩溃。因此，这一步的核心是 **依赖解析与跨工作区 `npm run build`**。
- **作用说明**：它会把 Web 和 Admin 打包成独立的 `standalone`。成功了，说明你的 TypeScript 接口边界严丝合缝；失败了，绝对不容许合并到 `main`。

### B. Python 运行沙盘 (`ci-python.yml`)
- **不只查语法**：最致命的往往不是语法，而是你新加了一个类库（比如 `bs4`），却忘了加在 `requirements.txt` 里！
- **作用说明**：云端起一个干净的 Python 3.10 环境，执行 `pip install -r requirements.txt`，一旦你漏配依赖，直接爆红，把你因为本机缓存造成的“幸存者偏差”过滤掉。

### C. 最小化冒烟测试 Smoke Test (`ci-smoke.yml`)
- **这是精华中的精华**。“能 Build 就能 Run” 是前端最大的谎言。
- **验证手段**：利用 GitHub 跑一个模拟容器！执行 `npm run build` 之后，试着在后台跑起 `node apps/web/server.js`，写一个 `curl -I localhost:3000` 探针。如果它返回 200，立刻杀掉。如果它直接因为环境变量未捕获或初始化逻辑崩溃，立马打回 PR。

## 💡 4. 如何做到“服务于真实的可运行性”？

1. **环境仿生术**：给你的 GitHub CI 注射“空包弹”（Fake Envs）：
   在 CI 环境内强制配置 `DATABASE_URL=postgresql://fake:5432` 和 `REDIS_URL=redis://localhost:6379`。在 `.env` 中如果有写死强校验的代码，一定会在这一步因为读不到而崩溃，从而逼迫你写下安全的 fallback 逻辑。
2. **拒绝死板的单侧 (`Unit Tests`)，拥抱构建态强校验**：单人写 `npm test` 会拖累你的研发进度，最好的方式是**把验证逻辑塞进 Build 时**。如果在 Next.js 编译时能捕获所有错误（包括 API 调用结构），这就是最实用的静态测试。

## 🛠️ 5. 极简实战：一份值得抄作业的 YAML (ci-node 示例)

这是一个极轻量、带缓存、绝不拖时间的真实防震盾模板：

```yaml
name: Node Ecosystem CI

on:
  pull_request:
    paths:
      - 'apps/web/**'
      - 'apps/admin/**'
      - 'packages/**'
      - 'package.json'
      - 'package-lock.json'
  push:
    branches: [ main ]

jobs:
  verify-and-build:
    runs-on: ubuntu-latest
    steps:
      - name: 检出源码
        uses: actions/checkout@v4

      - name: 标准化 Node 18
        uses: actions/setup-node@v4
        with:
          node-version: '18.17.x'
          cache: 'npm' # 极速挂载依赖缓存

      - name: 安装全仓依赖 (严格依循 lockfile)
        run: npm ci

      - name: 执行全局 Linting (扫描基础逻辑黑点)
        run: npm run lint

      - name: 破坏性打包试炼 (交叉验证类型与组件)
        # 这里如果 packages/types 的变动破坏了 Admin，这一步立刻炸
        run: npm run build
```

## 总结
这套设计的精要在：**化整为零，按路径监听，强制验证。** 
只花极少的时间去配，但能在这个应用越积越大时，每次你 `git push` 给它兜起最后一道“不死机”的底线。
