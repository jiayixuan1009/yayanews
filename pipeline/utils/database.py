"""SQLite 数据库操作封装，供 Pipeline 各 Agent 使用。"""
import json
import sqlite3
from datetime import datetime, timezone, timedelta
from typing import Optional
from pipeline.config.settings import DB_PATH
from pipeline.utils.logger import get_logger

log = get_logger("db")

TZ_CN = timezone(timedelta(hours=8))


def now_cn() -> str:
    """当前 UTC+8 时间，格式 YYYY-MM-DD HH:MM:SS"""
    return datetime.now(TZ_CN).strftime("%Y-%m-%d %H:%M:%S")


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), timeout=15.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA busy_timeout=15000")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def insert_article(
    title: str,
    slug: str,
    summary: str,
    content: str,
    category_id: int,
    article_type: str = "standard",
    author: str = "YayaNews",
    status: str = "published",
    published_at: Optional[str] = None,
    sentiment: str = "",
    tickers: str = "",
    key_points: str = "",
    source: str = "",
    source_url: str = "",
    subcategory: str = "",
    collected_at: Optional[str] = None,
    lang: str = "zh"
) -> int:
    conn = get_conn()
    ts = now_cn()
    try:
        cur = conn.execute(
            """INSERT INTO articles
            (title, slug, summary, content, category_id, author, status, article_type,
             sentiment, tickers, key_points, source, source_url, subcategory,
             collected_at, published_at, created_at, updated_at, lang)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?)""",
            (title, slug, summary, content, category_id, author, status, article_type,
             sentiment, tickers, key_points, source, source_url, subcategory,
             collected_at or ts, published_at or ts, ts, ts, lang),
        )
        article_id = cur.lastrowid
        conn.commit()
        log.info(f"Article inserted: id={article_id}, slug={slug}")
        return article_id
    except sqlite3.IntegrityError as e:
        log.warning(f"Article already exists or constraint error: {e}")
        return -1
    finally:
        conn.close()


def insert_tags(article_id: int, tag_names: list[str]):
    if not tag_names or article_id <= 0:
        return
    conn = get_conn()
    try:
        for name in tag_names:
            slug = name.lower().replace(" ", "-")
            conn.execute("INSERT OR IGNORE INTO tags (name, slug) VALUES (?, ?)", (name, slug))
            row = conn.execute("SELECT id FROM tags WHERE name = ?", (name,)).fetchone()
            if row:
                conn.execute(
                    "INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)",
                    (article_id, row["id"]),
                )
        conn.commit()
        log.info(f"Tags linked to article {article_id}: {tag_names}")
    finally:
        conn.close()


def insert_flash(
    title: str,
    content: str,
    category_id: int,
    importance: str = "normal",
    source: Optional[str] = None,
    source_url: Optional[str] = None,
    subcategory: str = "",
    collected_at: Optional[str] = None,
    lang: str = "zh",
) -> int:
    conn = get_conn()
    ts = now_cn()
    try:
        cur = conn.execute(
            """INSERT INTO flash_news (title, content, category_id, importance, source, source_url, subcategory, collected_at, published_at, created_at, lang)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (title, content, category_id, importance, source, source_url, subcategory, collected_at or ts, ts, ts, lang),
        )
        fid = cur.lastrowid
        conn.commit()
        log.info(f"Flash inserted: id={fid}, lang={lang}, title={title[:30]}")
        return fid
    except Exception as e:
        log.error(f"Flash insert failed: {e}")
        return -1
    finally:
        conn.close()


def insert_pipeline_run(
    run_type: str,
    started_at: str,
    finished_at: str,
    total_seconds: float,
    items_requested: int = 0,
    items_produced: int = 0,
    stage_timings: Optional[dict] = None,
    channel_timings: Optional[dict] = None,
    error_count: int = 0,
    notes: str = "",
) -> int:
    conn = get_conn()
    try:
        cur = conn.execute(
            """INSERT INTO pipeline_runs
            (run_type, started_at, finished_at, total_seconds,
             items_requested, items_produced, stage_timings, channel_timings,
             error_count, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (run_type, started_at, finished_at, total_seconds,
             items_requested, items_produced,
             json.dumps(stage_timings or {}, ensure_ascii=False),
             json.dumps(channel_timings or {}, ensure_ascii=False),
             error_count, notes),
        )
        rid = cur.lastrowid
        conn.commit()
        log.info(f"Pipeline run recorded: id={rid}, type={run_type}, {total_seconds:.1f}s")
        return rid
    except Exception as e:
        log.error(f"Pipeline run insert failed: {e}")
        return -1
    finally:
        conn.close()


def slug_exists(slug: str) -> bool:
    conn = get_conn()
    try:
        row = conn.execute("SELECT 1 FROM articles WHERE slug = ?", (slug,)).fetchone()
        return row is not None
    finally:
        conn.close()


def title_exists(title: str) -> bool:
    conn = get_conn()
    try:
        row = conn.execute("SELECT 1 FROM articles WHERE title = ?", (title,)).fetchone()
        return row is not None
    finally:
        conn.close()


def get_recent_titles(limit: int = 50) -> list[str]:
    conn = get_conn()
    try:
        rows = conn.execute(
            "SELECT title FROM articles ORDER BY created_at DESC LIMIT ?", (limit,)
        ).fetchall()
        return [r["title"] for r in rows]
    finally:
        conn.close()
