"""
Agent 2: 内容生成（多选题并行 LLM）

三类内容策略：
  1. 转载改写(rss)：基于素材事实撰写独立中文文章
  2. AI 原创(ai_generated)：禁止捏造数字
  3. 深度文章(deep)
"""
import json
from concurrent.futures import ThreadPoolExecutor, as_completed

from pipeline.utils.llm import chat
from pipeline.utils.logger import get_logger, step_print
from pipeline.config.settings import CATEGORIES, PIPELINE_LLM_WORKERS

log = get_logger("agent2")

LENGTH_MAP = {
    "standard": {"min": 800, "max": 1500, "desc": "800-1500字分析文章"},
    "deep": {"min": 2000, "max": 3500, "desc": "2000字以上深度研报"},
}

SYSTEM_PROMPT = """你是专业金融新闻记者和分析师，服务于 YayaNews 金融新闻平台。
你的文章面向中文读者，需要专业、客观、有深度。

重要规则：
- 不得编造任何具体数字、价格、涨跌幅——如果不确定真实数据，用"据报道"、"市场数据显示"等模糊表述
- 所有观点分析必须有逻辑依据，不能凭空推测
- 输出格式：纯 HTML 正文（使用 <p>, <h2>, <h3>, <ul>, <li>, <strong> 等标签）
- 不要输出 markdown，不要输出 ```html 包裹，直接输出 HTML 内容"""


def _generate_original(topic: dict) -> dict:
    article_type = topic.get("type", "standard")
    length = LENGTH_MAP.get(article_type, LENGTH_MAP["standard"])
    cat_name = CATEGORIES.get(topic.get("category_slug", ""), {}).get("name", "金融")

    prompt = f"""请写一篇关于"{topic['title']}"的{cat_name}新闻文章。

切入角度：{topic.get('angle', '从市场影响和趋势角度分析')}
文章类型：{length['desc']}
分类：{cat_name}

要求：
1. 文章字数控制在 {length['min']}-{length['max']} 字
2. 涉及具体数据时，只引用广泛已知的事实（如"比特币在2024年突破10万美元"），不得编造精确到小数点的实时价格或涨跌幅
3. 如引用数据，请注明来源方向（如"据 CoinGecko 数据"、"根据美联储声明"）
4. 结构清晰，使用小标题分段
5. 语言专业但易读
6. 文章末尾加一段"风险提示"：提醒读者以上内容仅供参考，不构成投资建议
7. 输出纯 HTML 正文内容

请同时输出 SEO 与结构化字段（与正文同一次生成，勿分步）。

JSON 格式（仅此一个 JSON 对象）：
{{
  "content": "<p>正文HTML...</p>",
  "seo_title": "55字内优化标题，含核心关键词",
  "seo_description": "120字内 Meta 描述，吸引点击",
  "tags": ["标签1","标签2","标签3","标签4","标签5"],
  "sentiment": "bullish 或 bearish 或 neutral",
  "tickers": ["文中资产代码如 BTC、AAPL；无则空数组"],
  "key_points": ["要点1","要点2","要点3"]
}}"""

    result = chat(SYSTEM_PROMPT, prompt, temperature=0.7, max_tokens=4096)
    return _parse_result(result, topic)


def _rewrite_from_source(topic: dict) -> dict:
    source = topic.get("original_content", "")
    if not source:
        return _generate_original(topic)

    article_type = topic.get("type", "standard")
    length = LENGTH_MAP.get(article_type, LENGTH_MAP["standard"])

    prompt = f"""基于以下新闻素材的事实信息，撰写一篇中文金融新闻文章。

【素材】
{source[:2000]}

【要求】
1. 提取素材中的核心事实（谁、什么事、时间、关键数字）
2. 用独立的中文叙事写作，补充市场背景分析和投资者视角
3. 标题方向：{topic['title']}
4. 字数：{length['desc']}
5. 文末加风险提示
6. 输出纯 HTML

JSON（单对象，含 SEO，与上文原创稿相同字段）：
{{"content":"<p>...</p>","seo_title":"...","seo_description":"...","tags":[],"sentiment":"neutral","tickers":[],"key_points":[]}}"""

    result = chat(SYSTEM_PROMPT, prompt, temperature=0.7, max_tokens=4096)
    return _parse_result(result, topic)


def _parse_result(result: str, topic: dict) -> dict:
    try:
        start = result.find("{")
        end = result.rfind("}") + 1
        if start >= 0 and end > start:
            data = json.loads(result[start:end])
            seo_title = (data.get("seo_title") or "").strip() or topic.get("title", "")
            seo_desc = (data.get("seo_description") or data.get("summary") or "").strip()
            tags = data.get("tags") if isinstance(data.get("tags"), list) else []
            tickers = data.get("tickers") if isinstance(data.get("tickers"), list) else []
            kpts = data.get("key_points") if isinstance(data.get("key_points"), list) else []
            sent = (data.get("sentiment") or "neutral").lower()
            if sent not in ("bullish", "bearish", "neutral"):
                sent = "neutral"
            return {
                **topic,
                "content": data.get("content", "") or "",
                "summary": seo_desc[:200] if seo_desc else topic.get("angle", "")[:100],
                "title": seo_title,
                "seo_title": seo_title,
                "seo_description": seo_desc,
                "tags": tags[:8],
                "sentiment": sent,
                "tickers": [str(t) for t in tickers[:20]],
                "key_points": [str(p) for p in kpts[:5]],
                "_writer_seo": bool(seo_desc and tags),
            }
    except json.JSONDecodeError as e:
        log.warning(f"JSON parse failed, using raw content: {e}")

    return {
        **topic,
        "content": f"<p>{result}</p>",
        "summary": topic.get("angle", "")[:100],
        "_writer_seo": False,
    }


def _generate_one(idx: int, topic: dict) -> tuple[int, dict | None]:
    title = topic["title"][:40]
    source = topic.get("source", "ai_generated")
    try:
        if source == "rss" and topic.get("original_content"):
            draft = _rewrite_from_source(topic)
        else:
            draft = _generate_original(topic)
        if draft.get("content"):
            print(f"  [{idx + 1}] OK: {title}... ({len(draft['content'])} chars)")
            return idx, draft
        log.warning(f"Empty content for: {title}")
        return idx, None
    except Exception as e:
        log.error(f"Failed to generate [{title}]: {e}")
        return idx, None


def generate(topics: list[dict]) -> list[dict]:
    """多线程并行生成，保持选题顺序输出。"""
    n = len(topics)
    step_print("Agent 2: 内容生成", f"待生成: {n} 篇（并行 {min(PIPELINE_LLM_WORKERS, n)} 路）")
    if n == 0:
        return []

    workers = max(1, min(PIPELINE_LLM_WORKERS, n, 8))
    slots: list[dict | None] = [None] * n

    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(_generate_one, i, t): i for i, t in enumerate(topics)}
        for fut in as_completed(futures):
            idx, draft = fut.result()
            if draft:
                slots[idx] = draft

    results = [slots[i] for i in range(n) if slots[i] is not None]
    print(f"\n[Agent 2] 生成完成: {len(results)}/{n} 篇")
    return results
