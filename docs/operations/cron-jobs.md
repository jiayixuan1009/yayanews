# 计划任务（cron / pm2-logrotate）

> 产线节点统一登记。新增计划任务请同步 PR 修改本文件，避免运维侧"幽灵 cron"。
> 应用根目录约定为 `/var/www/yayanews`，Linux 用户 `root`（或受控 deploy 用户）。

---

## 1. 系统级 cron

通过 `crontab -e -u root` 注册，统一记录于此处。

| 频率 | 命令 | 用途 | 日志 | 来源脚本 |
|------|------|------|------|---------|
| `*/2 * * * *` | `bash /var/www/yayanews/scripts/yaya-watchdog.sh` | Redis / PM2 / 关键进程自愈 | `/var/log/yayanews_watchdog.log` | [scripts/yaya-watchdog.sh](../../scripts/yaya-watchdog.sh) |
| `0 2 * * *` | `cd /var/www/yayanews && bash infra/scripts/backup-db.sh` | PostgreSQL 全库 dump，保留 `KEEP_DAYS=30` | 控制台（重定向到 `backups/_cron.log` 推荐） | [infra/scripts/backup-db.sh](../../infra/scripts/backup-db.sh) |

> **手动触发**（应急/演练）：
> - 缩容止血：`bash /var/www/yayanews/infra/scripts/emergency_scale_down.sh` —— 不进 cron，由 oncall 手动执行。
> - Google Indexing 全量重推：`node /var/www/yayanews/infra/scripts/push-all-to-google.ts`。

## 2. PM2 内置任务

通过 `pm2 install <module>` 注册，存活在 PM2 daemon 内。

| 模块 | 用途 | 关键配置 |
|------|------|---------|
| `pm2-logrotate` | PM2 各进程 stdout/stderr 滚动 | `max_size 50M` / `retain 7` / `compress true` / `dateFormat YYYY-MM-DD_HH-mm-ss` / `rotateInterval 0 0 * * *` |

**部署命令**（首次或重装服务器）：

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'
pm2 save
```

## 3. 应用内 ISR / revalidate

非 cron，但具备类计划性质，对生产成本影响显著：

| 路由 | revalidate | 备注 |
|------|------------|------|
| `[lang]/page.tsx`（首页） | 60 s | |
| `[lang]/news/page.tsx` | 60 s | |
| `[lang]/article/[slug]/page.tsx` | 300 s | |
| `[lang]/topics/page.tsx` | 120 s | |
| `[lang]/topics/[slug]/page.tsx` | 180 s | |
| `[lang]/tag/[slug]/page.tsx` | 120 s | |
| `[lang]/flash/page.tsx` | 30 s | |
| `[lang]/flash/[slug]/page.tsx` | 60 s | |
| `app/sitemap.ts` | 3600 s | 大数据集，避免 SSR 超时 |
| `app/sitemap-news.xml/route.ts` | 0 / 强制实时 | |
| `app/feed-news.xml/route.ts` | 0 / 强制实时 | |
| `app/api/markets/coingecko/route.ts` | 30 s（Next fetch revalidate） | 防 CoinGecko 429 |

变更上述 ISR 节奏请同步本表，便于运维核对成本与抓取预算。

---

## 4. 排错

```bash
# 查看 cron 实际执行历史
journalctl -u cron -n 200 --no-pager

# 查看 watchdog 上次执行
tail -n 50 /var/log/yayanews_watchdog.log

# 查看 PM2 日志轮转配置
pm2 conf pm2-logrotate
```

## 5. 待办（如需新增）

- [ ] `infra/scripts/push-all-to-google.ts` 是否纳入周/日 cron（当前手动）
- [ ] PostgreSQL `pg_dump` 备份是否上传 OSS / 异地（当前仅本地保留 30 天）
