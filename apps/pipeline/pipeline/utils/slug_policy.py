"""Shared article slug policy for published content.

Chinese articles use pinyin-style ASCII slugs. English articles use English
title text only, so a Chinese title cannot be transliterated into an English
article URL by accident.
"""
import hashlib
import re
from collections.abc import Callable

from slugify import slugify


DEFAULT_MAX_SLUG_LENGTH = 88
_ASCII_CHUNK_RE = re.compile(r"[^a-z0-9]+")
_CJK_RE = re.compile(r"[\u3400-\u9fff\uf900-\ufaff]")
_BRAND_SUFFIX_RE = re.compile(r"\s*(?:[|\-]\s*)?YayaNews\s*$", re.IGNORECASE)


def strip_brand_suffix(title: str) -> str:
    return _BRAND_SUFFIX_RE.sub("", str(title or "")).strip()


def _compact_ascii_slug(value: str, max_length: int) -> str:
    base = slugify(
        value or "",
        lowercase=True,
        allow_unicode=False,
        max_length=max_length,
    )
    base = _ASCII_CHUNK_RE.sub("-", base.lower()).strip("-")
    base = re.sub(r"-{2,}", "-", base)
    return base[:max_length].strip("-")


def _remove_cjk(value: str) -> str:
    return _CJK_RE.sub(" ", value or "")


def _separate_cjk_boundaries(value: str) -> str:
    text = value or ""
    text = re.sub(r"([A-Za-z0-9])(?=[\u3400-\u9fff\uf900-\ufaff])", r"\1 ", text)
    text = re.sub(r"([\u3400-\u9fff\uf900-\ufaff])(?=[A-Za-z0-9])", r"\1 ", text)
    return text


def _has_meaningful_english_slug(slug: str) -> bool:
    tokens = [part for part in slug.split("-") if re.search(r"[a-z]", part)]
    letters = re.sub(r"[^a-z]", "", slug)
    return len(letters) >= 8 and len(tokens) >= 2


def _fallback_slug(value: str, lang: str, max_length: int) -> str:
    prefix = "english-article" if lang == "en" else "zh-article"
    digest = hashlib.sha1((value or prefix).encode("utf-8")).hexdigest()[:10]
    return f"{prefix}-{digest}"[:max_length].strip("-")


def make_article_slug(
    title: str,
    lang: str = "zh",
    max_length: int = DEFAULT_MAX_SLUG_LENGTH,
) -> str:
    """Return a policy-compliant base slug for an article title.

    - zh: transliterate the title to lowercase ASCII, which yields pinyin for
      Chinese characters via python-slugify.
    - en: drop CJK characters before slugifying so English URLs never fall back
      to pinyin generated from Chinese source text.
    """
    locale = "en" if str(lang or "").lower() == "en" else "zh"
    source = strip_brand_suffix(title)
    had_cjk = bool(_CJK_RE.search(source))
    if locale == "en":
        source = _remove_cjk(source)
    else:
        source = _separate_cjk_boundaries(source)

    base = _compact_ascii_slug(source, max_length)
    if locale == "en" and not re.search(r"[a-z]", base):
        base = ""
    if locale == "en" and had_cjk and not _has_meaningful_english_slug(base):
        base = ""

    return base or _fallback_slug(title, locale, max_length)


def normalize_article_slug_for_storage(
    slug: str,
    title: str,
    lang: str = "zh",
    status: str = "published",
    max_length: int = DEFAULT_MAX_SLUG_LENGTH,
) -> str:
    """Normalize a caller-provided slug before inserting/updating articles."""
    current = _compact_ascii_slug(slug or "", max_length)
    if str(status or "").lower() != "published" and current.startswith("draft-"):
        return current
    return make_article_slug(title or slug, lang=lang, max_length=max_length)


def with_unique_slug_suffix(
    base_slug: str,
    exists: Callable[[str], bool],
    max_length: int = DEFAULT_MAX_SLUG_LENGTH,
    first_suffix: int = 1,
) -> str:
    slug = (base_slug or _fallback_slug("", "zh", max_length))[:max_length].strip("-")
    if not exists(slug):
        return slug

    base = slug
    counter = first_suffix
    while True:
        suffix = f"-{counter}"
        candidate = f"{base[:max_length - len(suffix)].rstrip('-')}{suffix}"
        if not exists(candidate):
            return candidate
        counter += 1
