"""
Agent 4: SEO 优化（元数据 LLM 并行，slug 与正文后处理串行保证唯一）
"""
import copy
import json
from concurrent.futures import ThreadPoolExecutor

from slugify import slugify

from pipeline.utils.llm import chat
from pipeline.utils.database import slug_exists
from pipeline.utils.logger import get_logger, step_print
from pipeline.config.settings import SITE_URL, TRADING_SITE, PIPELINE_LLM_WORKERS

log = get_logger("agent4")

SYSTEM_PROMPT = """你是 SEO 专家兼金融分析师，精通 Google 搜索引擎优化和市场情绪判断。
你的任务是优化金融新闻文章的 SEO 元素，并分析市场情感倾向。"""


def _generate_slug(title: str) -> str:
    base = slugify(title, max_length=80)
    if not base:
        import hashlib
        base = hashlib.md5(title.encode()).hexdigest()[:12]

    slug = base
    counter = 1
    while slug_exists(slug):
        slug = f"{base}-{counter}"
        counter += 1
    return slug


def _writer_seo_complete(draft: dict) -> bool:
    """写作阶段已产出 SEO 元数据则跳过二次 LLM。"""
    if not draft.get("_writer_seo"):
        return False
    tags = draft.get("tags") or []
    if len(tags) < 2:
        return False
    if not (draft.get("seo_title") or draft.get("title")):
        return False
    if not (draft.get("seo_description") or draft.get("summary")):
        return False
    return True


def _from_writer_seo(draft: dict) -> dict:
    """沿用 Agent2 的 SEO 字段，仅规范化。"""
    d = copy.deepcopy(draft)
    d["title"] = (d.get("seo_title") or d.get("title") or "").strip()
    d["summary"] = (d.get("seo_description") or d.get("summary") or "")[:200]
    d.setdefault("tags", [])
    d.setdefault("sentiment", "neutral")
    d.setdefault("tickers", [])
    d.setdefault("key_points", [])
    return d


def _optimize_meta(draft: dict) -> dict:
    prompt = f"""请为以下金融新闻文章优化 SEO 元素并做情感分析。

标题：{draft['title']}
摘要：{draft.get('summary', '')}

请输出 JSON 格式：
{{
  "seo_title": "优化后标题（55字内，含核心关键词）",
  "seo_description": "优化后描述（120字内，含关键词，吸引点击）",
  "tags": ["标签1", "标签2", "标签3", "标签4", "标签5"],
  "sentiment": "bullish 或 bearish 或 neutral",
  "tickers": ["涉及的股票代码或币种，如 BTC, ETH, AAPL"],
  "key_points": ["核心要点1", "核心要点2", "核心要点3"]
}}

要求：
1. 标题含核心关键词，有吸引力
2. 描述简洁有力
3. 标签 3-5 个
4. sentiment 必须是 bullish/bearish/neutral 之一
5. tickers 提取文中涉及的具体资产代码（无则留空数组）
6. key_points 提取 2-3 个核心要点（每条20字内）
7. 中文输出（tickers 用英文代码）"""

    try:
        result = chat(SYSTEM_PROMPT, prompt, temperature=0.3, max_tokens=800)
        start = result.find("{")
        end = result.rfind("}") + 1
        if start >= 0 and end > start:
            data = json.loads(result[start:end])
            draft["title"] = data.get("seo_title", draft["title"])
            draft["summary"] = data.get("seo_description", draft.get("summary", ""))
            draft["tags"] = data.get("tags", [])
            draft["sentiment"] = data.get("sentiment", "neutral")
            draft["tickers"] = data.get("tickers", [])
            draft["key_points"] = data.get("key_points", [])
            return draft
    except Exception as e:
        log.warning(f"SEO meta optimization failed: {e}")

    draft.setdefault("tags", [])
    draft.setdefault("sentiment", "neutral")
    draft.setdefault("tickers", [])
    draft.setdefault("key_points", [])
    return draft


def _insert_internal_links(content: str) -> str:
    link_map = {
        "比特币": f'<a href="{SITE_URL}/search?q=%E6%AF%94%E7%89%B9%E5%B8%81">比特币</a>',
        "以太坊": f'<a href="{SITE_URL}/search?q=%E4%BB%A5%E5%A4%AA%E5%9D%8A">以太坊</a>',
        "美股": f'<a href="{SITE_URL}/news/us-stock">美股</a>',
        "港股": f'<a href="{SITE_URL}/news/hk-stock">港股</a>',
        "黄金": f'<a href="{SITE_URL}/search?q=%E9%BB%84%E9%87%91">黄金</a>',
        "原油": f'<a href="{SITE_URL}/search?q=%E5%8E%9F%E6%B2%B9">原油</a>',
    }

    replaced = set()
    for keyword, link in link_map.items():
        if keyword in content and keyword not in replaced:
            content = content.replace(keyword, link, 1)
            replaced.add(keyword)
            if len(replaced) >= 3:
                break

    return content


def _add_disclaimer(content: str, source: str = "") -> str:
    source_note = ""
    if source and source not in ("ai_generated", "YayaNews", "AI"):
        source_note = f"本文内容综合自 {source} 等公开信息来源。"

    disclaimer = (
        '<div class="disclaimer" style="margin-top:2em;padding:1em 1.2em;border-radius:8px;'
        'background:rgba(100,116,139,0.1);border:1px solid rgba(100,116,139,0.2);'
        'font-size:0.8em;color:#94a3b8;">'
        f'<p><strong>免责声明</strong></p>'
        f'<p>{source_note}'
        '本文仅供信息参考，不构成任何投资建议。金融市场有风险，投资需谨慎。'
        '文中数据及观点截至发稿时，可能随市场变化而变动。</p></div>'
    )
    return content + disclaimer


def _add_cta(content: str) -> str:
    cta = (
        f'<div class="cta-block" style="margin-top:1em;padding:1.5em;border-radius:12px;'
        f'background:linear-gradient(135deg,rgba(59,130,246,0.1),rgba(16,185,129,0.1));'
        f'border:1px solid rgba(59,130,246,0.2);">'
        f'<p><strong>开始您的交易之旅</strong></p>'
        f'<p>Yayapay 提供安全便捷的全球资产交易服务。'
        f'<a href="{TRADING_SITE}" target="_blank" rel="noopener noreferrer"'
        f' style="color:#3b82f6;font-weight:bold;"> 立即注册 →</a></p></div>'
    )
    return content + cta


def optimize(drafts: list[dict]) -> list[dict]:
    """先并行 LLM 元数据，再串行 slug（避免并发撞库）与正文后处理。"""
    skip_n = sum(1 for d in drafts if _writer_seo_complete(d))
    step_print(
        "Agent 4: SEO 优化",
        f"待优化: {len(drafts)} 篇 | 写作已含 SEO 跳过 LLM: {skip_n} 篇",
    )
    if not drafts:
        return []

    n = len(drafts)
    workers = max(1, min(PIPELINE_LLM_WORKERS, n, 8))

    def _meta_one(d: dict) -> dict:
        if _writer_seo_complete(d):
            return _from_writer_seo(d)
        return _optimize_meta(copy.deepcopy(d))

    metas: list[dict] = []
    with ThreadPoolExecutor(max_workers=workers) as pool:
        metas = list(pool.map(_meta_one, drafts))

    results = []
    for i, draft in enumerate(drafts):
        m = metas[i]
        d = {**draft}
        d["title"] = m.get("title", d["title"])
        d["summary"] = m.get("summary", d.get("summary", ""))
        d["tags"] = m.get("tags", [])
        d["sentiment"] = m.get("sentiment", "neutral")
        d["tickers"] = m.get("tickers", [])
        d["key_points"] = m.get("key_points", [])
        title = d.get("title", "?")[:40]
        try:
            d["slug"] = _generate_slug(d["title"])
            d["content"] = _insert_internal_links(d.get("content", ""))
            d["content"] = _add_disclaimer(d["content"], d.get("source", ""))
            d["content"] = _add_cta(d["content"])
            results.append(d)
            print(f"  [{i + 1}] OK: slug={d['slug']}, sentiment={d.get('sentiment')}, tickers={d.get('tickers')}")
        except Exception as e:
            log.error(f"SEO post-process failed for [{title}]: {e}")

    print(f"\n[Agent 4] SEO 优化完成: {len(results)}/{len(drafts)} 篇")
    return results
