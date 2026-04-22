"""
优先从「可公开访问的原文」拉取英文长文素材：信源 URL、NewsAPI everything（配合 tickers）。
用于 Agent 6：能拿到可靠英文正文时减少对全文 LLM 翻译的依赖。
"""
from __future__ import annotations

import re
from html.parser import HTMLParser
from typing import Any
from urllib.parse import urlparse

import requests

from pipeline.utils.logger import get_logger

log = get_logger("fetch_en")

_UA = (
    "Mozilla/5.0 (compatible; YayaNewsAgent6/1.0; +https://yayanews.io; "
    "en-fetch; requests)"
)
_SKIP_TAGS = frozenset({"script", "style", "nav", "footer", "header", "aside", "noscript", "iframe", "form"})


def _latin_letters(s: str) -> int:
    return len(re.findall(r"[a-zA-Z]", s or ""))


def _cjk_chars(s: str) -> int:
    return len(re.findall(r"[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]", s or ""))


def is_probably_english(text: str, min_latin: int = 120) -> bool:
    """粗判：拉丁字母足够多且不成比例地被中日韩淹没。"""
    if not text or not text.strip():
        return False
    latin = _latin_letters(text)
    cjk = _cjk_chars(text)
    if latin < min_latin:
        return False
    if cjk > max(30, latin * 0.35):
        return False
    return True


def _meta_content(html: str, prop: str) -> str | None:
    pat = re.compile(
        rf'<meta[^>]+(?:property|name)\s*=\s*["\']{re.escape(prop)}["\'][^>]+content\s*=\s*["\']([^"\']+)["\']',
        re.I,
    )
    m = pat.search(html)
    if m:
        return m.group(1).strip() or None
    pat2 = re.compile(
        rf'<meta[^>]+content\s*=\s*["\']([^"\']+)["\'][^>]+(?:property|name)\s*=\s*["\']{re.escape(prop)}["\']',
        re.I,
    )
    m2 = pat2.search(html)
    return (m2.group(1).strip() or None) if m2 else None


class _VisibleTextCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._depth_skip = 0
        self._chunks: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in _SKIP_TAGS:
            self._depth_skip += 1

    def handle_endtag(self, tag: str) -> None:
        if tag in _SKIP_TAGS and self._depth_skip > 0:
            self._depth_skip -= 1

    def handle_data(self, data: str) -> None:
        if self._depth_skip > 0:
            return
        t = data.strip()
        if t:
            self._chunks.append(t)

    def text(self) -> str:
        return "\n\n".join(self._chunks)


def _html_to_paragraphs(text: str, max_chars: int = 120_000) -> str:
    raw = text.strip()[:max_chars]
    parts = [p.strip() for p in re.split(r"\n{2,}", raw) if p.strip()]
    if not parts:
        one = " ".join(raw.split())
        if not one:
            return ""
        parts = [one]
    return "".join(f"<p>{_esc_html(p)}</p>" for p in parts)


def _esc_html(s: str) -> str:
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _fetch_html(url: str, timeout: float = 18.0) -> tuple[str | None, str]:
    try:
        r = requests.get(
            url,
            timeout=timeout,
            headers={"User-Agent": _UA, "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8"},
        )
        r.raise_for_status()
        ct = (r.headers.get("Content-Type") or "").lower()
        if "html" not in ct and "xml" not in ct:
            return None, url
        return r.text, str(r.url)
    except requests.RequestException as e:
        log.debug(f"[en-fetch] GET failed {url}: {e}")
        return None, url


def extract_article_from_html(html: str, page_url: str) -> dict[str, Any]:
    """从 HTML 抽 title / summary / 正文纯文本（再转 <p>）。"""
    title = _meta_content(html, "og:title") or _meta_content(html, "twitter:title")
    desc = _meta_content(html, "og:description") or _meta_content(html, "twitter:description")
    if not title:
        m = re.search(r"<title[^>]*>([^<]{1,300})</title>", html, re.I)
        title = m.group(1).strip() if m else ""

    parser = _VisibleTextCollector()
    try:
        parser.feed(html)
        parser.close()
    except Exception:
        body_text = ""
    else:
        body_text = parser.text()

    body_text = re.sub(r"\n{3,}", "\n\n", body_text)
    if desc and desc not in body_text[:500]:
        body_text = f"{desc}\n\n{body_text}"

    content_html = _html_to_paragraphs(body_text)
    return {
        "title": (title or "").strip(),
        "summary": (desc or "")[:500].strip(),
        "content_html": content_html,
        "source_url": page_url,
    }


def fetch_english_from_source_url(url: str | None, min_body_chars: int = 400) -> dict[str, Any] | None:
    """若 source_url 可访问且正文像英文，返回可入库字段。"""
    if not url or not str(url).strip().startswith(("http://", "https://")):
        return None
    try:
        parsed = urlparse(url)
        if parsed.hostname in {"localhost", "127.0.0.1"}:
            return None
    except Exception:
        return None

    html, final_url = _fetch_html(url.strip())
    if not html:
        return None

    blob = extract_article_from_html(html, final_url)
    plain_len = len(re.sub(r"<[^>]+>", "", blob["content_html"]))
    if plain_len < min_body_chars:
        return None
    body_sample = re.sub(r"<[^>]+>", " ", blob["content_html"])[:8000]
    if not is_probably_english(body_sample):
        return None
    if not blob["title"]:
        return None
    if not blob["summary"]:
        blob["summary"] = (body_sample[:240] + "…") if len(body_sample) > 240 else body_sample
    return blob


def _newsapi_query_from_tickers(tickers: str | None) -> str | None:
    if not tickers:
        return None
    parts = [t.strip() for t in re.split(r"[,;\s]+", tickers) if t.strip()]
    # NewsAPI q 长度有限，取前几项 OR 连接
    parts = parts[:6]
    if not parts:
        return None
    return " OR ".join(parts)[:180]


def _ticker_tokens_upper(tickers: str | None) -> list[str]:
    parts = [t.strip().upper() for t in re.split(r"[,;\s]+", tickers or "") if t.strip()]
    return [p for p in parts if len(p) >= 2][:12]


def _blob_from_news_item(
    u: str,
    title: str,
    desc: str,
    api_content: str,
    min_body_chars: int,
) -> dict[str, Any] | None:
    """打开新闻链接抽正文；否则用 API 摘要拼段落。"""
    if not u.startswith("http") or not title:
        return None
    html, final_url = _fetch_html(u)
    if html:
        blob = extract_article_from_html(html, final_url)
        plain_len = len(re.sub(r"<[^>]+>", "", blob["content_html"]))
        if plain_len >= min_body_chars and is_probably_english(blob["content_html"][:6000]):
            blob["title"] = title or blob["title"]
            if desc and not blob.get("summary"):
                blob["summary"] = desc[:500]
            blob["source_url"] = final_url
            return blob
    merged = f"{title}\n{desc}\n{api_content}"
    if len(merged) >= min_body_chars and is_probably_english(merged):
        summary = desc[:500] if desc else merged[:280]
        return {
            "title": title,
            "summary": summary,
            "content_html": _html_to_paragraphs(merged),
            "source_url": u,
        }
    return None


def fetch_english_from_newsapi(tickers: str | None, api_key: str | None, min_body_chars: int = 350) -> dict[str, Any] | None:
    """用 NEWSAPI everything + 打开头条 URL 抽正文；query 由英文 tickers 构成。"""
    q = _newsapi_query_from_tickers(tickers)
    if not q or not (api_key or "").strip():
        return None
    try:
        resp = requests.get(
            "https://newsapi.org/v2/everything",
            params={
                "q": q,
                "language": "en",
                "sortBy": "relevancy",
                "pageSize": 8,
                "apiKey": api_key.strip(),
            },
            timeout=14,
            headers={"User-Agent": _UA},
        )
        resp.raise_for_status()
        data = resp.json()
        articles = data.get("articles") or []
    except Exception as e:
        log.debug(f"[en-fetch] NewsAPI: {e}")
        return None

    for art in articles:
        u = (art.get("url") or "").strip()
        title = (art.get("title") or "").strip()
        desc = (art.get("description") or "").strip()
        api_content = (art.get("content") or "").strip()
        blob = _blob_from_news_item(u, title, desc, api_content, min_body_chars=min_body_chars)
        if blob:
            return blob
    return None


def fetch_english_from_polygon(tickers: str | None, api_key: str | None, min_body_chars: int = 350) -> dict[str, Any] | None:
    """
    Polygon v2/reference/news：在结果里筛出标题/摘要命中 tickers 的条目，再拉原文页。
    需环境变量 POLYGON_KEY（与快讯通道一致）。
    """
    tokens = _ticker_tokens_upper(tickers)
    if not tokens or not (api_key or "").strip():
        return None
    try:
        resp = requests.get(
            "https://api.polygon.io/v2/reference/news",
            params={"apiKey": api_key.strip(), "limit": 40},
            timeout=14,
            headers={"User-Agent": _UA},
        )
        resp.raise_for_status()
        data = resp.json()
        rows = data.get("results") or []
    except Exception as e:
        log.debug(f"[en-fetch] Polygon: {e}")
        return None

    for n in rows:
        title = (n.get("title") or "").strip()
        desc = (n.get("description") or "").strip()
        u = (n.get("article_url") or n.get("amp_url") or "").strip()
        hay = f"{title} {desc}".upper()
        if not any(tok in hay for tok in tokens):
            continue
        blob = _blob_from_news_item(u, title, desc, "", min_body_chars=min_body_chars)
        if blob:
            return blob
    return None
