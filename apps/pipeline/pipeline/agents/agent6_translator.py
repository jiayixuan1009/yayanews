"""
Agent 6: 英文双语翻译 (English Translator)

优先：从信源 URL / NewsAPI（tickers）拉取英文原文；拿不到可靠正文时再调用 LLM 全文翻译。
"""
import json
import os
import psycopg2
from pipeline.utils.llm import chat
from pipeline.utils.logger import get_logger, step_print
from pipeline.utils.database import get_pool, insert_article, insert_tags, slug_exists
from pipeline.utils.slug_policy import make_article_slug, with_unique_slug_suffix
from pipeline.utils.fetch_english_source import (
    fetch_english_from_newsapi,
    fetch_english_from_polygon,
    fetch_english_from_source_url,
)
from psycopg2.extras import RealDictCursor
log = get_logger("agent6")


TRANSLATION_CANDIDATES_SQL = """
    SELECT
      a.*,
      la.loop_action_id,
      la.loop_action_status
    FROM articles a
    LEFT JOIN (
        SELECT DISTINCT ON (target_id)
          id AS loop_action_id,
          target_id,
          status AS loop_action_status,
          updated_at
        FROM loop_actions
        WHERE action_type = 'translate_en_priority'
          AND status IN ('queued', 'executed')
          AND target_id IS NOT NULL
        ORDER BY target_id, updated_at DESC, id DESC
    ) la ON la.target_id = a.id
    WHERE a.lang = 'zh'
      AND a.article_type != 'flash'
      AND a.status = 'published'
      AND a.deleted_at IS NULL
      AND a.is_indexable = TRUE
      AND (a.view_count >= %s OR la.target_id IS NOT NULL)
      AND a.id NOT IN (
          SELECT parent_id FROM articles
          WHERE lang = 'en' AND parent_id IS NOT NULL
      )
    ORDER BY
      CASE WHEN la.target_id IS NULL THEN 1 ELSE 0 END,
      COALESCE(la.updated_at, a.published_at) DESC,
      a.published_at DESC
    LIMIT %s
"""

TRANSLATION_CANDIDATES_FALLBACK_SQL = """
    SELECT *
    FROM articles
    WHERE lang = 'zh'
      AND article_type != 'flash'
      AND status = 'published'
      AND deleted_at IS NULL
      AND is_indexable = TRUE
      AND view_count >= %s
      AND id NOT IN (
          SELECT parent_id FROM articles
          WHERE lang = 'en' AND parent_id IS NOT NULL
      )
    ORDER BY published_at DESC
    LIMIT %s
"""


def _generate_english_slug(title: str) -> str:
    base = make_article_slug(title, lang="en", max_length=80)
    return with_unique_slug_suffix(base, slug_exists, max_length=80)

def _get_translation_candidates(limit: int = 5, min_views: int = 0) -> list[dict]:
    """
    Search PostgreSQL for high-quality Chinese articles that lack an English translation counterpart.

    Args:
        limit (int): Maximum number of candidate articles to pull per execution cycle.

    Returns:
        list[dict]: A list of PG row dictionaries representing untranslated articles.
    """
    conn = get_pool().getconn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            try:
                cur.execute(TRANSLATION_CANDIDATES_SQL, (min_views, limit))
            except psycopg2.errors.UndefinedTable:
                conn.rollback()
                cur.execute(TRANSLATION_CANDIDATES_FALLBACK_SQL, (min_views, limit))
            return [dict(r) for r in cur.fetchall()]
    finally:
        get_pool().putconn(conn)


def _record_loop_translation_result(action_id: int | None, status: str, message: str, evidence: dict | None = None) -> None:
    if not action_id:
        return
    conn = get_pool().getconn()
    try:
        with conn.cursor() as cur:
            next_status = "consumed" if status == "success" else "failed"
            cur.execute(
                """
                UPDATE loop_actions
                SET status = %s,
                    result = COALESCE(result, '{}'::jsonb) || %s::jsonb,
                    updated_at = CURRENT_TIMESTAMP,
                    executed_at = COALESCE(executed_at, CURRENT_TIMESTAMP)
                WHERE id = %s
                  AND action_type = 'translate_en_priority'
                """,
                (next_status, json.dumps(evidence or {}, ensure_ascii=False), action_id),
            )
            cur.execute(
                """
                INSERT INTO loop_action_results(action_id, status, message, evidence)
                VALUES (%s, %s, %s, %s::jsonb)
                """,
                (action_id, next_status, message, json.dumps(evidence or {}, ensure_ascii=False)),
            )
        conn.commit()
    except Exception as e:
        conn.rollback()
        log.warning(f"Failed to record Loop translation result for action {action_id}: {e}")
    finally:
        get_pool().putconn(conn)


def _translate_article(zh_article: dict) -> dict:
    prompt = f"""You are an expert bilingual financial journalist for YayaNews. 
Your task is to accurately translate and culturally adapt the following Chinese financial article into a native, high-quality English article.

Please retain the original HTML formatting (<p>, <h2>, <ul>, etc.) intact. Do NOT add markdown wrappers like ```html. 
Translate ALL JSON fields into English.

Original Title: {zh_article['title']}
Original Summary: {zh_article['summary']}
Original Content:
{zh_article['content']}

Output JSON Format ONLY:
{{
  "title": "[Native English SEO Title]",
  "summary": "[1-2 sentence English Meta Description]",
  "content": "<p>Translated HTML content...</p>",
  "tags": ["Tag1", "Tag2", "Tag3"],
  "sentiment": "bullish / bearish / neutral"
}}"""

    result = chat(
        "You are an expert financial journalist. Only output valid JSON.",
        prompt,
        temperature=0.4,
        max_tokens=4095
    )
    
    try:
        start = result.find("{")
        end = result.rfind("}") + 1
        if start >= 0 and end > start:
            data = json.loads(result[start:end])
            
            en_slug = _generate_english_slug(data.get("title") or f"EN {zh_article['id']}")

            # Map back required fields from zh_article and translated data
            return {
                **zh_article,
                "title": data.get("title", f"EN: {zh_article['title'][:30]}"),
                "summary": data.get("summary", ""),
                "content": data.get("content", ""),
                "tags": data.get("tags", []),
                "sentiment": (data.get("sentiment") or "neutral").lower(),
                "lang": "en",
                "slug": en_slug,
                "parent_id": zh_article["id"]
            }
    except Exception as e:
        log.warning(f"Failed to parse Agent 6 translation JSON for article {zh_article['id']}: {e}")
    return None


def _en_draft_from_api_blob(zh_article: dict, blob: dict) -> dict:
    """将 fetch_english_source 结果整理为与 _translate_article 相同下游字段。"""
    en_slug = _generate_english_slug(blob.get("title") or f"EN {zh_article['id']}")
    tickers = (zh_article.get("tickers") or "").strip()
    tags = [t.strip() for t in tickers.replace(";", ",").split(",") if t.strip()][:10]
    if not tags:
        tags = ["Markets"]
    return {
        **zh_article,
        "title": (blob.get("title") or "").strip(),
        "summary": (blob.get("summary") or "").strip(),
        "content": blob.get("content_html") or "",
        "tags": tags,
        "sentiment": "neutral",
        "lang": "en",
        "slug": en_slug,
        "parent_id": zh_article["id"],
        "_en_from": "api",
        "_en_source_url": (blob.get("source_url") or "").strip(),
    }


def _try_english_from_apis(zh_article: dict) -> dict | None:
    """先去 API / 信源页找英文原文；成功则返回与 _translate_article 同结构的 dict。"""
    su = (zh_article.get("source_url") or "").strip()
    if su:
        blob = fetch_english_from_source_url(su)
        if blob:
            log.info(f"[Agent 6] 使用信源 URL 英文正文: article_id={zh_article['id']} url={blob.get('source_url', '')[:80]}")
            return _en_draft_from_api_blob(zh_article, blob)
    news_key = os.environ.get("NEWSAPI_KEY", "").strip()
    if news_key:
        blob = fetch_english_from_newsapi(zh_article.get("tickers"), news_key)
        if blob:
            log.info(f"[Agent 6] 使用 NewsAPI 英文素材: article_id={zh_article['id']} q=tickers")
            return _en_draft_from_api_blob(zh_article, blob)
    poly_key = os.environ.get("POLYGON_KEY", "").strip()
    if poly_key:
        blob = fetch_english_from_polygon(zh_article.get("tickers"), poly_key)
        if blob:
            log.info(f"[Agent 6] 使用 Polygon 参考新闻英文素材: article_id={zh_article['id']}")
            return _en_draft_from_api_blob(zh_article, blob)
    return None


def translate_queue(batch_size: int = 5, force: bool = False) -> list[dict]:
    """
    The orchestrator queue for Agent 6. Processes up to `batch_size` Chinese articles,
    mutates them into native English formats via the LLM pipeline, and synchronizes 
    them back to the PostgreSQL database with `lang='en'`.
    
    When ENABLE_REALTIME_TRANSLATION is False, this function is a no-op to save tokens.
    Pass force=True for one-off backfill (e.g. CLI / npm run pipeline:translate-en).
    """
    from pipeline.config.settings import ENABLE_REALTIME_TRANSLATION, TRANSLATION_MIN_VIEWS
    
    if not force and not ENABLE_REALTIME_TRANSLATION:
        print("\n[Agent 6] 实时翻译已关闭 (ENABLE_REALTIME_TRANSLATION=0)，跳过英文翻译以节省 Token。")
        print("          一次性补齐可执行: npm run pipeline:translate-en   或  python -m pipeline.translate_en")
        return []
    
    min_views = 0 if force else TRANSLATION_MIN_VIEWS
    Candidates = _get_translation_candidates(limit=batch_size, min_views=min_views)
    if not Candidates:
        print(f"\n[Agent 6] 无需翻译的文章（min_views={min_views}）。")
        return []
        
    step_print("Agent 6: 英文版本地化", f"发现 {len(Candidates)} 篇待译文章 | min_views={min_views}")
    
    translated_count = 0
    results = []
    
    for zh in Candidates:
        loop_action_id = zh.get("loop_action_id")
        print(f"  [Agent 6.1] 正在处理: {zh['title'][:30]}...")
        en_draft = _try_english_from_apis(zh)
        if en_draft:
            print(f"    [API] 已命中英文原文，跳过全文 LLM 翻译")
        else:
            en_draft = _translate_article(zh)
        if en_draft and en_draft["content"]:
            en_source_url = (en_draft.pop("_en_source_url", None) or "").strip() or (zh.get("source_url") or "")
            # Insert into database
            fid = insert_article(
                title=en_draft["title"],
                slug=en_draft["slug"],
                summary=en_draft["summary"],
                content=en_draft["content"],
                category_id=en_draft["category_id"],
                article_type=en_draft["article_type"],
                author=en_draft["author"] or "YayaNews",
                status="published",
                published_at=zh["published_at"],
                sentiment=en_draft["sentiment"],
                tickers=zh["tickers"], # Keep original tickers
                source=zh["source"],
                source_url=en_source_url,
                subcategory=zh["subcategory"],
                lang="en",
                parent_id=en_draft["parent_id"],
                cover_image=zh.get("cover_image", "")
            )
            
            if fid > 0:
                translated_count += 1
                insert_tags(fid, en_draft.get("tags", []))
                results.append(en_draft)
                _record_loop_translation_result(
                    loop_action_id,
                    "success",
                    "Agent 6 created an English article from this translation priority.",
                    {
                        "source_article_id": zh["id"],
                        "english_article_id": fid,
                        "english_slug": en_draft["slug"],
                        "method": en_draft.get("_en_from") or "llm",
                    },
                )
                print(f"    [OK] 英文版入库成功 -> {en_draft['slug']}")
            else:
                _record_loop_translation_result(
                    loop_action_id,
                    "failed",
                    "Agent 6 failed to insert the English article.",
                    {"source_article_id": zh["id"], "reason": "insert_article returned 0"},
                )
                print(f"    [FAIL] 英文版入库失败 (可能 Slug 冲突)")
        else:
            _record_loop_translation_result(
                loop_action_id,
                "failed",
                "Agent 6 did not produce valid English content.",
                {"source_article_id": zh["id"]},
            )
            print(f"    [FAIL] API 与 LLM 均未产生有效英文正文")
            
    print(f"\n[Agent 6] 双语扩展流完成: 共产生 {translated_count} 篇纯净英文研报。")
    return results
