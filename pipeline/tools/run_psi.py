"""
PageSpeed Insights API 跑分并写入 psi_reports。

需：GOOGLE_PAGESPEED_API_KEY（Google Cloud 启用 PageSpeed Insights API）
可选：PSI_URLS 逗号分隔完整 URL；否则用 SITE_URL 默认 4 个路径。

用法：
  python -m pipeline.tools.run_psi
  python -m pipeline.tools.run_psi --dry-run

定时（见 PRD §14.5）：例如 crontab 每周三 02:00 UTC
  0 2 * * 3 cd /path/to/biyanews && . ./.env && python -m pipeline.migrate_psi_reports; python -m pipeline.tools.run_psi
"""
import argparse
import json
import os
import sqlite3
import sys
from datetime import datetime
from pathlib import Path
import requests

PROJECT = Path(__file__).resolve().parent.parent.parent
DB_PATH = PROJECT / "data" / "yayanews.db"

SITE_URL = os.environ.get("SITE_URL", "https://yayanews.cryptooptiontool.com").rstrip("/")
API_KEY = os.environ.get("GOOGLE_PAGESPEED_API_KEY", "")

DEFAULT_PATHS = [
    ("home", "/"),
    ("news", "/news"),
    ("flash", "/flash"),
    ("news_ai", "/news/ai"),
]


def ensure_table(conn: sqlite3.Connection):
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS psi_reports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          page_key TEXT NOT NULL,
          url TEXT NOT NULL,
          strategy TEXT NOT NULL DEFAULT 'mobile',
          performance_score INTEGER,
          lcp_ms REAL,
          fcp_ms REAL,
          ttfb_ms REAL,
          cls REAL,
          raw_json TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.commit()


def run_one(url: str, strategy: str = "mobile") -> dict:
    api = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
    r = requests.get(
        api,
        params={"url": url, "key": API_KEY, "strategy": strategy, "category": "performance"},
        timeout=120,
    )
    r.raise_for_status()
    return r.json()


def extract(data: dict) -> tuple:
    lr = data.get("lighthouseResult") or {}
    cats = lr.get("categories") or {}
    perf = (cats.get("performance") or {}).get("score")
    score = int(round(perf * 100)) if perf is not None else None
    audits = lr.get("audits") or {}

    def num(key):
        v = audits.get(key, {}).get("numericValue")
        return float(v) if v is not None else None

    lcp = num("largest-contentful-paint")
    fcp = num("first-contentful-paint")
    ttfb = num("server-response-time")
    cls_v = num("cumulative-layout-shift")
    return score, lcp, fcp, ttfb, cls_v


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--strategy", default="mobile", choices=("mobile", "desktop"))
    args = parser.parse_args()

    if not API_KEY:
        print("请设置环境变量 GOOGLE_PAGESPEED_API_KEY", file=sys.stderr)
        sys.exit(1)

    raw_urls = os.environ.get("PSI_URLS", "").strip()
    if raw_urls:
        pairs = [(f"u{i}", u.strip()) for i, u in enumerate(raw_urls.split(","), 1) if u.strip()]
    else:
        pairs = [(k, SITE_URL + p) for k, p in DEFAULT_PATHS]

    ts = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

    rows = []
    for key, page_url in pairs:
        print(f"PSI {key}: {page_url} ...")
        try:
            data = run_one(page_url, args.strategy)
            score, lcp, fcp, ttfb, cls_v = extract(data)
            raw = json.dumps(data, ensure_ascii=False)[:500_000]
            rows.append((key, page_url, args.strategy, score, lcp, fcp, ttfb, cls_v, raw))
            print(f"  performance={score} LCP={lcp}ms")
        except Exception as e:
            print(f"  FAIL: {e}", file=sys.stderr)

    if args.dry_run or not rows:
        return

    conn = sqlite3.connect(str(DB_PATH))
    ensure_table(conn)
    for row in rows:
        conn.execute(
            """INSERT INTO psi_reports
            (page_key, url, strategy, performance_score, lcp_ms, fcp_ms, ttfb_ms, cls, raw_json, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (*row, ts),
        )
    conn.commit()
    conn.close()
    print(f"已写入 {len(rows)} 条 psi_reports")


if __name__ == "__main__":
    main()
