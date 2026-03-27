"""
快讯多通道并发采集引擎

架构：
  1. 各通道独立 fetch 函数，互不阻塞
  2. ThreadPoolExecutor 并发拉取所有启用的通道
  3. 英文内容统一收集后批量翻译（一次 LLM 调用处理 N 条）
  4. 按权重排序、去重、入库
  5. 通道健康检查：连续失败自动降级，恢复后自动升级

通道优先级（weight 越高越优先）：
  cn_sina(6) > cn_rss(5) ≈ Finnhub/WS(5) > Marketaux(4) > CryptoCompare(3) > CoinGecko(2) > RSS(1) > LLM(0)
"""
import json
import time
import requests
import feedparser
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

from pipeline.config.settings import (
    CATEGORIES, RSS_FEEDS, CN_FLASH_RSS_FEEDS,
    FLASH_CHANNELS, FLASH_CONCURRENCY, FLASH_TRANSLATE_BATCH, FLASH_WS_DRAIN_MAX,
)
from pipeline.utils.ws_flash_buffer import drain_ws_buffer
from pipeline.utils.database import insert_flash, now_cn, check_semantic_duplicate, get_pool
from pipeline.utils.llm import chat, batch_translate, compute_similarity, get_embedding
from pipeline.utils.logger import get_logger, step_print

log = get_logger("flash")

_channel_health: dict[str, dict] = {}


def _health(name: str) -> dict:
    if name not in _channel_health:
        _channel_health[name] = {"fails": 0, "last_ok": None, "degraded": False}
    return _channel_health[name]


def _mark_ok(name: str, count: int):
    h = _health(name)
    h["fails"] = 0
    h["last_ok"] = datetime.now().isoformat()
    if h["degraded"]:
        h["degraded"] = False
        log.info(f"[{name}] 通道恢复正常")


def _mark_fail(name: str, error: str):
    h = _health(name)
    h["fails"] += 1
    if h["fails"] >= 3 and not h["degraded"]:
        h["degraded"] = True
        log.warning(f"[{name}] 连续失败 {h['fails']} 次，自动降级")


def _is_degraded(name: str) -> bool:
    return _health(name).get("degraded", False)


def _get_recent_flash_texts(limit: int = 200) -> list[str]:
    """从 PostgreSQL 读取最近快讯标题+内容，用于本地 N-gram 去重"""
    conn = get_pool().getconn()
    try:
        from psycopg2.extras import RealDictCursor
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT title, content FROM flash_news ORDER BY published_at DESC LIMIT %s",
                (limit,)
            )
            return [f"{r['title']} {r.get('content', '')}" for r in cur.fetchall()]
    except Exception as e:
        log.warning(f"Failed to fetch recent flash texts: {e}")
        return []
    finally:
        get_pool().putconn(conn)


def _categorize(text: str) -> int:
    text_lower = text.lower()
    for kw in CATEGORIES["crypto"]["keywords"]:
        if kw.lower() in text_lower:
            return CATEGORIES["crypto"]["id"]
    for kw in CATEGORIES["us-stock"]["keywords"]:
        if kw.lower() in text_lower:
            return CATEGORIES["us-stock"]["id"]
    for kw in CATEGORIES["hk-stock"]["keywords"]:
        if kw.lower() in text_lower:
            return CATEGORIES["hk-stock"]["id"]
    for kw in CATEGORIES["derivatives"]["keywords"]:
        if kw.lower() in text_lower:
            return CATEGORIES["derivatives"]["id"]
    return CATEGORIES["crypto"]["id"]


def _detect_subcategory(text: str, category_id: int) -> str:
    """对衍生品分类的快讯自动检测子分类。"""
    if category_id != CATEGORIES["derivatives"]["id"]:
        return ""
    subcats = CATEGORIES["derivatives"].get("subcategories", {})
    text_lower = text.lower()
    for sub_slug, sub_cfg in subcats.items():
        if any(kw.lower() in text_lower for kw in sub_cfg["keywords"]):
            return sub_slug
    return "commodity"


def _is_chinese(text: str) -> bool:
    if not text:
        return False
    cn_count = sum(1 for ch in text if '\u4e00' <= ch <= '\u9fff')
    return cn_count / max(len(text), 1) > 0.15


import re

_RELEVANCE_KEYWORDS = re.compile(
    r"(?i)\b("
    r"bitcoin|btc|ethereum|eth|crypto|defi|nft|blockchain|token|solana|xrp|"
    r"stock|shares|nasdaq|s&p|dow|nyse|ipo|earnings|dividend|"
    r"gold|oil|commodity|crude|futures|options|derivatives|copper|wheat|"
    r"fed|interest rate|inflation|gdp|cpi|treasury|bond|forex|"
    r"usd|eur|cny|jpy|swap|hedge|"
    r"sec|regulation|etf|halving|staking|"
    r"bull|bear|rally|crash|surge|plunge|soar|dump|"
    r"美股|纳斯达克|标普|道琼斯|港股|恒生|恒指|港交所|"
    r"比特币|以太坊|加密|区块链|"
    r"黄金|原油|期货|期权|衍生品|大宗商品|外汇|债券|"
    r"降息|加息|通胀|央行|美联储"
    r")\b"
)


def _is_relevant(item: dict) -> bool:
    """前置过滤：只保留与金融市场相关的新闻，跳过体育/娱乐等噪音。"""
    text = item.get("raw_text", "") or f"{item.get('title', '')} {item.get('content', '')}"
    if not text:
        return False
    if item.get("channel") in ("coingecko", "llm_fallback"):
        return True
    return bool(_RELEVANCE_KEYWORDS.search(text))


# ══════════════════════════════════════════════
# 通道 1: Finnhub
# ══════════════════════════════════════════════

def _fetch_finnhub() -> list[dict]:
    ch = FLASH_CHANNELS["finnhub"]
    if not ch["enabled"] or not ch["api_key"]:
        return []

    items = []
    for category in ch["categories"]:
        try:
            resp = requests.get(
                f"{ch['api_url']}/news",
                params={"category": category, "token": ch["api_key"]},
                timeout=ch["timeout"],
            )
            resp.raise_for_status()
            for n in resp.json()[: ch["max_items"] // len(ch["categories"])]:
                title = n.get("headline", "").strip()
                summary = n.get("summary", "").strip()[:300]
                if not title:
                    continue
                items.append({
                    "title": title,
                    "content": summary or title,
                    "raw_text": f"{title} {summary}",
                    "source": f"Finnhub/{n.get('source', '')}",
                    "source_url": n.get("url", ""),
                    "lang": "en",
                    "channel": "finnhub",
                })
        except Exception as e:
            log.warning(f"Finnhub [{category}]: {e}")

    return items


# ══════════════════════════════════════════════
# 通道 2: Marketaux
# ══════════════════════════════════════════════

def _fetch_marketaux() -> list[dict]:
    ch = FLASH_CHANNELS["marketaux"]
    if not ch["enabled"] or not ch["api_key"]:
        return []

    items = []
    for search in ch["searches"]:
        try:
            resp = requests.get(
                f"{ch['api_url']}/news/all",
                params={
                    "api_token": ch["api_key"],
                    "search": search,
                    "language": "en",
                    "limit": ch["per_search"],
                },
                timeout=ch["timeout"],
            )
            resp.raise_for_status()
            for n in resp.json().get("data", []):
                title = n.get("title", "").strip()
                desc = n.get("description", "").strip()[:300]
                if not title:
                    continue
                items.append({
                    "title": title,
                    "content": desc or title,
                    "raw_text": f"{title} {desc} {search}",
                    "source": f"Marketaux/{n.get('source', '')}",
                    "source_url": n.get("url", ""),
                    "lang": "en",
                    "channel": "marketaux",
                })
        except Exception as e:
            log.warning(f"Marketaux [{search[:20]}]: {e}")

    return items


# ══════════════════════════════════════════════
# 通道 3: CryptoCompare
# ══════════════════════════════════════════════

def _fetch_cryptocompare() -> list[dict]:
    ch = FLASH_CHANNELS["cryptocompare"]
    if not ch["enabled"]:
        return []

    try:
        params = {"lang": "EN", "sortOrder": "latest"}
        if ch["api_key"]:
            params["api_key"] = ch["api_key"]
        resp = requests.get(
            f"{ch['api_url']}/v2/news/",
            params=params,
            timeout=ch["timeout"],
        )
        resp.raise_for_status()
        data = resp.json().get("Data", [])
        if not isinstance(data, list):
            return []

        items = []
        for n in data[: ch["max_items"]]:
            title = n.get("title", "").strip()
            body = n.get("body", "").strip()[:300]
            if not title:
                continue
            items.append({
                "title": title,
                "content": body or title,
                "raw_text": f"{title} {body}",
                "source": f"CryptoCompare/{n.get('source', '')}",
                "source_url": n.get("url", ""),
                "lang": "en",
                "channel": "cryptocompare",
            })
        return items
    except Exception as e:
        log.warning(f"CryptoCompare: {e}")
        return []


# ══════════════════════════════════════════════
# 通道 4: CoinGecko（行情异动）
# ══════════════════════════════════════════════

def _fetch_coingecko() -> list[dict]:
    ch = FLASH_CHANNELS["coingecko"]
    if not ch["enabled"]:
        return []

    try:
        resp = requests.get(
            f"{ch['api_url']}/coins/markets",
            params={
                "vs_currency": "usd",
                "order": "market_cap_desc",
                "per_page": ch["max_items"],
                "page": 1,
                "sparkline": "false",
            },
            timeout=ch["timeout"],
        )
        resp.raise_for_status()
        threshold = ch.get("move_threshold", 2.0)
        items = []
        for coin in resp.json():
            name = coin.get("name", "")
            sym = coin.get("symbol", "").upper()
            price = coin.get("current_price", 0)
            chg = coin.get("price_change_percentage_24h", 0) or 0
            mcap = coin.get("market_cap", 0)

            if abs(chg) < threshold:
                continue

            d = "zhang" if chg > 0 else "die"
            arrow = "+" if chg > 0 else "-"
            imp = "urgent" if abs(chg) > 10 else "high" if abs(chg) > 5 else "normal"
            d_zh = "涨" if chg > 0 else "跌"

            items.append({
                "title": f"{name}({sym}) 24H{d_zh}{abs(chg):.1f}%, ${price:,.2f}",
                "content": f"{name}当前报价${price:,.2f}, 24小时{d_zh}幅{abs(chg):.1f}%({arrow}). 市值约${mcap/1e9:.1f}B.",
                "raw_text": f"{name} {sym} crypto",
                "source": "CoinGecko",
                "lang": "zh",
                "channel": "coingecko",
            })
        return items
    except Exception as e:
        log.warning(f"CoinGecko: {e}")
        return []


# ══════════════════════════════════════════════
# 通道 5a: 新浪财经滚动（中文）
# ══════════════════════════════════════════════

def _fetch_cn_sina() -> list[dict]:
    ch = FLASH_CHANNELS.get("cn_sina", {})
    if not ch.get("enabled"):
        return []
    items = []
    try:
        resp = requests.get(
            ch["api_url"],
            params={
                "pageid": ch.get("pageid", 153),
                "lid": ch.get("lid", 2516),
                "num": min(ch.get("max_items", 25), 30),
                "page": 1,
                "encode": "utf-8",
            },
            timeout=ch.get("timeout", 15),
        )
        resp.raise_for_status()
        body = resp.json()
        rows = (body.get("result") or {}).get("data") or []
        if not isinstance(rows, list):
            return []
        for row in rows[: ch["max_items"]]:
            if not isinstance(row, dict):
                continue
            title = (row.get("title") or "").strip()
            if not title:
                continue
            intro = (row.get("intro") or "").strip()[:300]
            link = row.get("url") or ""
            items.append({
                "title": title,
                "content": intro or title[:200],
                "raw_text": f"{title} {intro}",
                "source": f"新浪/{row.get('media_name', '财经')}",
                "source_url": link,
                "lang": "zh",
                "channel": "cn_sina",
            })
    except Exception as e:
        log.warning(f"cn_sina: {e}")
    return items


# ══════════════════════════════════════════════
# 通道 5b: 中文财经 RSS
# ══════════════════════════════════════════════

def _fetch_cn_rss() -> list[dict]:
    ch = FLASH_CHANNELS.get("cn_rss", {})
    if not ch.get("enabled"):
        return []
    feeds = CN_FLASH_RSS_FEEDS or []
    per = max(1, ch["max_items"] // max(len(feeds), 1))
    items = []
    for feed_cfg in feeds:
        try:
            d = feedparser.parse(feed_cfg["url"])
            cat_slug = feed_cfg.get("category", "us-stock")
            entries = getattr(d, "entries", None) or []
            for entry in entries[:per]:
                title = (entry.get("title") or "").strip()
                summary = (entry.get("summary") or "").strip()[:250]
                if not title:
                    continue
                items.append({
                    "title": title,
                    "content": summary or title[:200],
                    "raw_text": f"{title} {summary} {cat_slug}",
                    "source": "中文RSS",
                    "source_url": entry.get("link", ""),
                    "lang": "zh",
                    "channel": "cn_rss",
                })
        except Exception as e:
            log.warning(f"cn_rss ({str(feed_cfg.get('url', ''))[:48]}): {e}")
    return items


# ══════════════════════════════════════════════
# 通道 5: RSS
# ══════════════════════════════════════════════

def _fetch_rss() -> list[dict]:
    ch = FLASH_CHANNELS["rss"]
    if not ch["enabled"]:
        return []

    per_feed = max(1, ch["max_items"] // max(len(RSS_FEEDS), 1))
    items = []
    for feed_cfg in RSS_FEEDS:
        try:
            d = feedparser.parse(feed_cfg["url"])
            cat_slug = feed_cfg.get("category", "crypto")
            lang = feed_cfg.get("lang", "zh")

            for entry in d.entries[:per_feed]:
                title = entry.get("title", "").strip()
                summary = entry.get("summary", "").strip()[:200]
                if not title:
                    continue
                items.append({
                    "title": title,
                    "content": summary or title,
                    "raw_text": f"{title} {summary} {cat_slug}",
                    "source": "RSS",
                    "source_url": entry.get("link", ""),
                    "lang": lang,
                    "channel": "rss",
                })
        except Exception as e:
            log.warning(f"RSS ({feed_cfg['url'][:40]}): {e}")

    return items


# ══════════════════════════════════════════════
# 通道 6: LLM 兜底
# ══════════════════════════════════════════════

def _generate_fallback(need: int) -> list[dict]:
    if need <= 0:
        return []
    ch = FLASH_CHANNELS.get("llm_fallback", {})
    if not ch.get("enabled", True):
        return []

    try:
        prompt = (
            f"生成 {need} 条最新金融市场快讯（模拟今日数据）。\n"
            "覆盖 美股、港股、加密货币、衍生品（期货/期权/外汇/大宗商品）。\n"
            '输出 JSON 数组：[{{"title":"30字内","content":"50-100字","category":"crypto|us-stock|hk-stock|derivatives"}}]'
        )
        result = chat("你是金融快讯编辑。只输出JSON。", prompt, temperature=0.8, max_tokens=2000)
        start, end = result.find("["), result.rfind("]") + 1
        if start >= 0 and end > start:
            raw = json.loads(result[start:end])
            return [{
                "title": i.get("title", ""),
                "content": i.get("content", ""),
                "raw_text": i.get("title", ""),
                "source": "AI",
                "lang": "zh",
                "channel": "llm_fallback",
                "category_override": i.get("category"),
            } for i in raw]
    except Exception as e:
        log.error(f"LLM fallback: {e}")
    return []


# ══════════════════════════════════════════════
# 通道注册表
# ══════════════════════════════════════════════

CHANNEL_REGISTRY = {
    "finnhub": _fetch_finnhub,
    "marketaux": _fetch_marketaux,
    "cryptocompare": _fetch_cryptocompare,
    "coingecko": _fetch_coingecko,
    "rss": _fetch_rss,
    "cn_sina": _fetch_cn_sina,
    "cn_rss": _fetch_cn_rss,
}


# ══════════════════════════════════════════════
# 主入口
# ══════════════════════════════════════════════

def collect_flash(count: int = 10) -> list[dict]:
    """多通道并发采集快讯，批量翻译，按权重入库。"""
    step_print("快讯多通道引擎", f"目标: {count} 条 | 并发: {FLASH_CONCURRENCY} | 批量翻译: {FLASH_TRANSLATE_BATCH}条/次")

    existing_texts = _get_recent_flash_texts(200)
    stats: dict[str, dict] = {}

    active_channels = [
        (name, fn)
        for name, fn in CHANNEL_REGISTRY.items()
        if FLASH_CHANNELS.get(name, {}).get("enabled") and not _is_degraded(name)
    ]

    if not active_channels:
        log.warning("所有通道均已降级或禁用")
        active_channels = [(n, f) for n, f in CHANNEL_REGISTRY.items()]

    print(f"  活跃通道: {[n for n, _ in active_channels]}")

    # ── WebSocket 缓冲（Finnhub WS 守护进程写入）──
    ws_buffered = drain_ws_buffer(FLASH_WS_DRAIN_MAX)
    if ws_buffered:
        print(f"  WS 缓冲: {len(ws_buffered)} 条待翻译入库")

    # ── 并发采集 ──
    all_items = []
    t0 = time.time()
    channel_timings: dict[str, float] = {}

    with ThreadPoolExecutor(max_workers=FLASH_CONCURRENCY) as pool:
        futures = {}
        ch_start: dict[str, float] = {}
        for name, fn in active_channels:
            ch_start[name] = time.time()
            futures[pool.submit(fn)] = name

        for future in as_completed(futures):
            name = futures[future]
            ch_elapsed = time.time() - ch_start[name]
            try:
                items = future.result()
                stats[name] = {"fetched": len(items), "status": "ok"}
                channel_timings[name] = round(ch_elapsed, 2)
                _mark_ok(name, len(items))
                all_items.extend(items)
                print(f"    [OK] {name}: {len(items)} items ({ch_elapsed:.1f}s)")
            except Exception as e:
                stats[name] = {"fetched": 0, "status": f"error: {e}"}
                channel_timings[name] = round(ch_elapsed, 2)
                _mark_fail(name, str(e))
                print(f"    [FAIL] {name}: {e}")

    fetch_time = time.time() - t0
    all_items = ws_buffered + all_items
    print(f"\n  采集完成: {len(all_items)} 条（含 WS {len(ws_buffered)}），耗时 {fetch_time:.1f}s")

    # ── 前置过滤：丢弃与金融无关的噪音新闻，节省翻译费用 ──
    before_filter = len(all_items)
    all_items = [it for it in all_items if _is_relevant(it)]
    filtered_out = before_filter - len(all_items)
    if filtered_out:
        print(f"  前置过滤: 丢弃 {filtered_out} 条无关新闻，保留 {len(all_items)} 条")

    # ── 批量翻译英文内容 ──
    t1 = time.time()
    translate_time = 0.0
    en_items = [it for it in all_items if it.get("lang") == "en"]
    zh_items = [it for it in all_items if it.get("lang") != "en"]

    if en_items:
        print(f"\n  批量翻译 {len(en_items)} 条英文快讯...")
        en_items = batch_translate(en_items, batch_size=FLASH_TRANSLATE_BATCH)
        translate_time = time.time() - t1
        print(f"  翻译完成，耗时 {translate_time:.1f}s")

    all_items = en_items + zh_items
    collected_ts = now_cn()
    for item in all_items:
        if "collected_at" not in item:
            item["collected_at"] = collected_ts

    # ── 分类 ──
    for item in all_items:
        cat_override = item.pop("category_override", None)
        if cat_override and cat_override in CATEGORIES:
            item["category_id"] = CATEGORIES[cat_override]["id"]
        else:
            item["category_id"] = _categorize(item.get("raw_text", item.get("title", "")))

    # ── 按权重排序 ──
    def _sort_key(item):
        ch_name = item.get("channel", "")
        w = FLASH_CHANNELS.get(ch_name, {}).get("weight", 0)
        return -w

    all_items.sort(key=_sort_key)

    inserted = 0
    for item in all_items:
        title = item.get("title", "").strip()
        raw_text = item.get("raw_text", item.get("title", ""))
        
        if not title:
            continue
            
        # Semantic Deduplication: Two-Tier Defense
        is_duplicate = False
        item_full_text = f"{title} {item.get('content', '')}"
        
        # 1. 第一条防线：本地字面 N-gram 近似匹配（过滤 0.45 以上高度相似，速度极快）
        for ex_text in existing_texts:
            if compute_similarity(item_full_text, ex_text) > 0.45:
                is_duplicate = True
                break
                
        # 2. 第二条防线：pgvector 语义查重（过滤 0.85 以上深度洗稿内容）
        embedding = None
        if not is_duplicate:
            embedding = get_embedding(item_full_text)
            if embedding:
                dup_record = check_semantic_duplicate(embedding, threshold=0.85)
                if dup_record:
                    log.info(f"pgvector 拦截洗稿快讯: {title[:20]} <=> {dup_record['title'][:20]}")
                    is_duplicate = True
        
        if is_duplicate:
            continue

        cat_id = item.get("category_id", 2)
        subcategory = _detect_subcategory(raw_text, cat_id)

        fid = insert_flash(
            title=title,
            content=item.get("content", ""),
            category_id=cat_id,
            importance=item.get("importance", "normal"),
            source=item.get("source"),
            source_url=item.get("source_url"),
            subcategory=subcategory,
            collected_at=item.get("collected_at"),
            embedding=embedding,
        )
        if fid > 0:
            inserted += 1
            existing_texts.append(item_full_text)
            ch = item.get("channel", "?")
            stats.setdefault(ch, {})["inserted"] = stats.get(ch, {}).get("inserted", 0) + 1
            print(f"    + [{ch}] {title[:60]}")
        if inserted >= count:
            break

    # ── LLM 兜底 ──
    if inserted < count:
        need = count - inserted
        print(f"\n  LLM 兜底: 需补 {need} 条...")
        fallback = _generate_fallback(need)
        stats["llm_fallback"] = {"fetched": len(fallback), "status": "ok"}
        for item in fallback:
            title = item.get("title", "").strip()
            item_full_text = f"{title} {item.get('content', '')}"
            if not title:
                continue
                
            is_dup = any(compute_similarity(item_full_text, ex) > 0.45 for ex in existing_texts)
            if is_dup:
                continue
                
            cat_override = item.pop("category_override", None)
            cat_id = CATEGORIES.get(cat_override, CATEGORIES["crypto"])["id"] if cat_override else 2

            subcat = _detect_subcategory(title, cat_id)
            fallback_embed = get_embedding(item_full_text)
            fid = insert_flash(
                title=title,
                content=item.get("content", ""),
                category_id=cat_id,
                importance="normal",
                source="AI",
                subcategory=subcat,
                collected_at=now_cn(),
                embedding=fallback_embed,
            )
            if fid > 0:
                inserted += 1
                existing_texts.append(item_full_text)
                print(f"    + [AI] {title[:60]}")
            if inserted >= count:
                break

    # ── 汇总 ──
    total_time = time.time() - t0
    stage_timings = {
        "fetch": round(fetch_time, 2),
        "translate": round(translate_time, 2),
        "total": round(total_time, 2),
    }

    print(f"\n{'─'*50}")
    print(f"  快讯通道汇总:")
    for name, s in stats.items():
        status = s.get("status", "?")
        fetched = s.get("fetched", 0)
        ins = s.get("inserted", 0)
        degraded = " [降级]" if _is_degraded(name) else ""
        ch_t = channel_timings.get(name, 0)
        print(f"    {name:15s} 拉取={fetched:3d}  入库={ins:2d}  耗时={ch_t:.1f}s  {status}{degraded}")
    print(f"  总计入库: {inserted} 条 | 总耗时: {total_time:.1f}s")
    print(f"{'─'*50}")

    return {
        "items": all_items[:inserted],
        "count": inserted,
        "stage_timings": stage_timings,
        "channel_timings": channel_timings,
        "error_count": sum(1 for s in stats.values() if "error" in s.get("status", "")),
    }


def get_channel_status() -> dict:
    """获取所有通道健康状态，供外部监控使用。"""
    status = {}
    for name in CHANNEL_REGISTRY:
        ch_cfg = FLASH_CHANNELS.get(name, {})
        h = _health(name)
        status[name] = {
            "enabled": ch_cfg.get("enabled", False),
            "degraded": h.get("degraded", False),
            "consecutive_fails": h.get("fails", 0),
            "last_ok": h.get("last_ok"),
            "weight": ch_cfg.get("weight", 0),
        }
    return status
