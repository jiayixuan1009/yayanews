"""Inspect RQ queue health without printing environment secrets."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

PIPELINE_APP_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = PIPELINE_APP_ROOT.parents[1]
sys.path.insert(0, str(PIPELINE_APP_ROOT))

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - production venv includes python-dotenv.
    load_dotenv = None

from rq import Queue

from pipeline.utils.redis_conn import get_redis_connection


DEFAULT_QUEUES = [
    "yayanews:flash",
    "yayanews:articles",
    "yayanews:articles:high",
    "yayanews:articles:default",
    "yayanews:articles:low",
]


def _one_line_exception(exc_info: str | None) -> str:
    if not exc_info:
        return ""
    lines = [line.strip() for line in exc_info.splitlines() if line.strip()]
    if not lines:
        return ""
    return lines[-1][:220]


def inspect_queue(name: str, limit: int) -> None:
    queue = Queue(name, connection=get_redis_connection())
    print(
        f"{name}: queued={len(queue)} started={queue.started_job_registry.count} "
        f"failed={queue.failed_job_registry.count} finished={queue.finished_job_registry.count}"
    )

    failed_ids = queue.failed_job_registry.get_job_ids()[-limit:]
    for job_id in failed_ids:
        job = queue.fetch_job(job_id)
        if job is None:
            print(f"  - {job_id}: missing")
            continue
        print(
            f"  - {job.id}: func={job.func_name} ended_at={job.ended_at} "
            f"error={_one_line_exception(job.exc_info)}"
        )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit", type=int, default=3, help="failed jobs to sample per queue")
    parser.add_argument("--queue", action="append", dest="queues", help="queue name to inspect")
    args = parser.parse_args()

    if load_dotenv is not None:
        load_dotenv(PROJECT_ROOT / ".env")

    for queue_name in args.queues or DEFAULT_QUEUES:
        inspect_queue(queue_name, max(0, args.limit))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
