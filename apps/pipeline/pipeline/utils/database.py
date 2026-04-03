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
DB_URL = os.environ.get("DATABASE_URL")
if not DB_URL:
    raise RuntimeError("[DB] DATABASE_URL environment variable is not set. Check your .env file.")
try:
    from pgvector.psycopg2 import register_vector
except ImportError:
    pass

redis_client = None
try:
    from pipeline.utils.redis_conn import get_redis_connection
    redis_client = get_redis_connection()
except Exception as e:
    log.error(f"Redis init failed: {e}")

from psycopg2.pool import ThreadedConnectionPool

def now_cn() -> str:
    """当前 UTC+8 时间，格式 YYYY-MM-DD HH:MM:SS"""
    return datetime.now(TZ_CN).strftime("%Y-%m-%d %H:%M:%S")

_pool = None

def get_pool():
    global _pool
    if _pool is None:
        _pool = ThreadedConnectionPool(1, 10, DB_URL)
    return _pool

def get_conn():
    """从连接池获取一个经过健康检查的连接（防止跨公网 TCP 被防火墙静默杀死）。"""
    pool = get_pool()
    conn = pool.getconn()
    try:
        # 快速探活：如果连接已死，这行会抛 OperationalError
        conn.isolation_level
        cur = conn.cursor()
        cur.execute("SELECT 1")
        cur.close()
    except Exception:
        # 连接已死，关掉残骸并重新拿一个
        try:
            pool.putconn(conn, close=True)
        except Exception:
            pass
        conn = pool.getconn()
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
    lang: str = "zh",
    embedding: Optional[list[float]] = None,
    cover_image: str = "",
    parent_id: Optional[int] = None
) -> int:
    ts = now_cn()
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            # Check slug uniqueness and mutate if collision exists
            original_slug = slug
            counter = 1
            while True:
                cur.execute("SELECT id FROM articles WHERE slug = %s", (slug,))
                if not cur.fetchone():
                    break
                slug = f"{original_slug}-{counter}"
                counter += 1
                
            cur.execute(
                """INSERT INTO articles
                (title, slug, summary, content, category_id, author, status, article_type,
                 sentiment, tickers, key_points, source, source_url, subcategory,
                 collected_at, published_at, created_at, updated_at, lang, embedding, cover_image, parent_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
                (title, slug, summary, content, category_id, author, status, article_type,
                 sentiment, tickers, key_points, source, source_url, subcategory,
                 collected_at or ts, published_at or ts, ts, ts, lang, embedding, cover_image, parent_id)
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
                
        if status == "published":
            from pipeline.utils.indexer import ping_indexer
            ping_indexer(article_slug=slug)
                
        return article_id
    except psycopg2.IntegrityError as e:
        conn.rollback()
        log.warning(f"Article already exists or constraint error: {e}")
        return -1
    except Exception as e:
        conn.rollback()
        log.error(f"DB Error: {e}")
        return -1
    finally:
        get_pool().putconn(conn)

def update_article_full(
    article_id: int,
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
    lang: str = "zh",
    embedding: Optional[list[float]] = None,
    cover_image: str = "",
    parent_id: Optional[int] = None
) -> bool:
    ts = now_cn()
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE articles SET
                    title=%s, slug=%s, summary=%s, content=%s, category_id=%s,
                    author=%s, status=%s, article_type=%s, sentiment=%s,
                    tickers=%s, key_points=%s, source=%s, source_url=%s,
                    subcategory=%s, published_at=%s, updated_at=%s,
                    lang=%s, embedding=%s, cover_image=%s, parent_id=%s
                WHERE id=%s
            """, (title, slug, summary, content, category_id,
                  author, status, article_type, sentiment,
                  tickers, key_points, source, source_url,
                  subcategory, published_at or ts, ts,
                  lang, embedding, cover_image, parent_id, article_id))
        conn.commit()
        log.info(f"Article updated: id={article_id}, slug={slug}")
        
        if status == "published":
            if redis_client:
                try:
                    payload = {"type": "article", "id": article_id, "title": title, "slug": slug, "lang": lang, "created_at": ts}
                    redis_client.publish(f"article:new:{lang}", json.dumps(payload))
                except Exception as e:
                    log.error(f"Redis publish fail: {e}")
            from pipeline.utils.indexer import ping_indexer
            ping_indexer(article_slug=slug)

        return True
    except Exception as e:
        conn.rollback()
        log.error(f"DB Error (update): {e}")
        return False
    finally:
        get_pool().putconn(conn)

def update_article_status(article_id: int, status: str, title: str = None) -> bool:
    ts = now_cn()
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            if title:
                cur.execute("UPDATE articles SET status=%s, title=%s, updated_at=%s WHERE id=%s", (status, title, ts, article_id))
            else:
                cur.execute("UPDATE articles SET status=%s, updated_at=%s WHERE id=%s", (status, ts, article_id))
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        return False
    finally:
        get_pool().putconn(conn)

def insert_tags(article_id: int, tag_names: list[str]):
    if not tag_names or article_id <= 0:
        return
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            for name in tag_names:
                from slugify import slugify
                slug = slugify(name, max_length=50)
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
        conn.rollback()
        log.error(f"Tags insert failed: {e}")
    finally:
        get_pool().putconn(conn)

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
    embedding: Optional[list[float]] = None,
) -> int:
    ts = now_cn()
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO flash_news (title, content, category_id, importance, source, source_url, subcategory, collected_at, published_at, created_at, lang, embedding)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
                (title, content, category_id, importance, source, source_url, subcategory, collected_at or ts, ts, ts, lang, embedding),
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
                
        # Proactively ping Google Indexer
        from pipeline.utils.indexer import ping_indexer
        ping_indexer(flash_dict={
            "id": fid,
            "title": title,
            "published_at": ts,
            "importance": importance
        })
                
        return fid
    except Exception as e:
        conn.rollback()
        log.error(f"Flash insert failed: {e}")
        return -1
    finally:
        get_pool().putconn(conn)

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
        conn.rollback()
        log.error(f"Pipeline run insert failed: {e}")
        return -1
    finally:
        get_pool().putconn(conn)

def slug_exists(slug: str) -> bool:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM articles WHERE slug = %s", (slug,))
            return cur.fetchone() is not None
    except Exception:
        return False
    finally:
        get_pool().putconn(conn)

def title_exists(title: str) -> bool:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM articles WHERE title = %s", (title,))
            return cur.fetchone() is not None
    except Exception:
        return False
    finally:
        get_pool().putconn(conn)

def get_recent_titles(limit: int = 50) -> list[str]:
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT title FROM articles ORDER BY created_at DESC LIMIT %s", (limit,))
            return [r["title"] for r in cur.fetchall()]
    except Exception:
        return []
    finally:
        get_pool().putconn(conn)

def get_recent_flashes(limit: int = 50) -> list[str]:
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT title FROM flash_news ORDER BY created_at DESC LIMIT %s", (limit,))
            return [r["title"] for r in cur.fetchall()]
    except Exception:
        return []
    finally:
        get_pool().putconn(conn)

def check_semantic_duplicate(embedding: list[float], threshold: float = 0.85) -> dict:
    """利用 pgvector 计算余弦相似度（<->/1-<=>）侦测近义洗稿"""
    if not embedding:
        return None
    conn = get_conn()
    try:
        from pgvector.psycopg2 import register_vector
        register_vector(conn)
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # PostgreSQL pgvector <=> 返回余弦距离 (cosine distance), 1 - cosine_distance 即为相似度
            cur.execute("""
                SELECT id, title, slug, 1 - (embedding <=> %s::vector) AS similarity 
                FROM articles
                WHERE embedding IS NOT NULL 
                ORDER BY embedding <=> %s::vector ASC 
                LIMIT 1
            """, (embedding, embedding))
            row = cur.fetchone()
            if row and row["similarity"] >= threshold:
                return dict(row)
            return None
    except Exception as e:
        log.warning(f"Semantic deduplication query failed: {e}")
        return None
    finally:
        get_pool().putconn(conn)
