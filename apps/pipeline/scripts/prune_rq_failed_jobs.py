"""Prune old RQ failed-job registries without exposing environment secrets."""
from __future__ import annotations

import argparse
import re
import sys
from datetime import datetime, timedelta, timezone
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

ABANDONED_AT_RE = re.compile(r"\bat (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})(?:\.\d+)?")


def _as_naive_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is not None:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def _abandoned_at(exc_info: str | None) -> datetime | None:
    if not exc_info:
        return None
    match = ABANDONED_AT_RE.search(exc_info)
    if not match:
        return None
    try:
        return datetime.strptime(match.group(1), "%Y-%m-%d %H:%M:%S")
    except ValueError:
        return None


def _failed_at(job) -> datetime | None:
    return (
        _as_naive_utc(getattr(job, "ended_at", None))
        or _abandoned_at(getattr(job, "exc_info", None))
        or _as_naive_utc(getattr(job, "last_heartbeat", None))
        or _as_naive_utc(getattr(job, "enqueued_at", None))
        or _as_naive_utc(getattr(job, "created_at", None))
    )


def prune_queue(name: str, cutoff: datetime | None, dry_run: bool) -> tuple[int, int, int]:
    queue = Queue(name, connection=get_redis_connection())
    registry = queue.failed_job_registry
    removed = 0
    kept = 0
    missing = 0

    for job_id in registry.get_job_ids():
        job = queue.fetch_job(job_id)
        if job is None:
            missing += 1
            continue
        failed_at = _failed_at(job)
        if cutoff is not None and (failed_at is None or failed_at > cutoff):
            kept += 1
            continue
        if not dry_run:
            registry.remove(job, delete_job=True)
        removed += 1

    return removed, kept, missing


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--queue", action="append", dest="queues", help="queue name to prune")
    parser.add_argument(
        "--older-than-hours",
        type=float,
        default=24,
        help="remove failed jobs older than this many hours; ignored by --all",
    )
    parser.add_argument("--all", action="store_true", help="remove every failed job in the selected queues")
    parser.add_argument("--dry-run", action="store_true", help="show counts without deleting jobs")
    args = parser.parse_args()

    if load_dotenv is not None:
        load_dotenv(PROJECT_ROOT / ".env")

    cutoff = None
    if not args.all:
        cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=max(0, args.older_than_hours))

    total_removed = 0
    total_kept = 0
    total_missing = 0
    for queue_name in args.queues or DEFAULT_QUEUES:
        removed, kept, missing = prune_queue(queue_name, cutoff, args.dry_run)
        total_removed += removed
        total_kept += kept
        total_missing += missing
        action = "would_remove" if args.dry_run else "removed"
        print(f"{queue_name}: {action}={removed} kept={kept} missing={missing}")

    action = "would_remove" if args.dry_run else "removed"
    print(f"total: {action}={total_removed} kept={total_kept} missing={total_missing}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
