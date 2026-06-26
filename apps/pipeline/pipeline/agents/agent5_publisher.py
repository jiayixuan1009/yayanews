"""
Agent 5: 入库发布
- 写入 PostgreSQL articles 表
- 关联 tags
- 入库后主动 Ping 谷歌 sitemap 以加速收录
"""
import requests
from pipeline.utils.database import (
    insert_article,
    insert_tags,
    get_conn,
    get_pool,
    find_similar_article_title,
    find_recent_source_url_article,
)
from pipeline.utils.logger import get_logger, step_print
from pipeline.config.settings import SITE_URL, CATEGORIES
from pipeline.cover_image import resolve_cover_for_article

log = get_logger("agent5")

GOOGLE_PING_URL = "https://www.google.com/ping"


_RSS_SOURCE_MAP = {
    "seekingalpha.com": "Seeking Alpha",
    "coindesk.com": "CoinDesk",
    "cointelegraph.com": "CoinTelegraph",
    "feedburner.com/CoinDesk": "CoinDesk",
    "reuters.com": "Reuters",
    "bloomberg.com": "Bloomberg",
    "cnbc.com": "CNBC",
    "wsj.com": "Wall Street Journal",
    "ft.com": "Financial Times",
}


def _resolve_source_label(source: str, source_url: str, article: dict) -> str:
    """根据 source 和 source_url 推断可读的来源名称。"""
    if source == "rss" and source_url:
        for domain, label in _RSS_SOURCE_MAP.items():
            if domain in source_url:
                return label
        try:
            from urllib.parse import urlparse
            host = urlparse(source_url).hostname or ""
            return host.replace("www.", "").split(".")[0].capitalize() or "RSS"
        except Exception:
            return "RSS"
    if source == "ai_generated":
        return "YayaNews"
    return source or "YayaNews"


def _detect_subcategory(article: dict) -> str:
    """对 derivatives 分类的文章自动检测子分类。"""
    cat_slug = article.get("category_slug", "")
    cat_cfg = CATEGORIES.get(cat_slug, {})
    subcats = cat_cfg.get("subcategories")
    if not subcats:
        return ""
    text = f"{article.get('title', '')} {article.get('content', '')}".lower()
    for sub_slug, sub_cfg in subcats.items():
        if any(kw.lower() in text for kw in sub_cfg["keywords"]):
            return sub_slug
    return "commodity"


def _resolve_source_type(source: str, source_label: str, article: dict) -> str:
    explicit = (article.get("source_type") or "").strip()
    allowed = {"original", "syndicated", "translated", "ai_assisted", "sponsored", "partner"}
    if explicit in allowed:
        return explicit
    if source == "ai_generated" or source_label == "YayaNews":
        return "ai_assisted" if article.get("_ai_assisted") else "original"
    if source_label and source_label != "YayaNews":
        return "syndicated"
    return "original"


def _author_slug(name: str) -> str:
    import hashlib
    import re

    raw = (name or "YayaNews").strip() or "YayaNews"
    lower = raw.lower()
    if lower in {"yayanews", "yaya financial news"} or "editorial" in lower:
        return "yayanews-editorial"
    if lower in {"ai", "yayanews ai desk"}:
        return "yayanews-ai-desk"
    slug = re.sub(r"[^a-z0-9]+", "-", lower.replace("&", " and ")).strip("-")
    return slug or f"author-{hashlib.md5(raw.encode('utf-8')).hexdigest()[:12]}"


def _resolve_author_id(display_name: str, role: str, external_url: str = "") -> int | None:
    slug = _author_slug(display_name)
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM authors WHERE slug = %s", (slug,))
            row = cur.fetchone()
            if row:
                return row[0]
            cur.execute(
                """
                INSERT INTO authors
                    (slug, display_name, role, profile_url, status, review_status, is_external_source, external_source_url)
                VALUES (%s, %s, %s, %s, 'active', 'pending', %s, %s)
                RETURNING id
                """,
                (slug, display_name, role, f"/authors/{slug}", role == "syndication_source", external_url or None)
            )
            author_id = cur.fetchone()[0]
        conn.commit()
        return author_id
    except Exception as e:
        conn.rollback()
        log.warning(f"Author resolve skipped: {e}")
        return None
    finally:
        get_pool().putconn(conn)


def _ping_google():
    """Google /ping 已废弃（始终返回 404），改为仅记日志。收录改由 IndexNow + GSC 驱动。"""
    log.info(f"Google sitemap ping skipped (deprecated API). Relying on IndexNow + GSC.")


def publish(articles: list[dict]) -> list[dict]:
    """
    主入口：将通过审核和 SEO 优化的文章写入数据库。
    """
    step_print("Agent 5: 入库发布", f"待发布: {len(articles)} 篇")

    published = []
    for i, article in enumerate(articles, 1):
        title = article.get("title", "?")[:40]
        slug = article.get("slug", "")
        content = article.get("content", "")
        summary = article.get("summary", "")
        category_id = article.get("category_id", 1)
        article_type = article.get("type", "standard")
        tags = article.get("tags", [])
        sentiment = article.get("sentiment", "")
        tickers = article.get("tickers", [])
        key_points = article.get("key_points", [])
        source = article.get("source", "")
        source_url = article.get("source_url", "")
        lang = article.get("lang", "zh") or "zh"

        if not slug or not content:
            log.warning(f"Skip [{title}]: missing slug or content")
            continue

        draft_id = article.get("draft_id")
        if not article.get("parent_id"):
            duplicate_url = find_recent_source_url_article(
                source_url,
                lang=lang,
                exclude_article_id=draft_id if draft_id and draft_id > 0 else None,
            )
            if duplicate_url:
                log.warning(
                    f"Skip [{title}]: duplicate source_url before publish "
                    f"existing_id={duplicate_url.get('id')} existing_title={duplicate_url.get('title')}"
                )
                print(f"  [{i}] SKIPPED DUPLICATE SOURCE_URL: {title}")
                continue

        source_label = _resolve_source_label(source, source_url, article)
        source_type = _resolve_source_type(source, source_label, article)
        author_display = source_label if source_type in {"syndicated", "translated", "partner"} else article.get("author", "YayaNews")
        author_role = "syndication_source" if source_type in {"syndicated", "translated", "partner"} else ("ai_assisted_desk" if source_type == "ai_assisted" else "news_writer")
        author_id = _resolve_author_id(author_display or "YayaNews", author_role, source_url if source_type in {"syndicated", "translated", "partner"} else "")
        original_url = article.get("original_url") or (source_url if source_type in {"syndicated", "translated", "partner"} else "")
        license_type = article.get("license_type") or ("rss" if source_type == "syndicated" and source == "rss" else "")
        subcategory = _detect_subcategory(article)

        # 解析、提取或生成合适的封面大图
        cover_res = resolve_cover_for_article(
            title=article.get("title", ""),
            summary=summary,
            source_url=source_url,
            is_original=source == "ai_generated"
        )
        cover_image = cover_res.url or ""
        duplicate = find_similar_article_title(
            article.get("title", ""),
            exclude_article_id=draft_id if draft_id and draft_id > 0 else None,
        )
        if duplicate:
            log.warning(
                f"Skip [{title}]: duplicate title before publish "
                f"reason={duplicate.get('reason')} existing_id={duplicate.get('id')} "
                f"similarity={duplicate.get('similarity')} existing_title={duplicate.get('title')}"
            )
            print(f"  [{i}] SKIPPED DUPLICATE TITLE ({duplicate.get('reason')}): {title}")
            continue

        if draft_id and draft_id > 0:
            from pipeline.utils.database import update_article_full
            success = update_article_full(
                article_id=draft_id,
                title=article.get("title", ""),
                slug=slug,
                summary=summary,
                content=content,
                category_id=category_id,
                article_type=article_type,
                status="published",
                sentiment=sentiment,
                tickers=",".join(tickers) if tickers else "",
                key_points="\n".join(key_points) if key_points else "",
                source=source_label,
                source_url=source_url,
                source_type=source_type,
                original_url=original_url,
                license_type=license_type,
                author_id=author_id,
                is_indexable=bool(slug and content and title),
                subcategory=subcategory,
                cover_image=cover_image,
            )
            article_id = draft_id if success else -1
        else:
            article_id = insert_article(
                title=article.get("title", ""),
                slug=slug,
                summary=summary,
                content=content,
                category_id=category_id,
                article_type=article_type,
                status="published",
                sentiment=sentiment,
                tickers=",".join(tickers) if tickers else "",
                key_points="\n".join(key_points) if key_points else "",
                source=source_label,
                source_url=source_url,
                source_type=source_type,
                original_url=original_url,
                license_type=license_type,
                author_id=author_id,
                is_indexable=bool(slug and content and title),
                subcategory=subcategory,
                collected_at=article.get("collected_at"),
                cover_image=cover_image,
            )

        if article_id > 0:
            if tags:
                insert_tags(article_id, tags)
                
            from pipeline.utils.topic_tagger import auto_assign_topic
            auto_assign_topic(article_id, title, ",".join(tickers) if tickers else "")

            from pipeline.agents.agent7_auditor import audit_article
            audit_article(
                article_id=article_id,
                title=title,
                content=content,
                source=article.get("original_content", "")
            )
            
            published.append({**article, "id": article_id})
            s_label = f" [{sentiment}]" if sentiment else ""
            print(f"  [{i}] PUBLISHED: id={article_id}{s_label} slug={slug}")
        else:
            print(f"  [{i}] FAILED: {title}")

    if published:
        _ping_google()

    print(f"\n[Agent 5] 发布完成: {len(published)}/{len(articles)} 篇入库")
    return published
