"""
7×24 常驻调度 (RQ 版)：按间隔向 Redis 投递快讯与文章流水线任务，彻底解耦调度与执行。

环境变量（可选）：
  DAEMON_FLASH_SEC=300      快讯周期间隔（秒）
  DAEMON_ARTICLE_SEC=7200   文章周期间隔（秒）
  DAEMON_FLASH_COUNT=12     每轮快讯条数
  DAEMON_ARTICLE_COUNT=10   每轮文章篇数

用法：
  python -m pipeline.run_daemon

建议与 PM2 同机部署：
  pm2 start ecosystem.config.cjs
"""
import os
import sys
import time
import json
from datetime import datetime, timedelta, timezone
from rq import Queue
from pipeline.tasks import task_collect_and_enqueue_articles, task_run_flash
from pipeline.utils.redis_conn import get_redis_connection
from pipeline.utils.runtime_paths import get_pipeline_data_dir

FLASH_SEC = int(os.environ.get("DAEMON_FLASH_SEC", "60"))
ARTICLE_SEC = int(os.environ.get("DAEMON_ARTICLE_SEC", "1800"))
FLASH_COUNT = int(os.environ.get("DAEMON_FLASH_COUNT", "12"))
ARTICLE_COUNT = int(
    os.environ.get("DAEMON_ARTICLE_COUNT", os.environ.get("BATCH_SIZE", "10"))
)
SLEEP_SEC = min(60, max(15, FLASH_SEC // 4))

redis_host = os.environ.get("REDIS_HOST", "localhost")
redis_port = int(os.environ.get("REDIS_PORT", "6379"))

def main():
    try:
        redis_conn = get_redis_connection()
        q_flash = Queue('yayanews:flash', connection=redis_conn)
        q_articles = Queue('yayanews:articles', connection=redis_conn)
        tracked_queues = [
            q_flash,
            q_articles,
            Queue('yayanews:articles:high', connection=redis_conn),
            Queue('yayanews:articles:default', connection=redis_conn),
            Queue('yayanews:articles:low', connection=redis_conn),
        ]
    except Exception as e:
        print(f"[run_daemon] Redis connection failed: {e}", file=sys.stderr)
        sys.exit(1)

    now = time.time()
    next_flash = now
    next_article = now + 120
    last_config_ts = 0

    print(
        f"[run_daemon_rq] flash every {FLASH_SEC}s x {FLASH_COUNT}, "
        f"articles every {ARTICLE_SEC}s x {ARTICLE_COUNT}",
        flush=True,
    )

    data_dir = get_pipeline_data_dir()
    status_file = data_dir / "daemon_status.txt"
    heartbeat_file = data_dir / "daemon_heartbeat.txt"
    config_file = data_dir / "daemon_config.json"

    if not status_file.exists():
        status_file.write_text("running", encoding="utf-8")

    def _as_naive_utc(dt):
        if dt is None:
            return None
        if dt.tzinfo is not None:
            return dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt

    def _recent_failed_count(queue, since):
        count = 0
        for job_id in queue.failed_job_registry.get_job_ids():
            try:
                job = queue.fetch_job(job_id)
            except Exception:
                continue
            if not job:
                continue
            failed_at = _as_naive_utc(
                job.ended_at
                or getattr(job, "last_heartbeat", None)
                or job.enqueued_at
                or job.created_at
            )
            if failed_at and failed_at >= since:
                count += 1
        return count

    def write_heartbeat(msg="idle"):
        try:
            failed_total = sum(q.failed_job_registry.count for q in tracked_queues)
            failed_since = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=24)
            state = {
                "ts": time.time(),
                "msg": msg,
                "queued": sum(len(q) for q in tracked_queues),
                "started": sum(q.started_job_registry.count for q in tracked_queues),
                "failed": failed_total,
                "failed_total": failed_total,
                "failed_recent": sum(_recent_failed_count(q, failed_since) for q in tracked_queues),
                "finished": sum(q.finished_job_registry.count for q in tracked_queues),
            }
            heartbeat_file.write_text(json.dumps(state), encoding="utf-8")
        except Exception:
            pass

    while True:
        try:
            status = status_file.read_text(encoding="utf-8").strip()
        except Exception:
            status = "running"
            
        if status == "paused":
            write_heartbeat("Paused by admin")
            time.sleep(5)
            continue

        now = time.time()
        msg = "waiting"
        
        # Read dynamic UI parameters
        mode = "all"
        dyn_flash = FLASH_COUNT
        dyn_articles = ARTICLE_COUNT
        try:
            if config_file.exists():
                cfg = json.loads(config_file.read_text(encoding="utf-8"))
                mode = cfg.get("mode", "all")
                dyn_flash = int(cfg.get("flash", FLASH_COUNT))
                dyn_articles = int(cfg.get("articles", ARTICLE_COUNT))
                
                # If the UI just submitted a new config (timestamp changed), force immediate execution!
                cfg_ts = cfg.get("timestamp", 0)
                if cfg_ts > last_config_ts:
                    print(f"[run_daemon] Detected new UI config at {cfg_ts}. Forcing immediate dispatch!", flush=True)
                    last_config_ts = cfg_ts
                    next_flash = now
                    next_article = now
                    
        except Exception as e:
            print(f"[run_daemon] Failed to read config: {e}")
        
        if now >= next_flash:
            if mode in ["all", "flash"]:
                msg = f"Dispatching {dyn_flash} flash items"
                print(f"[Dispatch] Enqueue Flash ({dyn_flash}) @ {time.strftime('%H:%M:%S')}", flush=True)
                q_flash.enqueue(task_run_flash, count=dyn_flash, job_timeout=600)
            next_flash = now + FLASH_SEC
            
        if now >= next_article:
            if mode in ["all", "articles"]:
                msg = f"Dispatching collection for {dyn_articles} topics"
                print(f"[Dispatch] Enqueue Topic Collection ({dyn_articles}) @ {time.strftime('%H:%M:%S')}", flush=True)
                q_articles.enqueue(task_collect_and_enqueue_articles, batch_size=dyn_articles, job_timeout=600)
            next_article = now + ARTICLE_SEC

        write_heartbeat(msg)
        time.sleep(SLEEP_SEC)

if __name__ == "__main__":
    main()
