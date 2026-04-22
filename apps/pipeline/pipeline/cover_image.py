"""
文章封面配图策略与工具（供入库 pipeline 调用）

策略（业务约定）：
1. **信源转载**：若原文页面有图（og:image / twitter:image 等），应提取为 `articles.cover_image`。
2. **原创/自写**：也应配图；若无现成图，可：
   - 用标题/摘要生成关键词，经 **Pexels / Unsplash** 等图库 API 检索相关免费图（注意各站许可与署名要求）；
   - 或使用 **自研/第三方文生图**（在业务代码中对接，本模块仅预留扩展点）。

与前端：`src/lib/remote-image.ts` 与 `next.config` 的 `images.remotePatterns` 尽量覆盖常用图床；
未覆盖的 URL 仍可通过 `next/image` 的 `unoptimized` 正常显示。

依赖：标准库 + `requests`（与 run_psi 一致）。图库 API 需自行申请 Key，未配置则对应函数返回 None。

**文生图（可选）**：配置 `OPENAI_API_KEY` 后，`resolve_cover_for_article` 在图库均失败时会调用 OpenAI Images，将图片保存到 `public/covers/generated/`。

**低价/免费替代（推荐优先用图库，成本≈0）**：
- 已接入：**Pexels、Unsplash、Pixabay**（均可申请免费 API Key，Pixabay 额度较宽松）。
- 可自接：**Wikimedia Commons API**（免费，需注意署名）、**Replicate / fal.ai** 上低价文生图模型（按次几分钱）。
- 国内常见：**通义万相、豆包、混元** 等一般有免费试用额度，可按官方 HTTP API 自行接 `hook_generated_cover_url` 或新增 provider。
- **不配任何 Key**：仅用信源 og:image + 前端占位图（`article-placeholder.svg`），成本为零。

用法示例：
    from pipeline.cover_image import resolve_cover_for_article

    r = resolve_cover_for_article(
        title="...",
        summary="...",
        source_url="https://example.com/article",  # 有则尝试抓 og:image
        existing_cover=None,
        is_original=False,
    )
    if r.url:
        # 写入 DB: cover_image = r.url
        ...
"""
from __future__ import annotations

import html as html_lib
import re
import os
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Literal
from urllib.parse import urljoin

import requests

PROJECT_ROOT = Path(__file__).resolve().parent.parent
GENERATED_COVERS_DIR = PROJECT_ROOT / "public" / "covers" / "generated"

CoverSource = Literal[
    "existing",
    "source_page",
    "pexels",
    "unsplash",
    "pixabay",
    "generated",
    "none",
]


@dataclass
class CoverResult:
    url: str | None
    source: CoverSource
    detail: str = ""


# --- 从 HTML 提取常见封面 meta ---

_OG_IMAGE = re.compile(
    r'<meta[^>]+property\s*=\s*["\']og:image["\'][^>]*>',
    re.IGNORECASE,
)
_OG_CONTENT = re.compile(r'content\s*=\s*["\']([^"\']+)["\']', re.IGNORECASE)
_TWITTER_IMAGE = re.compile(
    r'<meta[^>]+name\s*=\s*["\']twitter:image["\'][^>]*content\s*=\s*["\']([^"\']+)["\']',
    re.IGNORECASE,
)
# content 在前、property 在后的 og:image
_OG_IMAGE_ALT = re.compile(
    r'<meta[^>]+content\s*=\s*["\']([^"\']+)["\'][^>]+property\s*=\s*["\']og:image["\']',
    re.IGNORECASE,
)


def _first_meta_content(tag_html: str) -> str | None:
    m = _OG_CONTENT.search(tag_html)
    if not m:
        return None
    raw = html_lib.unescape(m.group(1).strip())
    return raw or None


def extract_cover_from_html(html: str, base_url: str | None = None) -> str | None:
    """从页面 HTML 提取 og:image / twitter:image，返回绝对 URL。"""
    if not html:
        return None

    for pattern in (_OG_IMAGE_ALT,):
        m = pattern.search(html)
        if m:
            u = html_lib.unescape(m.group(1).strip())
            if u:
                return _abs_url(u, base_url)

    for m in _OG_IMAGE.finditer(html):
        u = _first_meta_content(m.group(0))
        if u:
            return _abs_url(u, base_url)

    m = _TWITTER_IMAGE.search(html)
    if m:
        u = html_lib.unescape(m.group(1).strip())
        if u:
            return _abs_url(u, base_url)

    return None


def _abs_url(url: str, base: str | None) -> str:
    url = url.strip()
    if url.startswith("//"):
        return "https:" + url
    if url.startswith("http://") or url.startswith("https://"):
        return url
    if base:
        return urljoin(base, url)
    return url


def fetch_cover_from_source_url(url: str, timeout: float = 15.0) -> CoverResult:
    """GET 信源页面并尝试解析封面图。"""
    try:
        r = requests.get(
            url,
            timeout=timeout,
            headers={
                "User-Agent": "YayaNewsCoverBot/1.0 (+pipeline; og:image)",
                "Accept": "text/html,application/xhtml+xml",
            },
        )
        r.raise_for_status()
        ct = (r.headers.get("Content-Type") or "").lower()
        if "html" not in ct and "xml" not in ct:
            return CoverResult(None, "none", f"非 HTML: {ct[:40]}")
        found = extract_cover_from_html(r.text, base_url=url)
        if found:
            return CoverResult(found, "source_page", "og:image/twitter:image")
        return CoverResult(None, "none", "页面未找到 og:image/twitter:image")
    except requests.RequestException as e:
        return CoverResult(None, "none", str(e))


def keyword_query_from_text(title: str, summary: str | None, max_len: int = 80) -> str:
    """用标题 + 摘要拼搜索关键词（英文图库 API 多为英文，可后续接翻译）。"""
    parts = [title.strip()]
    if summary and summary.strip():
        parts.append(summary.strip()[:200])
    q = " ".join(parts)
    q = re.sub(r"\s+", " ", q).strip()
    if len(q) > max_len:
        q = q[: max_len - 1] + "…"
    return q


def search_pexels_photo_url(query: str, timeout: float = 15.0) -> str | None:
    """
    Pexels API：https://www.pexels.com/api/documentation/#photos-search
    环境变量：PEXELS_API_KEY
    """
    key = os.environ.get("PEXELS_API_KEY", "").strip()
    if not key or not query.strip():
        return None
    r = requests.get(
        "https://api.pexels.com/v1/search",
        params={"query": query.strip(), "per_page": 1, "orientation": "landscape"},
        headers={"Authorization": key},
        timeout=timeout,
    )
    r.raise_for_status()
    data = r.json()
    photos = data.get("photos") or []
    if not photos:
        return None
    src = photos[0].get("src") or {}
    return src.get("large") or src.get("original")


def search_unsplash_photo_url(query: str, timeout: float = 15.0) -> str | None:
    """
    Unsplash API：https://unsplash.com/documentation#search-photos
    环境变量：UNSPLASH_ACCESS_KEY
    """
    key = os.environ.get("UNSPLASH_ACCESS_KEY", "").strip()
    if not key or not query.strip():
        return None
    r = requests.get(
        "https://api.unsplash.com/search/photos",
        params={"query": query.strip(), "per_page": 1, "orientation": "landscape"},
        headers={"Authorization": f"Client-ID {key}"},
        timeout=timeout,
    )
    r.raise_for_status()
    data = r.json()
    results = data.get("results") or []
    if not results:
        return None
    return results[0].get("urls", {}).get("regular") or results[0].get("urls", {}).get("full")


def search_pixabay_photo_url(query: str, timeout: float = 15.0) -> str | None:
    """
    Pixabay API（免费 Key，额度较宽松）：https://pixabay.com/api/docs/
    环境变量：PIXABAY_API_KEY
    """
    key = os.environ.get("PIXABAY_API_KEY", "").strip()
    if not key or not query.strip():
        return None
    r = requests.get(
        "https://pixabay.com/api/",
        params={
            "key": key,
            "q": query.strip()[:100],
            "image_type": "photo",
            "orientation": "horizontal",
            "safesearch": "true",
            "per_page": 3,
        },
        timeout=timeout,
    )
    r.raise_for_status()
    hits = r.json().get("hits") or []
    if not hits:
        return None
    h = hits[0]
    return h.get("largeImageURL") or h.get("webformatURL")


def fetch_pollinations_ai_url(query: str) -> str:
    """零配置免费免鉴权兜底方案 (改用 LoremFlickr 随机金融/加密高质量配图，替换原来的 pollintions AI 生图)"""
    import random
    seed = random.randint(1, 100000)
    # LoremFlickr 会根据关键字和 lock 参数返回稳定不变的真实配图，避免 AI 拼写错误和怪异画面
    return f"https://loremflickr.com/1200/630/finance,crypto,business/all?lock={seed}"


def resolve_cover_for_article(
    *,
    title: str,
    summary: str | None = None,
    source_url: str | None = None,
    existing_cover: str | None = None,
    is_original: bool = False,
    try_source_page_for_original: bool = False,
) -> CoverResult:
    """
    统一决策封面 URL（pipeline 入库前调用）。

    1. 已有 `existing_cover` → 沿用。
    2. **转载/信源**：有 `source_url` 时先 GET 页面取 og:image / twitter:image。
    3. **仍无图**：用标题+摘要关键词依次试 Pexels、Unsplash、**Pixabay**（均免费 Key）。
    4. 可选：`try_source_page_for_original=True` 时，原创文章也尝试从 `source_url` 取图（如参考链接）。
    5. 文生图：实现 `hook_generated_cover_url` 或在业务中先得到 URL 再传入 `existing_cover`。
    """
    if existing_cover and existing_cover.strip():
        return CoverResult(existing_cover.strip(), "existing", "已有封面")

    if source_url and source_url.strip():
        # 如果是方程式新闻 (BWEnews)，其 source_url 是 t.me 链接或 bwe-ws，抓到的均是无意义的频道 Logo
        # 根据用户要求，拦截此类自带图片，强制走下方的高质量图库搜索/兜底
        if "t.me/BWEnews" not in source_url and "bwe-ws.com" not in source_url:
            if not is_original or try_source_page_for_original:
                res = fetch_cover_from_source_url(source_url.strip())
                if res.url:
                    return res

    q = keyword_query_from_text(title, summary)
    for finder, src in (
        (search_pexels_photo_url, "pexels"),
        (search_unsplash_photo_url, "unsplash"),
        (search_pixabay_photo_url, "pixabay"),
    ):
        try:
            u = finder(q)
            if u:
                return CoverResult(u, src, f"关键词: {q[:60]}")
        except requests.RequestException:
            continue

    gen = hook_generated_cover_url(q)
    if gen:
        return CoverResult(gen, "generated", "文生图")

    fallback = fetch_pollinations_ai_url(q)
    return CoverResult(
        fallback,
        "generated",
        "零配置免费兜底API"
    )


def _openai_image_create_url(prompt: str, api_key: str, timeout: float = 120.0) -> str | None:
    """调用 OpenAI Images API，返回临时下载 URL（会过期，需再落盘）。"""
    model = os.environ.get("OPENAI_IMAGE_MODEL", "dall-e-3").strip() or "dall-e-3"
    size = os.environ.get("OPENAI_IMAGE_SIZE", "1792x1024").strip() or "1792x1024"
    base = os.environ.get("OPENAI_API_BASE", "https://api.openai.com/v1").rstrip("/")
    r = requests.post(
        f"{base}/images/generations",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "prompt": (prompt or "financial news abstract illustration")[:4000],
            "n": 1,
            "size": size if model.startswith("dall-e-3") else "1024x1024",
            "response_format": "url",
        },
        timeout=timeout,
    )
    r.raise_for_status()
    data = r.json()
    arr = data.get("data") or []
    if not arr:
        return None
    return arr[0].get("url")


def _download_to_public_covers(image_url: str) -> str | None:
    """下载图片到 public/covers/generated/，返回站内路径 /covers/generated/xxx.png"""
    GENERATED_COVERS_DIR.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}.png"
    dest = GENERATED_COVERS_DIR / name
    r = requests.get(
        image_url,
        timeout=60,
        headers={"User-Agent": "YayaNewsCoverGen/1.0"},
    )
    r.raise_for_status()
    dest.write_bytes(r.content)
    return f"/covers/generated/{name}"


def hook_generated_cover_url(prompt: str) -> str | None:
    """
    文生图：需 `OPENAI_API_KEY`。流程：OpenAI Images → 下载到 `public/covers/generated/` → 返回 `/covers/generated/...`。

    可选环境变量：
      OPENAI_API_BASE      默认 https://api.openai.com/v1（兼容代理/Azure 需改 endpoint）
      OPENAI_IMAGE_MODEL   默认 dall-e-3
      OPENAI_IMAGE_SIZE    默认 1792x1024（dall-e-3 支持 1024x1024 / 1792x1024 / 1024x1792）
      COVER_IMAGE_GEN      设为 0 可关闭文生图（即使配置了 Key）
    """
    if os.environ.get("COVER_IMAGE_GEN", "1").strip() == "0":
        return None
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key or not (prompt or "").strip():
        return None
    provider = os.environ.get("COVER_IMAGE_GEN_PROVIDER", "openai").strip().lower()
    if provider != "openai":
        return None
    try:
        temp_url = _openai_image_create_url(prompt, api_key)
        if not temp_url:
            return None
        return _download_to_public_covers(temp_url)
    except requests.RequestException:
        return None
