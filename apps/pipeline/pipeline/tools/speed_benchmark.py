"""
时效对比工具：对比本站文章与竞品的发布时间差。

流程：
  1. 从文章标题提取搜索关键词
  2. 用 Google News RSS 搜索相同新闻
  3. 解析竞品发布时间
  4. 计算时间差并入库 (PostgreSQL)

使用方式：
  python -m pipeline.tools.speed_benchmark              # 检测最近 20 篇
  python -m pipeline.tools.speed_benchmark --id 42      # 检测指定文章
  python -m pipeline.tools.speed_benchmark --hours 2    # 检测最近 2 小时发布的
"""
import argparse
import re
import time
import urllib.parse
from datetime import datetime, timezone, timedelta
from typing import Optional

import feedparser
import requests
from psycopg2.extras import RealDictCursor

from pipeline.config.settings import SITE_URL
from pipeline.utils.database import get_pool
from pipeline.utils.logger import get_logger

log = get_logger("speed_benchmark")
TZ_CN = timezone(timedelta(hours=8))

GOOGLE_NEWS_RSS = "https://news.google.com/rss/search"
USER_AGENT = "Mozilla/5.0 (compatible; YayaNews-Benchmark/1.0)"
REQUEST_TIMEOUT = 15
SEARCH_DELAY = 2.0


def _extract_keywords(title: str) -> str:
    """从标题中提取 Google 搜索关键词。"""
    noise = re.compile(r"[|｜—–\-\[\]【】《》「」（）()\s]+")
    cleaned = noise.sub(" ", title).strip()
    words = cleaned.split()
    if len(words) > 8:
        words = words[:8]
    return " ".join(words)


def _parse_rss_date(date_str: str) -> Optional[datetime]:
    """解析 RSS pubDate（RFC 822）为 UTC datetime。"""
    try:
        parsed = feedparser._parse_date(date_str)
        if parsed:
            return datetime(*parsed[:6], tzinfo=timezone.utc)
    except Exception:
        pass

    formats = [
        "%a, %d %b %Y %H:%M:%S %z",
        "%a, %d %b %Y %H:%M:%S GMT",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%SZ",
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(date_str, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            continue
    return None


def _search_google_news(query: str, hours: int = 48) -> list[dict]:
    """通过 Google News RSS 搜索新闻，返回结果列表。"""
    params = {
        "q": query,
        "hl": "zh-CN",
        "gl": "CN",
        "ceid": "CN:zh-Hans",
    }
    if hours <= 24:
        params["q"] += f" when:{hours}h"

    url = f"{GOOGLE_NEWS_RSS}?{urllib.parse.urlencode(params)}"
    log.info(f"Searching: {url}")

    try:
        resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        feed = feedparser.parse(resp.text)
    except Exception as e:
        log.error(f"Google News RSS request failed: {e}")
        return []

    results = []
    for entry in feed.entries:
        source = entry.get("source", {})
        source_name = source.get("title", "") if isinstance(source, dict) else str(source)
        pub_date = _parse_rss_date(entry.get("published", ""))

        if SITE_URL and SITE_URL in entry.get("link", ""):
            continue

        results.append({
            "title": entry.get("title", ""),
            "link": entry.get("link", ""),
            "source": source_name,
            "published": pub_date,
        })

    results.sort(key=lambda x: x["published"] or datetime.max.replace(tzinfo=timezone.utc))
    return results


def _to_cn_str(dt: Optional[datetime]) -> Optional[str]:
    if not dt:
        return None
    return dt.astimezone(TZ_CN).strftime("%Y-%m-%d %H:%M:%S")


def benchmark_article(article_id: int, title: str, published_at: str) -> dict:
    """对单篇文章执行时效对比。"""
    keywords = _extract_keywords(title)
    log.info(f"[Article {article_id}] keywords: {keywords}")

    try:
        our_dt = datetime.strptime(published_at, "%Y-%m-%d %H:%M:%S").replace(tzinfo=TZ_CN)
    except ValueError:
        try:
            our_dt = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
            if our_dt.tzinfo is None:
                our_dt = our_dt.replace(tzinfo=TZ_CN)
        except Exception:
            return {
                "status": "failed",
                "error": f"Cannot parse our published_at: {published_at}",
            }

    results = _search_google_news(keywords, hours=48)

    if not results:
        return {
            "status": "no_result",
            "search_query": keywords,
            "result_count": 0,
        }

    earliest = results[0]
    comp_dt = earliest["published"]

    if comp_dt:
        diff_seconds = (our_dt - comp_dt).total_seconds()
    else:
        diff_seconds = None

    return {
        "status": "done",
        "search_query": keywords,
        "result_count": len(results),
        "competitor_title": earliest["title"],
        "competitor_source": earliest["source"],
        "competitor_url": earliest["link"],
        "competitor_published_at": _to_cn_str(comp_dt),
        "diff_seconds": diff_seconds,
    }


def _save_result(conn, article_id: int, title: str, published_at: str, result: dict):
    """将对比结果写入 PostgreSQL speed_benchmarks 表。"""
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO speed_benchmarks
            (article_id, article_title, our_published_at, competitor_title,
             competitor_source, competitor_url, competitor_published_at,
             diff_seconds, search_query, result_count, status, error_message)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            article_id, title, published_at,
            result.get("competitor_title"),
            result.get("competitor_source"),
            result.get("competitor_url"),
            result.get("competitor_published_at"),
            result.get("diff_seconds"),
            result.get("search_query", ""),
            result.get("result_count", 0),
            result["status"],
            result.get("error", ""),
        ))
    conn.commit()


def run_for_article(article_id: int):
    """对指定文章执行对比并入库。"""
    conn = get_pool().getconn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT id, title, published_at FROM articles WHERE id = %s AND status = 'published'",
                (article_id,)
            )
            row = cur.fetchone()
            if not row:
                print(f"Article {article_id} not found or not published.")
                return

            cur.execute(
                "SELECT 1 FROM speed_benchmarks WHERE article_id = %s AND status = 'done'",
                (article_id,)
            )
            if cur.fetchone():
                print(f"Article {article_id} already benchmarked, skipping.")
                return

        result = benchmark_article(row["id"], row["title"], str(row["published_at"]))
        _save_result(conn, row["id"], row["title"], str(row["published_at"]), result)

        diff = result.get("diff_seconds")
        if diff is not None:
            sign = "慢" if diff > 0 else "快"
            print(f"  [{row['id']}] 比竞品{sign} {abs(diff):.0f}s | 竞品: {result.get('competitor_source', '?')}")
        else:
            print(f"  [{row['id']}] {result['status']} | {result.get('error', 'no competitor time')}")
    finally:
        get_pool().putconn(conn)


def run_batch(limit: int = 20, hours: Optional[int] = None):
    """批量检测最近发布的文章。"""
    conn = get_pool().getconn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            sql = """
                SELECT a.id, a.title, a.published_at FROM articles a
                LEFT JOIN speed_benchmarks sb ON a.id = sb.article_id AND sb.status = 'done'
                WHERE a.status = 'published' AND sb.id IS NULL
            """
            params: list = []
            if hours:
                sql += " AND a.published_at >= (NOW() - INTERVAL '%s hours')"
                params.append(hours)
            sql += " ORDER BY a.published_at DESC LIMIT %s"
            params.append(limit)

            cur.execute(sql, params)
            rows = cur.fetchall()

        print(f"\n[Speed Benchmark] 待检测: {len(rows)} 篇\n")

        for i, row in enumerate(rows, 1):
            print(f"({i}/{len(rows)}) {row['title'][:50]}...")
            result = benchmark_article(row["id"], row["title"], str(row["published_at"]))
            _save_result(conn, row["id"], row["title"], str(row["published_at"]), result)

            diff = result.get("diff_seconds")
            if diff is not None:
                sign = "慢" if diff > 0 else "快"
                print(f"  → 比竞品{sign} {abs(diff):.0f}s | {result.get('competitor_source', '?')}")
            else:
                print(f"  → {result['status']}")

            if i < len(rows):
                time.sleep(SEARCH_DELAY)

        print(f"\n[Speed Benchmark] 完成: {len(rows)} 篇")
    finally:
        get_pool().putconn(conn)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="YayaNews 时效对比工具")
    parser.add_argument("--id", type=int, help="检测指定文章 ID")
    parser.add_argument("--limit", type=int, default=20, help="批量检测数量")
    parser.add_argument("--hours", type=int, help="只检测最近 N 小时发布的")
    args = parser.parse_args()

    if args.id:
        run_for_article(args.id)
    else:
        run_batch(limit=args.limit, hours=args.hours)
