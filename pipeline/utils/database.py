"""PostgreSQL 数据库操作封装，支持异步多并发访问。"""
import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timezone, timedelta
from typing import Optional
from pipeline.utils.logger import get_logger
import redis

log = get_logger("db")

TZ_CN = timezone(timedelta(hours=8))
DB_URL = os.environ.get("DATABASE_URL", "postgresql://yayanews:yayanews_master@127.0.0.1:5432/yayanews")

redis_client = None
try:
    redis_client = redis.Redis(host='localhost', port=6379, db=0)
except Exception as e:
    log.error(f"Redis init failed: {e}")

def now_cn() -> str:
    """当前 UTC+8 时间，格式 YYYY-MM-DD HH:MM:SS"""
    return datetime.now(TZ_CN).strftime("%Y-%m-%d %H:%M:%S")

def get_conn():
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False
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
    ts = now_cn()
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO articles
                    (title, slug, summary, content, category_id, author, status, article_type,
                     sentiment, tickers, key_points, source, source_url, subcategory,
                     collected_at, published_at, created_at, updated_at, lang)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s,
                            %s, %s, %s, %s, %s, %s,
                            %s, %s, %s, %s, %s) RETURNING id""",
                    (title, slug, summary, content, category_id, author, status, article_type,
                     sentiment, tickers, key_points, source, source_url, subcategory,
                     collected_at or ts, published_at or ts, ts, ts, lang)
                )
                article_id = cur.fetchone()[0]
            conn.commit()
            log.info(f"Article inserted: id={article_id}, slug={slug}")
            
            if redis_client:
                try:
                    payload = {"type": "article", "id": article_id, "title": title, "slug": slug, "lang": lang, "created_at": ts}
                    redis_client.publish(f"article:new:{lang}", json.dumps(payload))
                except Exception as e:
                    log.error(f"Redis publish fail: {e}")
                    
            return article_id
    except psycopg2.IntegrityError as e:
        log.warning(f"Article already exists or constraint error: {e}")
        return -1
    except Exception as e:
        log.error(f"DB Error: {e}")
        return -1

def insert_tags(article_id: int, tag_names: list[str]):
    if not tag_names or article_id <= 0:
        return
    try:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                for name in tag_names:
                    slug = name.lower().replace(" ", "-")
                    cur.execute("INSERT INTO tags (name, slug) VALUES (%s, %s) ON CONFLICT (slug) DO NOTHING", (name, slug))
                    cur.execute("SELECT id FROM tags WHERE name = %s", (name,))
                    row = cur.fetchone()
                    if row:
                        cur.execute(
                            "INSERT INTO article_tags (article_id, tag_id) VALUES (%s, %s) ON CONFLICT (article_id, tag_id) DO NOTHING",
                            (article_id, row["id"])
                        )
            conn.commit()
            log.info(f"Tags linked to article {article_id}: {tag_names}")
    except Exception as e:
        log.error(f"Tags insert failed: {e}")

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
    ts = now_cn()
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO flash_news (title, content, category_id, importance, source, source_url, subcategory, collected_at, published_at, created_at, lang)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
                    (title, content, category_id, importance, source, source_url, subcategory, collected_at or ts, ts, ts, lang),
                )
                fid = cur.fetchone()[0]
            conn.commit()
            log.info(f"Flash inserted: id={fid}, lang={lang}, title={title[:30]}")
            
            if redis_client:
                try:
                    payload = {"type": "flash", "id": fid, "title": title, "lang": lang, "importance": importance, "created_at": ts}
                    redis_client.publish(f"flash:new:{lang}", json.dumps(payload))
                except Exception as e:
                    log.error(f"Redis flash publish fail: {e}")
                    
            return fid
    except Exception as e:
        log.error(f"Flash insert failed: {e}")
        return -1

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
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO pipeline_runs
                    (run_type, started_at, finished_at, total_seconds,
                     items_requested, items_produced, stage_timings, channel_timings,
                     error_count, notes)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
                    (run_type, started_at, finished_at, total_seconds,
                     items_requested, items_produced,
                     json.dumps(stage_timings or {}, ensure_ascii=False),
                     json.dumps(channel_timings or {}, ensure_ascii=False),
                     error_count, notes),
                )
                rid = cur.fetchone()[0]
            conn.commit()
            log.info(f"Pipeline run recorded: id={rid}, type={run_type}, {total_seconds:.1f}s")
            return rid
    except Exception as e:
        log.error(f"Pipeline run insert failed: {e}")
        return -1

def slug_exists(slug: str) -> bool:
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1 FROM articles WHERE slug = %s", (slug,))
                return cur.fetchone() is not None
    except:
        return False

def title_exists(title: str) -> bool:
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1 FROM articles WHERE title = %s", (title,))
                return cur.fetchone() is not None
    except:
        return False

def get_recent_titles(limit: int = 50) -> list[str]:
    try:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT title FROM articles ORDER BY created_at DESC LIMIT %s", (limit,))
                return [r["title"] for r in cur.fetchall()]
    except:
        return []

def get_recent_flashes(limit: int = 50) -> list[str]:
    try:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT title FROM flash_news ORDER BY created_at DESC LIMIT %s", (limit,))
                return [r["title"] for r in cur.fetchall()]
    except:
        return []
