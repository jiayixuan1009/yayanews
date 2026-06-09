# Cron and Scheduled Operations

This file is the source-of-truth register for production scheduled work on the
single VPS at `/var/www/yayanews`. Keep it updated whenever cron, PM2 modules,
or out-of-repo host scripts change.

Last verified against production: 2026-06-09.

## System Cron

Registered under the production Linux user, currently `root`.

| Schedule | Command | Purpose | Log |
| --- | --- | --- | --- |
| `*/2 * * * *` | `bash /var/www/yayanews/scripts/yaya-watchdog.sh` | Redis, PM2, web/admin/ws health self-healing | `/var/log/yayanews_watchdog.log` |
| `*/2 * * * *` | `/usr/local/bin/yaya-mem-watchdog.sh` | Host-level memory/load guard that restarts heavy workers when memory is low | `/var/log/yaya-mem-watchdog.log` |
| `0 */2 * * *` | `cd /var/www/yayanews && bash infra/scripts/backup-db.sh >> /var/log/yayanews-backup.log 2>&1` | PostgreSQL backup; script keeps latest backups and prunes old files | `/var/log/yayanews-backup.log` |
| `17 3 * * *` | `cd /var/www/yayanews && SESSIONFILTER_LOG_RETENTION_DAYS=7 LOG_RETENTION_DAYS=14 bash scripts/cleanup-production.sh >> /var/log/yayanews-cleanup.log 2>&1` | Prune old backups, build caches, Python caches, and logs | `/var/log/yayanews-cleanup.log` |

The versioned source for the memory watchdog is
[`scripts/maintenance/yaya-mem-watchdog.sh`](../../scripts/maintenance/yaya-mem-watchdog.sh).
Production may install it to `/usr/local/bin/yaya-mem-watchdog.sh`.

## PM2 Modules

| Module | Purpose | Verified Settings |
| --- | --- | --- |
| `pm2-logrotate` | Rotate PM2 stdout/stderr logs | `max_size=50M`, `retain=7`, `compress=true`, `dateFormat=YYYY-MM-DD_HH-mm-ss`, `rotateInterval="0 0 * * *"` |

Install or repair:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'
pm2 save
```

## App-Level Revalidation

These are not cron entries, but they affect production load and cache freshness.

| Route | Revalidate |
| --- | --- |
| `[lang]/page.tsx` | 60s |
| `[lang]/news/page.tsx` | 60s |
| `[lang]/article/[slug]/page.tsx` | 300s |
| `[lang]/topics/page.tsx` | 120s |
| `[lang]/topics/[slug]/page.tsx` | 180s |
| `[lang]/tag/[slug]/page.tsx` | 120s |
| `[lang]/flash/page.tsx` | 30s |
| `[lang]/flash/[slug]/page.tsx` | 60s |
| `app/sitemap.ts` | 3600s |
| `app/sitemap-news.xml/route.ts` | dynamic |
| `app/feed-news.xml/route.ts` | dynamic |
| `app/api/markets/coingecko/route.ts` | 30s |

## Troubleshooting

```bash
crontab -l
journalctl -u cron -n 200 --no-pager
tail -n 100 /var/log/yayanews_watchdog.log
tail -n 100 /var/log/yaya-mem-watchdog.log
tail -n 100 /var/log/yayanews-backup.log
tail -n 100 /var/log/yayanews-cleanup.log
pm2 conf pm2-logrotate
```

## Open Items

- Decide whether PostgreSQL dumps should be copied to off-host storage; local
  retention alone does not protect against disk or server loss.
