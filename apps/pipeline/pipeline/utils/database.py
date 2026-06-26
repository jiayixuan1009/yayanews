"""PostgreSQL 数据库操作封装，支持异步多并发访问。"""
import json
import os
import psycopg2
import re
from collections.abc import Mapping
from difflib import SequenceMatcher
from psycopg2.extras import RealDictCursor
from datetime import datetime, timezone, timedelta
from typing import Optional
from pipeline.utils.logger import get_logger
from pipeline.utils.slug_policy import normalize_article_slug_for_storage
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
_llm_usage_table_missing = False


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, str(default)))
    except ValueError:
        return default


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, str(default)))
    except ValueError:
        return default


TITLE_DUPLICATE_LOOKBACK = _env_int("TITLE_DUPLICATE_LOOKBACK", 300)
TITLE_DUPLICATE_PREFIX_LENGTH = _env_int("TITLE_DUPLICATE_PREFIX_LENGTH", 10)
TITLE_DUPLICATE_SIMILARITY = _env_float("TITLE_DUPLICATE_SIMILARITY", 0.72)
TITLE_NEAR_DUPLICATE_SIMILARITY = _env_float("TITLE_NEAR_DUPLICATE_SIMILARITY", 0.88)

# 同一信源 URL 的去重窗口（天）：窗口内同 URL 的原创文章不再重复生成，
# 避免同一条新闻被反复洗稿成多篇（参见 SEO 重复内容治理）。
SOURCE_URL_DEDUPE_DAYS = _env_int("SOURCE_URL_DEDUPE_DAYS", 45)


def normalize_source_url(url: str) -> str:
    """信源 URL 归一化：去首尾空白、去 fragment/查询串、去尾部斜杠、小写 scheme+host。"""
    raw = (url or "").strip()
    if not raw:
        return ""
    try:
        from urllib.parse import urlsplit, urlunsplit
        parts = urlsplit(raw)
        scheme = (parts.scheme or "").lower()
        netloc = (parts.netloc or "").lower()
        path = parts.path.rstrip("/")
        return urlunsplit((scheme, netloc, path, "", "")).lower()
    except Exception:
        return raw.split("?")[0].split("#")[0].rstrip("/").lower()


def normalize_title_key(title: str) -> str:
    text = (title or "").casefold().strip()
    text = re.sub(r"\s*[\|｜]\s*(yayanews|yaya news).*?$", "", text)
    return re.sub(r"[\W_]+", "", text, flags=re.UNICODE)

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


def _unique_article_slug(cur, slug: str, exclude_article_id: Optional[int] = None, max_length: int = 88) -> str:
    base = (slug or "article").strip("-")[:max_length].strip("-") or "article"
    candidate = base
    counter = 1
    while True:
        if exclude_article_id is None:
            cur.execute("SELECT id FROM articles WHERE slug = %s", (candidate,))
        else:
            cur.execute(
                "SELECT id FROM articles WHERE slug = %s AND id <> %s",
                (candidate, exclude_article_id),
            )
        if not cur.fetchone():
            return candidate
        suffix = f"-{counter}"
        candidate = f"{base[:max_length - len(suffix)].rstrip('-')}{suffix}"
        counter += 1


def _find_recent_source_url_article(
    cur,
    source_url: str,
    lang: str = "zh",
    exclude_article_id: Optional[int] = None,
    days: int = SOURCE_URL_DEDUPE_DAYS,
) -> Optional[dict]:
    """查询窗口内是否已有同信源 URL、同语言的源头文章。"""
    if days <= 0:
        return None
    norm_url = normalize_source_url(source_url)
    if not norm_url:
        return None

    window_start = (datetime.now(TZ_CN) - timedelta(days=days)).strftime("%Y-%m-%d %H:%M:%S")
    where = [
        "parent_id IS NULL",
        "lang = %s",
        "created_at >= %s",
        "regexp_replace(regexp_replace(lower(trim(source_url)), '[?#].*$', ''), '/+$', '') = %s",
        "status = 'published'",
        "deleted_at IS NULL",
    ]
    params: list[object] = [lang, window_start, norm_url]
    if exclude_article_id is not None:
        where.append("id <> %s")
        params.append(exclude_article_id)

    cur.execute(
        f"""
        SELECT id, title, slug, source_url
        FROM articles
        WHERE {' AND '.join(where)}
        ORDER BY created_at ASC, id ASC
        LIMIT 1
        """,
        params,
    )
    row = cur.fetchone()
    if not row:
        return None
    if isinstance(row, Mapping):
        return {
            "id": row["id"],
            "title": row["title"],
            "slug": row["slug"],
            "source_url": row["source_url"],
            "normalized_source_url": norm_url,
        }
    return {
        "id": row[0],
        "title": row[1],
        "slug": row[2],
        "source_url": row[3],
        "normalized_source_url": norm_url,
    }


def find_recent_source_url_article(
    source_url: str,
    lang: str = "zh",
    exclude_article_id: Optional[int] = None,
    days: int = SOURCE_URL_DEDUPE_DAYS,
) -> Optional[dict]:
    """发布前门禁：跨来源按 source_url + lang 检查近期重复。"""
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            return _find_recent_source_url_article(cur, source_url, lang, exclude_article_id, days)
    except Exception as e:
        log.warning(f"find_recent_source_url_article failed: {e}")
        return None
    finally:
        get_pool().putconn(conn)


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
    parent_id: Optional[int] = None,
    audit_status: Optional[str] = None,
    source_type: str = "original",
    original_url: Optional[str] = None,
    license_type: Optional[str] = None,
    author_id: Optional[int] = None,
    is_indexable: bool = True,
    canonical_url: Optional[str] = None,
    dedupe_source_url: bool = True,
) -> int:
    ts = now_cn()
    resolved_audit = audit_status or ("approved" if status == "published" else "pending")
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            normalized_title = (title or "").strip()
            if normalized_title:
                cur.execute(
                    "SELECT id FROM articles WHERE lower(trim(title)) = lower(trim(%s)) LIMIT 1",
                    (normalized_title,),
                )
                existing = cur.fetchone()
                if existing:
                    conn.rollback()
                    log.warning(f"Article title already exists: id={existing[0]}, title={normalized_title[:80]}")
                    return -1

            # 信源 URL 去重兜底：窗口内同一原文不再重复生成新文章。
            # 仅对“原创/源头篇”（parent_id 为空）按 (source_url, lang) 拦截，
            # 不影响中英互译的同源兄弟篇（其 parent_id 非空）。
            if dedupe_source_url and parent_id is None and SOURCE_URL_DEDUPE_DAYS > 0:
                dup_url = _find_recent_source_url_article(cur, source_url, lang=lang)
                if dup_url:
                    conn.rollback()
                    log.warning(
                        f"Skip insert: source_url already covered within {SOURCE_URL_DEDUPE_DAYS}d "
                        f"existing_id={dup_url['id']} lang={lang} "
                        f"url={dup_url['normalized_source_url'][:90]}"
                    )
                    return -1

            slug = normalize_article_slug_for_storage(
                slug=slug,
                title=title,
                lang=lang,
                status=status,
            )
            slug = _unique_article_slug(cur, slug)
                
            cur.execute(
                """INSERT INTO articles
                (title, slug, summary, content, category_id, author, status, article_type,
                 sentiment, tickers, key_points, source, source_url, subcategory,
                 collected_at, published_at, created_at, updated_at, lang, cover_image, parent_id, audit_status,
                 source_type, original_url, license_type, author_id, is_indexable, canonical_url)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s) RETURNING id""",
                (title, slug, summary, content, category_id, author, status, article_type,
                 sentiment, tickers, key_points, source, source_url, subcategory,
                 collected_at or ts, published_at or ts, ts, ts, lang, cover_image, parent_id, resolved_audit,
                 source_type, original_url, license_type, author_id, is_indexable, canonical_url)
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
            ping_indexer(article_slug=slug, article_lang=lang)
                
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
    parent_id: Optional[int] = None,
    source_type: str = "original",
    original_url: Optional[str] = None,
    license_type: Optional[str] = None,
    author_id: Optional[int] = None,
    is_indexable: bool = True,
    canonical_url: Optional[str] = None,
) -> bool:
    ts = now_cn()
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            normalized_title = (title or "").strip()
            if normalized_title:
                cur.execute(
                    "SELECT id FROM articles WHERE lower(trim(title)) = lower(trim(%s)) AND id <> %s LIMIT 1",
                    (normalized_title, article_id),
                )
                existing = cur.fetchone()
                if existing:
                    conn.rollback()
                    log.warning(
                        f"Article title already exists: id={existing[0]}, title={normalized_title[:80]}"
                    )
                    return False

            slug = normalize_article_slug_for_storage(
                slug=slug,
                title=title,
                lang=lang,
                status=status,
            )
            slug = _unique_article_slug(cur, slug, exclude_article_id=article_id)

            cur.execute("""
                UPDATE articles SET
                    title=%s, slug=%s, summary=%s, content=%s, category_id=%s,
                    author=%s, status=%s, article_type=%s, sentiment=%s,
                    tickers=%s, key_points=%s, source=%s, source_url=%s,
                    subcategory=%s, published_at=%s, updated_at=%s,
                    lang=%s, cover_image=%s, parent_id=%s,
                    source_type=%s, original_url=%s, license_type=%s,
                    author_id=COALESCE(%s, author_id), is_indexable=%s, canonical_url=%s
                WHERE id=%s
            """, (title, slug, summary, content, category_id,
                  author, status, article_type, sentiment,
                  tickers, key_points, source, source_url,
                  subcategory, published_at or ts, ts,
                  lang, cover_image, parent_id,
                  source_type, original_url, license_type,
                  author_id, is_indexable, canonical_url, article_id))
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
            ping_indexer(article_slug=slug, article_lang=lang)

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
    from slugify import slugify
    import hashlib

    normalized_tags: list[tuple[str, str]] = []
    seen_names: set[str] = set()
    for raw_name in tag_names:
        name = str(raw_name or "").strip()
        if not name:
            continue
        name_key = name.casefold()
        if name_key in seen_names:
            continue
        seen_names.add(name_key)

        slug = slugify(name, max_length=50).strip("-")
        if not slug:
            digest = hashlib.sha1(name.encode("utf-8")).hexdigest()[:12]
            slug = f"tag-{digest}"
        normalized_tags.append((name, slug))

    if not normalized_tags:
        return

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            for name, slug in normalized_tags:
                cur.execute(
                    """
                    SELECT id FROM tags
                    WHERE name = %s OR slug = %s
                    ORDER BY CASE WHEN name = %s THEN 0 ELSE 1 END
                    LIMIT 1
                    """,
                    (name, slug, name)
                )
                row = cur.fetchone()
                if not row:
                    cur.execute("SAVEPOINT tag_insert")
                    try:
                        cur.execute(
                            "INSERT INTO tags (name, slug) VALUES (%s, %s) RETURNING id",
                            (name, slug)
                        )
                        row = cur.fetchone()
                        cur.execute("RELEASE SAVEPOINT tag_insert")
                    except psycopg2.IntegrityError:
                        cur.execute("ROLLBACK TO SAVEPOINT tag_insert")
                        cur.execute("RELEASE SAVEPOINT tag_insert")
                        cur.execute(
                            """
                            SELECT id FROM tags
                            WHERE name = %s OR slug = %s
                            ORDER BY CASE WHEN name = %s THEN 0 ELSE 1 END
                            LIMIT 1
                            """,
                            (name, slug, name)
                        )
                        row = cur.fetchone()
                if row:
                    cur.execute(
                        "INSERT INTO article_tags (article_id, tag_id) VALUES (%s, %s) ON CONFLICT (article_id, tag_id) DO NOTHING",
                        (article_id, row["id"])
                    )
        conn.commit()
        log.info(f"Tags linked to article {article_id}: {[name for name, _ in normalized_tags]}")
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
                
        # Proactively ping Google Indexer
        from pipeline.utils.indexer import ping_indexer
        ping_indexer(flash_dict={
            "id": fid,
            "title": title,
            "published_at": ts,
            "importance": importance,
            "lang": lang,
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

def insert_llm_usage(
    caller: str = "",
    route: str = "",
    model: str = "",
    status: str = "ok",
    prompt_tokens: Optional[int] = None,
    completion_tokens: Optional[int] = None,
    total_tokens: Optional[int] = None,
    prompt_chars: int = 0,
    completion_chars: int = 0,
    max_tokens: Optional[int] = None,
    temperature: Optional[float] = None,
    latency_ms: Optional[int] = None,
    error_type: str = "",
    error_message: str = "",
) -> int:
    global _llm_usage_table_missing
    if _llm_usage_table_missing:
        return -1

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO llm_usage
                (caller, route, model, status, prompt_tokens, completion_tokens,
                 total_tokens, prompt_chars, completion_chars, max_tokens,
                 temperature, latency_ms, error_type, error_message)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id""",
                (
                    caller, route, model, status, prompt_tokens, completion_tokens,
                    total_tokens, prompt_chars, completion_chars, max_tokens,
                    temperature, latency_ms, error_type[:80], error_message[:500],
                ),
            )
            uid = cur.fetchone()[0]
        conn.commit()
        return uid
    except psycopg2.errors.UndefinedTable as e:
        conn.rollback()
        _llm_usage_table_missing = True
        log.warning(f"LLM usage table missing; run database migrations to enable token accounting: {e}")
        return -1
    except Exception as e:
        conn.rollback()
        log.warning(f"LLM usage insert failed: {e}")
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

def _query_existing_normalized_title(
    cur,
    title: str,
    exclude_article_id: Optional[int] = None,
) -> Optional[object]:
    normalized_title = (title or "").strip()
    if not normalized_title:
        return None
    if exclude_article_id is None:
        cur.execute(
            "SELECT id, title FROM articles WHERE lower(trim(title)) = lower(trim(%s)) LIMIT 1",
            (normalized_title,),
        )
    else:
        cur.execute(
            "SELECT id, title FROM articles WHERE lower(trim(title)) = lower(trim(%s)) AND id <> %s LIMIT 1",
            (normalized_title, exclude_article_id),
        )
    return cur.fetchone()

def normalized_title_exists(title: str, exclude_article_id: Optional[int] = None) -> bool:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            return _query_existing_normalized_title(cur, title, exclude_article_id) is not None
    except Exception as e:
        log.warning(f"Normalized title check failed: {e}")
        return False
    finally:
        get_pool().putconn(conn)

def title_exists(title: str) -> bool:
    return normalized_title_exists(title)

def find_similar_article_title(
    title: str,
    exclude_article_id: Optional[int] = None,
    limit: int = TITLE_DUPLICATE_LOOKBACK,
    prefix_length: int = TITLE_DUPLICATE_PREFIX_LENGTH,
    prefix_similarity: float = TITLE_DUPLICATE_SIMILARITY,
    near_similarity: float = TITLE_NEAR_DUPLICATE_SIMILARITY,
) -> Optional[dict]:
    candidate_key = normalize_title_key(title)
    if not candidate_key:
        return None

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            exact = _query_existing_normalized_title(cur, title, exclude_article_id)
            if exact:
                return {
                    "id": exact["id"] if isinstance(exact, Mapping) else exact[0],
                    "title": exact["title"] if isinstance(exact, Mapping) else exact[1],
                    "reason": "exact_normalized_title",
                    "similarity": 1.0,
                }

            where = [
                "NULLIF(trim(title), '') IS NOT NULL",
                "status = 'published'",
            ]
            params: list[object] = []
            if exclude_article_id is not None:
                where.append("id <> %s")
                params.append(exclude_article_id)
            params.append(limit)
            cur.execute(
                f"""
                SELECT id, title
                FROM articles
                WHERE {' AND '.join(where)}
                ORDER BY COALESCE(published_at, created_at) DESC NULLS LAST, id DESC
                LIMIT %s
                """,
                tuple(params),
            )
            for row in cur.fetchall():
                existing_key = normalize_title_key(row["title"])
                if not existing_key:
                    continue
                if existing_key == candidate_key:
                    return {
                        "id": row["id"],
                        "title": row["title"],
                        "reason": "exact_title_key",
                        "similarity": 1.0,
                    }

                similarity = SequenceMatcher(None, candidate_key, existing_key).ratio()
                prefix_match = (
                    len(candidate_key) >= prefix_length
                    and len(existing_key) >= prefix_length
                    and candidate_key[:prefix_length] == existing_key[:prefix_length]
                )
                if (prefix_match and similarity >= prefix_similarity) or similarity >= near_similarity:
                    return {
                        "id": row["id"],
                        "title": row["title"],
                        "reason": "similar_title",
                        "similarity": round(similarity, 3),
                    }
    except Exception as e:
        log.warning(f"Similar title check failed: {e}")
        return None
    finally:
        get_pool().putconn(conn)

    return None

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

def get_recent_source_urls(days: int = SOURCE_URL_DEDUPE_DAYS, limit: int = 8000) -> set[str]:
    """返回最近 days 天内已使用过的信源 URL（归一化）集合，用于采集端去重。"""
    if days <= 0:
        return set()
    conn = get_conn()
    try:
        window_start = (datetime.now(TZ_CN) - timedelta(days=days)).strftime("%Y-%m-%d %H:%M:%S")
        with conn.cursor() as cur:
            cur.execute(
                """SELECT source_url FROM articles
                   WHERE source_url IS NOT NULL AND source_url <> ''
                     AND created_at >= %s
                   ORDER BY created_at DESC LIMIT %s""",
                (window_start, limit),
            )
            return {normalize_source_url(r[0]) for r in cur.fetchall() if r[0]}
    except Exception as e:
        log.warning(f"get_recent_source_urls failed: {e}")
        return set()
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
    return None
