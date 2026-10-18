# YayaNews 部署指南

## 服务器环境

| 项目 | 配置 |
|------|------|
| **OS** | Ubuntu 24.04 LTS |
| **域名** | yayanews.cryptooptiontool.com |
| **应用目录** | `/var/www/yayanews` |
| **Node.js** | 22（目标；升级完成前仍接受 20.19+，见下文「Node 22 升级」） |
| **Python** | 3.10+ |
| **数据库** | PostgreSQL 16 + pgvector |
| **缓存/队列** | Redis 7 |
| **进程管理** | PM2 |
| **反向代理** | Nginx + Let's Encrypt |

## 首次部署

```bash
# 1. 克隆代码
cd /var/www
git clone https://github.com/jiayixuan1009/yayanews.git yayanews
cd yayanews

# 2. 配置环境变量
cp deploy/ENV.production.example .env
# 编辑 .env，填入所有密钥

# 3. 安装依赖
npm ci --include=dev
pip install -r apps/pipeline/requirements.txt

# 4. 构建
export NODE_ENV=production
npm run build

# 5. standalone 模式（build 脚本已自动处理 copy-standalone.mjs）
# 如需手动执行：node infra/scripts/copy-standalone.mjs

# 6. 启动所有服务
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # 设置开机自启

# 7. 配置 Nginx
sudo cp infra/nginx/yayanews.conf /etc/nginx/sites-available/yayanews
sudo ln -sf /etc/nginx/sites-available/yayanews /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 8. 申请 SSL
sudo certbot --nginx -d yayanews.cryptooptiontool.com
```

## 更新部署

```bash
cd /var/www/yayanews

# 拉取最新代码
git pull origin main

# 执行部署脚本
bash deploy/publish-yayanews.sh
```

或者通过 Git Tag 触发 GitHub Actions 自动部署（见 CI/CD 配置）。

## Nginx 配置

配置文件位置：`infra/nginx/yayanews.conf`

关键配置：
- HTTP → HTTPS 自动跳转
- WebSocket/SSE 长连接支持（`proxy_buffering off`）
- 上游 `127.0.0.1:3002`

## 数据库备份

```bash
# 手动备份
bash infra/scripts/backup-db.sh

# 自动备份（添加到 crontab）
# 生产现状：每 2 小时备份一次，日志写入 /var/log/yayanews-backup.log
0 */2 * * * cd /var/www/yayanews && bash infra/scripts/backup-db.sh >> /var/log/yayanews-backup.log 2>&1
```

## 常见问题

### PM2 进程异常退出

```bash
pm2 status                    # 查看状态
pm2 logs <进程名> --lines 50  # 查看最近日志
pm2 restart <进程名>          # 重启单个进程
pm2 restart ecosystem.config.cjs  # 重启所有
```

### 数据库连接失败

```bash
sudo systemctl status postgresql
sudo -u postgres psql -c "SELECT 1"
# 检查 .env 中的 DATABASE_URL
```

### Redis 连接失败

```bash
sudo systemctl status redis-server
redis-cli ping
# 应返回 PONG
```

## Node 22 升级（2026-10-18）

Node 20 已于 2026 年 4 月停止维护（不再有安全更新）。CI、Docker 和 `.nvmrc` 已改为 Node 22。`check:node` 暂时同时接受 20.19+ 和 22，所以服务器升级前部署照常进行。服务器需要人工升级一次：

```bash
# 1. 先看当前版本和安装方式
node -v && which node

# 2a. 如果是 NodeSource（apt）安装（which node 为 /usr/bin/node）
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2b. 如果是 nvm 安装（which node 在 ~/.nvm 下）
nvm install 22 && nvm alias default 22

# 3. 确认后让 PM2 守护进程改用新 Node
node -v          # 应为 v22.x
pm2 update
```

4. 在 GitHub Actions → Deploy to Production → Run workflow 触发一次正常部署，用 Node 22 重新安装依赖、构建并做冒烟检查（失败会自动回滚）。不要在 `/var/www/yayanews` 里手动 `npm ci`／`build`：工作区不干净时，部署会中止。
5. 部署成功后，`pm2 status` 中所有进程均为 online，并且 `npm run ops:public-health` 正常。之后从 `scripts/verify/check-node-version.mjs` 删除 20，并把 `package.json` 的 `engines` 收紧为 `>=22 <23`。

## 部署前检查

`deploy.yml` 先调用 `ci-node.yml`（lint、SEO 策略校验、完整构建、pipeline 编译），全部通过后才 SSH 部署；检查失败时不会触碰服务器。

