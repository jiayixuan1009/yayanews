# YayaNews 裸机 PM2 部署白皮书

> **背景说明：**
> 过去文档中存在 Docker 化部署的预想，但历经多轮演进与网络策略优化，当前 `YayaNews` 已确立了 **Ubuntu 裸机 + PM2 + Native PostgreSQL** 的基建护城河。本白皮书为云端部署的最权威、唯一的执行标准。

## 一、 云端服务器环境基线要求

云端服务器（Ubuntu 22.04+）必须预装并稳定运行以下服务组：

1. **Node 生态**：
   - Node.js (>= 18.17.0)
   - npm & PM2 (全局安装 `npm install -g pm2`)
2. **Python 生态**：
   - Python (>= 3.10) 与 `pip`
   - 不必须使用虚拟环境（依赖隔离要求不高，直接走全局 pip 安装亦可，部署脚本已配好）
3. **数据存储核心**：
   - **PostgreSQL 16** (监听默认 5432 端口，或映射端口)。*注意：现阶段已屏蔽 pgvector 强制依赖，支持原生 PG。*
   - **Redis 6+** (监听默认 6379 端口，用于 Python RQ 队列与调度通信)。

## 二、 工作区（Workspaces）网络互通分布

整个仓库划分为独立分层的微服务，它们通过 PM2 并行启动：

- `@yayanews/web`: **Port 3000**（暴露给前端反向代理）
- `@yayanews/admin`: **Port 3003**（暴露给管理员后台代理）
- `@yayanews/pipeline`: **RQ Workers** (纯后台 Python 进程，不占端口)
- `@yayanews/ws-server`: **Port 3001** (原生 WebSocket 服务，处理快讯推送)
- `yaya-finnhub-ws`: 后台守护进程（消费 Finnhub 并转发至 3001）

## 三、 CI/CD 自动化发版流 (GitHub Actions)

**⚠️ 警告：所有的生产代码变更，必须经过 GitHub 推送！禁止在云端服务器直接修改！**

1. 开发者在本地修好 Bug / 功能。
2. 提交代码并打上以 `v` 开头的 Tag：
   ```bash
   git add .
   git commit -m "feat/fix: xxx"
   git tag v1.3.0
   git push origin main
   git push origin v1.3.0
   ```
3. GitHub Actions `deploy.yml` 会自动接管，采用免密 SSH 登录到 VPS，直接执行 `/var/www/yayanews/deploy/publish-yayanews.sh`。

### 部署脚本 (`publish-yayanews.sh`) 守护逻辑：
它会在云端无头自动完成以下操作：
1. `npm ci` (锁版本安装前端包)
2. `pip install -r apps/pipeline/requirements.txt` (更新采集脚本包)
3. **🔥 核心**：`npm run db:init` (静默校验并刷入最新的表/字段 Schema)
4. `npm run build` (Next.js 打包)
5. `pm2 reload / restart` (无缝热切换流量)

## 四、 常见运维命令与逃生舱指南

### 1. 监控与排障
如果您遇到任何“应用挂起”、“500”或者“快讯断更”，请进入服务器终端执行：

- 监控各微服务状态图：`pm2 monit`
- 查阅前端/后端服务报错堆栈：`pm2 logs yayanews` (或者 `pm2 logs yaya-admin`)
- 查看 Python 爬虫报错：`pm2 logs yaya-pipeline-daemon`

### 2. 人工回滚（当自动化部署遭遇断电级灾难）
如果刚推的 Tag 导致全线 PM2 崩溃且启动不了，由于没有 Docker 镜像，需手工 Checkout 回上一个稳定版：
```bash
cd /var/www/yayanews
git checkout v1.2.9    # 回退到上一个没问题的 tag
bash deploy/publish-yayanews.sh   # 重新触发构建
```

### 3. 环境配置 (`.env`)
生产环境的关键密钥位于服务器根目录的 `.env` 中，其中最致命的一条配置是安全通道密文：
`ADMIN_API_TOKEN=biyapay1234`
此值如果不等于前台人工输入的密码，或者 `.env` 文件丢失，会导致管理员平台登录时出现无限的 401 报错。同时，`DATABASE_URL` 也请务必正确匹配 PostgreSQL 认证。
