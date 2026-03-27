"""
Agent 6: 英文双语翻译 (English Translator)

基于现存的中文深度文章，调用 LLM 完整重构英文原生版，并注入 SQLite (lang='en')。
"""
import json
import time
from pipeline.utils.llm import chat
from pipeline.utils.logger import get_logger, step_print
from pipeline.utils.database import get_conn, insert_article, insert_tags
from pipeline.config.settings import PIPELINE_LLM_WORKERS

log = get_logger("agent6")

def _get_translation_candidates(limit: int = 5) -> list[dict]:
    """
    Search PostgreSQL for high-quality Chinese articles that lack an English translation counterpart.
    
    This function specifically targets 'published' articles and ensures their slug does not 
    already exist with an '-en' suffix.
    
    Args:
        limit (int): Maximum number of candidate articles to pull per execution cycle.
        
    Returns:
        list[dict]: A list of SQLite/PG row dictionaries representing untranslated articles.
    """
    conn = get_conn()
    try:
        # 获取最新的中文文章
        # 通过 LIKE '%-en' 匹配现存的翻译稿 slug，过滤掉已经翻译过的内容
        rows = conn.execute(
            """
            SELECT * FROM articles 
            WHERE lang = 'zh' 
              AND article_type != 'flash'
              AND status = 'published'
              AND slug NOT LIKE '%-en'
              AND slug NOT IN (
                  SELECT REPLACE(slug, '-en', '') FROM articles WHERE lang = 'en'
              )
            ORDER BY published_at DESC LIMIT ?
            """, (limit,)
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()

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
            
            # Map back required fields from zh_article and translated data
            return {
                **zh_article,
                "title": data.get("title", f"EN: {zh_article['title'][:30]}"),
                "summary": data.get("summary", ""),
                "content": data.get("content", ""),
                "tags": data.get("tags", []),
                "sentiment": (data.get("sentiment") or "neutral").lower(),
                "lang": "en",
                "slug": f"{zh_article['slug']}-en" 
            }
    except Exception as e:
        log.warning(f"Failed to parse Agent 6 translation JSON for article {zh_article['id']}: {e}")
    return None

def translate_queue(batch_size: int = 5) -> list[dict]:
    """
    The orchestrator queue for Agent 6. Processes up to `batch_size` Chinese articles,
    mutates them into native English formats via the LLM pipeline, and synchronizes 
    them back to the PostgreSQL database with `lang='en'`.
    
    Args:
        batch_size (int): Max concurrent translation tasks.
        
    Returns:
        list[dict]: Output metadata of all successfully translated and ingested English articles.
    """
    Candidates = _get_translation_candidates(limit=batch_size)
    if not Candidates:
        print("\n[Agent 6] 无需翻译的文章。")
        return []
        
    step_print("Agent 6: 英文版本地化", f"发现 {len(Candidates)} 篇待译文章...")
    
    translated_count = 0
    results = []
    
    for zh in Candidates:
        print(f"  [Agent 6.1] 正在翻译: {zh['title'][:30]}...")
        en_draft = _translate_article(zh)
        if en_draft and en_draft["content"]:
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
                subcategory=zh["subcategory"],
                lang="en"
            )
            
            if fid > 0:
                translated_count += 1
                insert_tags(fid, en_draft.get("tags", []))
                results.append(en_draft)
                print(f"    [OK] 英文版入库成功 -> {en_draft['slug']}")
            else:
                print(f"    [FAIL] 英文版入库失败 (可能 Slug 冲突)")
        else:
            print(f"    [FAIL] 模型未返回有效翻译内容")
            
    print(f"\n[Agent 6] 双语扩展流完成: 共产生 {translated_count} 篇纯净英文研报。")
    return results
