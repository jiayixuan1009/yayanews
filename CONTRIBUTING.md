# 🚀 YayaNews 最小启动手册 (Run & Contribute)

这本手册是为了防止我在 3 个月后重装系统，或者克隆代码到新的 Ubuntu VPS 里，忘记了如何把这套庞大的 Node+Python 混合引擎点燃而写。

## 🧱 0. 先决条件 (Prerequisites)
- **Node.js**: >= 18.17 (推荐 20.x，用于 Next.js App Router 编译)
- **Python**: >= 3.10 (爬虫与大模型文本分词强依赖)
- **Database**: PostgreSQL 14+ (必须支持并挂载了 `pgvector` 插件)
- **Cache**: Redis ^6.0 (必须挂载在 6379 端口供频道 Pub/Sub 订阅)

## 🔑 1. 钥匙入场 (.env)
不要在文件库里找账号密码。第一步，在根目录创建一份真正的 `.env`，你至少需要：
```env
# 数据库主轴 (PostgreSQL)
DATABASE_URL="postgresql://yayanews:{YOUR_PASSWORD}@127.0.0.1:5432/yayanews"
REDIS_URL="redis://localhost:6379"

# 数据来源
FINNHUB_KEY="xxxxxx"
LLM_API_KEY="sk-xxxx" # 用于 Pipeline 里的新闻润色总结提取
```

## 🏗️ 2. 全仓安装与数据库唤醒
YayaNews 是 TypeScript Monorepo：
```bash
# 这一步会自动把 npm workspaces 给所有子工程装好依赖
npm install

# 第一次一定要拉库 (连接上方的 DATABASE_URL 执行 Schema 导入)
npm run db:init
npm run db:seed
```

## 🐍 3. 激活 Python 寄生环境
Python 不归 `npm` 管。推荐在仓库根目录执行 `npm run setup:python`（在 `apps/pipeline/.venv` 安装依赖）；或手动：
```bash
cd apps/pipeline
python3 -m venv .venv
source .venv/bin/activate  # (Windows: .venv\Scripts\activate)
pip install -r requirements.txt
```

## ⚡ 4. 开发态一键超频 (`npm run dev`)
以前你需要开 3 个黑框，现在不用了。在根目录：
```bash
npm run dev
```
它内置了 `concurrently`，会以不同颜色前缀一口气打印并分别启动：
1. **Web (C 端前台)**: `http://localhost:3000`
2. **Admin (后台仪表盘)**: `http://localhost:3003/admin`
3. **WS Gateway (实时推送)**: `:3001` (纯后台静默运行)

## 🚀 5. 正式部署挂载点 (`PM2`)
一旦你把整个代码丢给了 Linux 生产服务器：
```bash
# 1. 编译所有子应用并脱水 (Standalone化)
# 这里会产生 .next/standalone/，它是能被 docker run node 直接跑的
npm run build

# 2. 从 ecosystem 彻底唤醒 6 大进程簇
pm2 start ecosystem.config.cjs
```

如果你在 PM2 列表里看到了 `yayanews`、`yaya-admin`、`yaya-pipeline-worker` 并且 `status` 绿灯长亮，恭喜，金融信息引擎开始轰鸣。
