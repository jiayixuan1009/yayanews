"""
Agent 5: 入库发布
- 写入 PostgreSQL articles 表
- 关联 tags
- 入库后主动 Ping 谷歌 sitemap 以加速收录
"""
import requests
from pipeline.utils.database import insert_article, insert_tags
from pipeline.utils.logger import get_logger, step_print
from pipeline.config.settings import SITE_URL, CATEGORIES

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


def _ping_google():
    """入库后主动通知谷歌更新 sitemap，加速新闻收录。"""
    sitemap_url = f"{SITE_URL}/sitemap-news.xml"
    try:
        resp = requests.get(GOOGLE_PING_URL, params={"sitemap": sitemap_url}, timeout=10)
        if resp.status_code == 200:
            log.info(f"Google ping OK: {sitemap_url}")
        else:
            log.warning(f"Google ping returned {resp.status_code}")
    except Exception as e:
        log.warning(f"Google ping failed (non-critical): {e}")


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

        source_label = _resolve_source_label(source, source_url, article)
        subcategory = _detect_subcategory(article)

        if not slug or not content:
            log.warning(f"Skip [{title}]: missing slug or content")
            continue

        draft_id = article.get("draft_id")
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
                subcategory=subcategory,
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
                subcategory=subcategory,
                collected_at=article.get("collected_at"),
            )

        if article_id > 0:
            if tags:
                insert_tags(article_id, tags)
            published.append({**article, "id": article_id})
            s_label = f" [{sentiment}]" if sentiment else ""
            print(f"  [{i}] PUBLISHED: id={article_id}{s_label} slug={slug}")
        else:
            print(f"  [{i}] FAILED: {title}")

    if published:
        _ping_google()

    print(f"\n[Agent 5] 发布完成: {len(published)}/{len(articles)} 篇入库")
    return published
