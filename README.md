# YayaNews 📰

> 金融新闻自动采集、AI 加工、双语发布平台

[![CI](https://github.com/jiayixuan1009/yayanews/actions/workflows/ci.yml/badge.svg)](https://github.com/jiayixuan1009/yayanews/actions/workflows/ci.yml)

🌐 **线上地址**: [yayanews.cryptooptiontool.com](https://yayanews.cryptooptiontool.com)

## ✨ 功能特性

- **多源采集** — Finnhub、MarketAux、CryptoCompare 等金融数据源
- **AI 加工管线** — 6 个 Agent 串行处理：采集 → 改写 → 审核 → SEO → 发布 → 翻译
- **实时快讯** — Finnhub WebSocket + Redis Pub/Sub 实时推送
- **双语支持** — 中英文 i18n 路由，自动翻译
- **语义去重** — pgvector 向量相似度检测，避免重复内容
- **管理后台** — 实时监控管线状态、队列指标、内容管理

## 🚀 快速开始

### 前提条件

- Node.js >= 18.17.0
- Python 3.10+
- PostgreSQL 16（含 pgvector 扩展）
- Redis 7

### 本地开发

```bash
# 1. 克隆仓库
git clone https://github.com/jiayixuan1009/yayanews.git
cd yayanews

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 API Key 等

# 3. 安装依赖
npm install
pip install -r pipeline/requirements.txt

# 4. 初始化数据库
npm run db:init

# 5. 启动 Next.js 开发服务器
npm run dev

# 6. 启动 Pipeline（另一个终端）
python -m pipeline.run_daemon
```

### 可用脚本

```bash
npm run dev          # Next.js 开发服务器
npm run build        # 构建生产版本
npm run start        # 启动生产服务器
npm run lint         # 代码检查
npm run db:init      # 初始化数据库
npm run db:seed      # 填充测试数据
npm run covers:assign # 批量分配文章封面
```

## 📁 项目结构

```
├── src/              # Next.js 前端（App Router, i18n）
├── pipeline/         # Python 内容管线（6 Agents）
├── deploy/           # 部署配置（Nginx, PM2, 脚本）
├── scripts/          # 工具脚本
├── docs/             # 项目文档
└── public/           # 静态资源
```

详见 [docs/architecture.md](docs/architecture.md)

## 🖥️ 生产环境

### PM2 进程管理

```bash
# 启动所有服务
pm2 start ecosystem.config.cjs

# 查看状态
pm2 status

# 查看日志
pm2 logs yayanews
pm2 logs yaya-pipeline-daemon

# 重启
pm2 restart all
```

### 灾难恢复

| 症状 | 排查步骤 |
|------|----------|
| 快讯停止更新 | `sudo systemctl status redis-server` → `pm2 logs yaya-finnhub-ws` |
| 网站 500 错误 | `sudo systemctl status postgresql` → `pm2 logs yayanews` |
| 管线停滞 | `pm2 logs yaya-pipeline-daemon` → 检查 LLM API Key |

详见 [docs/deployment.md](docs/deployment.md)

## 📝 版本日志

见 [CHANGELOG.md](CHANGELOG.md)

## 📄 License

Private - All Rights Reserved
