"""
7×24 常驻调度：按间隔触发快讯与文章 Pipeline。

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
import subprocess
import sys
import time

FLASH_SEC = int(os.environ.get("DAEMON_FLASH_SEC", "300"))
ARTICLE_SEC = int(os.environ.get("DAEMON_ARTICLE_SEC", "7200"))
FLASH_COUNT = int(os.environ.get("DAEMON_FLASH_COUNT", "12"))
ARTICLE_COUNT = int(
    os.environ.get("DAEMON_ARTICLE_COUNT", os.environ.get("BATCH_SIZE", "10"))
)
SLEEP_SEC = min(60, max(15, FLASH_SEC // 4))


def main():
    py = sys.executable
    now = time.time()
    next_flash = now
    next_article = now + 120

    print(
        f"[run_daemon] flash every {FLASH_SEC}s x {FLASH_COUNT}, "
        f"articles every {ARTICLE_SEC}s x {ARTICLE_COUNT}",
        flush=True,
    )

    while True:
        now = time.time()
        if now >= next_flash:
            print(f"[run_daemon] flash-only @ {time.strftime('%H:%M:%S')}", flush=True)
            subprocess.run(
                [py, "-m", "pipeline.run", "--flash-only", "--flash", str(FLASH_COUNT)],
                check=False,
            )
            next_flash = now + FLASH_SEC
        if now >= next_article:
            print(f"[run_daemon] articles-only @ {time.strftime('%H:%M:%S')}", flush=True)
            subprocess.run(
                [
                    py,
                    "-m",
                    "pipeline.run",
                    "--articles-only",
                    "--articles",
                    str(ARTICLE_COUNT),
                ],
                check=False,
            )
            next_article = now + ARTICLE_SEC
        time.sleep(SLEEP_SEC)


if __name__ == "__main__":
    main()
