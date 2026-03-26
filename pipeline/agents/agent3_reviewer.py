"""
Agent 3: 质量审核
- 内容长度检查
- HTML 格式校验
- 标题查重
- 同语言相似度门控（仅中→中改写场景）
- 摘要检查
"""
import re
from pipeline.utils.database import title_exists
from pipeline.utils.llm import compute_similarity
from pipeline.utils.logger import get_logger, step_print

log = get_logger("agent3")

LENGTH_MIN = {"standard": 500, "deep": 1500}
SIMILARITY_THRESHOLD = 0.20


def _check_length(draft: dict) -> tuple[bool, str]:
    content = draft.get("content", "")
    text = re.sub(r"<[^>]+>", "", content)
    article_type = draft.get("type", "standard")
    min_len = LENGTH_MIN.get(article_type, 500)

    if len(text) < min_len:
        return False, f"内容过短: {len(text)} < {min_len}"
    return True, f"长度合格: {len(text)} 字"


def _check_html(draft: dict) -> tuple[bool, str]:
    content = draft.get("content", "")
    if not content.strip():
        return False, "内容为空"
    if "<p>" not in content and "<h2>" not in content:
        return False, "缺少基本 HTML 标签"
    return True, "HTML 格式正常"


def _check_duplicate(draft: dict) -> tuple[bool, str]:
    title = draft.get("title", "")
    if title_exists(title):
        return False, f"标题已存在: {title[:30]}"
    return True, "标题唯一"


def _is_chinese(text: str) -> bool:
    if not text:
        return False
    cn = sum(1 for ch in text if '\u4e00' <= ch <= '\u9fff')
    return cn / max(len(text), 1) > 0.15


def _check_similarity(draft: dict) -> tuple[bool, str]:
    """同语言相似度检测。英→中跨语言天然去重，跳过检查以节省时间。"""
    source = draft.get("source", "")
    original = draft.get("original_content", "")
    if source != "rss" or not original:
        return True, "非转载/无原文，跳过"

    if not _is_chinese(original):
        return True, "英→中跨语言，跳过"

    content = draft.get("content", "")
    text = re.sub(r"<[^>]+>", "", content)
    sim = compute_similarity(original, text)
    draft["_similarity"] = round(sim, 3)

    if sim >= SIMILARITY_THRESHOLD:
        return False, f"与原文相似度过高: {sim:.1%} (阈值 {SIMILARITY_THRESHOLD:.0%})"
    return True, f"相似度合格: {sim:.1%}"


def _check_summary(draft: dict) -> tuple[bool, str]:
    summary = draft.get("summary", "")
    if not summary or len(summary) < 10:
        return False, "摘要缺失或过短"
    if len(summary) > 200:
        draft["summary"] = summary[:200]
        return True, "摘要已截断至200字"
    return True, f"摘要合格: {len(summary)} 字"


def review(drafts: list[dict]) -> list[dict]:
    """
    主入口：审核所有草稿，返回通过的。
    """
    step_print("Agent 3: 质量审核", f"待审: {len(drafts)} 篇")

    checks = [
        ("长度", _check_length),
        ("HTML", _check_html),
        ("查重", _check_duplicate),
        ("相似度", _check_similarity),
        ("摘要", _check_summary),
    ]

    passed = []
    for i, draft in enumerate(drafts, 1):
        title = draft.get("title", "?")[:40]
        all_ok = True
        reasons = []

        for check_name, check_fn in checks:
            ok, msg = check_fn(draft)
            if not ok:
                all_ok = False
                reasons.append(f"{check_name}: {msg}")
            else:
                reasons.append(f"{check_name}: OK")

        status = "PASS" if all_ok else "FAIL"
        print(f"  [{i}] {status}: {title}")
        for r in reasons:
            print(f"       {r}")

        if all_ok:
            passed.append(draft)

    print(f"\n[Agent 3] 审核完成: {len(passed)}/{len(drafts)} 篇通过")
    return passed
