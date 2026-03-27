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
from pathlib import Path
from redis import Redis
from rq import Queue
from pipeline.tasks import task_run_articles_and_translate, task_run_flash

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
        redis_conn = Redis(host=redis_host, port=redis_port, db=0)
        q = Queue('yayanews', connection=redis_conn)
    except Exception as e:
        print(f"[run_daemon] Redis connection failed: {e}", file=sys.stderr)
        sys.exit(1)

    now = time.time()
    next_flash = now
    next_article = now + 120

    print(
        f"[run_daemon_rq] flash every {FLASH_SEC}s x {FLASH_COUNT}, "
        f"articles every {ARTICLE_SEC}s x {ARTICLE_COUNT}",
        flush=True,
    )

    data_dir = Path("data")
    data_dir.mkdir(exist_ok=True)
    status_file = data_dir / "daemon_status.txt"
    heartbeat_file = data_dir / "daemon_heartbeat.txt"

    if not status_file.exists():
        status_file.write_text("running")

    def write_heartbeat(msg="idle"):
        try:
            state = {
                "ts": time.time(),
                "msg": msg
            }
            heartbeat_file.write_text(json.dumps(state))
        except Exception:
            pass

    while True:
        try:
            status = status_file.read_text().strip()
        except Exception:
            status = "running"
            
        if status == "paused":
            write_heartbeat("Paused by admin")
            time.sleep(5)
            continue

        now = time.time()
        msg = "waiting"
        
        if now >= next_flash:
            msg = f"Dispatching {FLASH_COUNT} flash items"
            print(f"[Dispatch] Enqueue Flash ({FLASH_COUNT}) @ {time.strftime('%H:%M:%S')}", flush=True)
            q.enqueue(task_run_flash, kwargs={"count": FLASH_COUNT}, job_timeout=600)
            next_flash = now + FLASH_SEC
            
        if now >= next_article:
            msg = f"Dispatching {ARTICLE_COUNT} articles"
            print(f"[Dispatch] Enqueue Articles ({ARTICLE_COUNT}) @ {time.strftime('%H:%M:%S')}", flush=True)
            q.enqueue(task_run_articles_and_translate, kwargs={"batch_size": ARTICLE_COUNT}, job_timeout=3600)
            next_article = now + ARTICLE_SEC

        write_heartbeat(msg)
        time.sleep(SLEEP_SEC)

if __name__ == "__main__":
    main()
