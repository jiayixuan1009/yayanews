# YayaNews 部署指南

## 服务器环境

| 项目 | 配置 |
|------|------|
| **OS** | Ubuntu 24.04 LTS |
| **域名** | yayanews.cryptooptiontool.com |
| **应用目录** | `/var/www/yayanews` |
| **Node.js** | >= 18.17 |
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
# 每天凌晨 2 点备份
0 2 * * * cd /var/www/yayanews && bash infra/scripts/backup-db.sh
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
