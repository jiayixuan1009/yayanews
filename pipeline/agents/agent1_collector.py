"""
Agent 1: 选题采集
- 基于关键词和分类生成选题（多分类并行 LLM）
- 从 RSS 源抓取素材
- 去重：跳过已有标题
"""
import random
from concurrent.futures import ThreadPoolExecutor, as_completed

import feedparser

from pipeline.config.settings import CATEGORIES, RSS_FEEDS, PIPELINE_COLLECT_WORKERS
from pipeline.utils.llm import chat
from pipeline.utils.database import get_recent_titles, now_cn
from pipeline.utils.logger import get_logger, step_print

log = get_logger("agent1")


def _fetch_rss(feed_url: str, limit: int = 5) -> list[dict]:
    """从 RSS 源获取最新条目。"""
    try:
        d = feedparser.parse(feed_url)
        items = []
        for entry in d.entries[:limit]:
            items.append({
                "title": entry.get("title", ""),
                "summary": entry.get("summary", "")[:500],
                "link": entry.get("link", ""),
            })
        log.info(f"RSS fetched {len(items)} items from {feed_url}")
        return items
    except Exception as e:
        log.warning(f"RSS fetch failed for {feed_url}: {e}")
        return []


def _generate_topics_by_keyword(category_slug: str, count: int = 5) -> list[dict]:
    """用 LLM 基于关键词生成选题。"""
    cat = CATEGORIES[category_slug]
    keywords = ", ".join(cat["keywords"])

    prompt = f"""你是金融新闻编辑。请为"{cat['name']}"频道生成{count}个新闻选题。

关键词参考：{keywords}

要求：
1. 选题要有新闻性和时效感（假设今天的新闻）
2. 覆盖不同子话题
3. 标题控制在 15-30 字
4. 每个选题标注类型：standard（分析文章800-1500字）或 deep（深度研报2000+字），约70%为standard、30%为deep

请以如下 JSON 数组格式输出，不要输出其他内容：
[{{"title": "标题", "type": "standard", "angle": "切入角度简述"}}]"""

    try:
        result = chat(
            system_prompt="你是专业金融新闻编辑，擅长发现市场热点。",
            user_prompt=prompt,
            temperature=0.8,
        )
        import json
        start = result.find("[")
        end = result.rfind("]") + 1
        if start >= 0 and end > start:
            topics = json.loads(result[start:end])
            for t in topics:
                t["category_slug"] = category_slug
                t["category_id"] = cat["id"]
                t["source"] = "ai_generated"
            log.info(f"Generated {len(topics)} topics for {cat['name']}")
            return topics
    except Exception as e:
        log.error(f"Topic generation failed for {category_slug}: {e}")
    return []


def _topics_from_rss(category_slug: str) -> list[dict]:
    """从 RSS 源提取选题素材。"""
    cat = CATEGORIES[category_slug]
    feeds = [f for f in RSS_FEEDS if f["category"] == category_slug]
    topics = []
    for feed in feeds:
        items = _fetch_rss(feed["url"], limit=3)
        for item in items:
            topics.append({
                "title": item["title"],
                "type": "standard",
                "angle": item["summary"][:200],
                "category_slug": category_slug,
                "category_id": cat["id"],
                "source": "rss",
                "source_url": item.get("link", ""),
                "original_content": item.get("summary", ""),
            })
    return topics


def _collect_one_category(cat_slug: str, min_per_cat: int, existing_titles: frozenset) -> tuple[str, list[dict]]:
    """单分类：LLM 选题 + RSS，本地去重。"""
    ai_topics = _generate_topics_by_keyword(cat_slug, count=min_per_cat)
    rss_topics = _topics_from_rss(cat_slug)
    seen_local: set[str] = set()
    out: list[dict] = []
    for t in ai_topics + rss_topics:
        title = t["title"].strip()
        if title in existing_titles or title in seen_local:
            continue
        seen_local.add(title)
        out.append(t)
    return cat_slug, out


def collect(batch_size: int = 10) -> list[dict]:
    """
    主入口：采集选题。各分类 LLM+Rss 并行，再全局配额合并。
    """
    step_print("Agent 1: 选题采集", f"目标数量: {batch_size}（分类并行）")

    existing_titles = frozenset(get_recent_titles(100))
    cats = list(CATEGORIES.keys())
    min_per_cat = max(1, batch_size // len(cats))
    workers = min(len(cats), max(1, PIPELINE_COLLECT_WORKERS))

    per_cat_topics: dict[str, list[dict]] = {slug: [] for slug in cats}
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futs = [pool.submit(_collect_one_category, slug, min_per_cat, existing_titles) for slug in cats]
        for fut in as_completed(futs):
            try:
                slug, topics = fut.result()
                per_cat_topics[slug] = topics
            except Exception as e:
                log.error(f"Category collect failed: {e}")

    result: list[dict] = []
    seen_global: set[str] = set()

    for slug in cats:
        for t in per_cat_topics[slug][:min_per_cat]:
            title = t["title"].strip()
            if title not in seen_global:
                seen_global.add(title)
                result.append(t)

    remaining = batch_size - len(result)
    if remaining > 0:
        extras = []
        for slug in cats:
            for t in per_cat_topics[slug][min_per_cat:]:
                title = t["title"].strip()
                if title not in seen_global:
                    seen_global.add(title)
                    extras.append(t)
        random.shuffle(extras)
        result.extend(extras[:remaining])

    ts = now_cn()
    for t in result:
        t["collected_at"] = ts

    print(f"\n[Agent 1] 采集完成: {len(result)}/{batch_size} 个选题")
    for i, t in enumerate(result, 1):
        cat_name = CATEGORIES.get(t.get("category_slug", ""), {}).get("name", "?")
        print(f"  {i}. [{cat_name}][{t.get('type','?')}] {t['title'][:50]}")

    return result
