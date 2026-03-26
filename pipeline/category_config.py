"""
内容栏目配置：与前端栏目顺序一致，供 pipeline 各脚本使用。

栏目顺序：快讯、美股、港股、衍生品、加密货币、AI资讯、其他。
快讯为独立页 /flash，不入 DB categories；其余为资讯分类 slug。
"""
from __future__ import annotations

# 资讯分类 slug 顺序（用于排序、run_type、seed 等）
CATEGORY_DISPLAY_ORDER: list[str] = [
    "us-stock",    # 美股
    "hk-stock",    # 港股
    "derivatives", # 衍生品
    "crypto",      # 加密货币
    "ai",          # AI资讯
    "other",       # 其他
]

# slug -> 中文名（pipeline 展示或写入 DB 时用）
CATEGORY_NAMES: dict[str, str] = {
    "us-stock": "美股",
    "hk-stock": "港股",
    "derivatives": "衍生品",
    "crypto": "加密货币",
    "ai": "AI资讯",
    "other": "其他",
}

# 快讯为独立渠道，不在此列表
FLASH_SLUG = "flash"


def get_category_name(slug: str) -> str:
    return CATEGORY_NAMES.get(slug, slug)


def ordered_slugs() -> list[str]:
    return list(CATEGORY_DISPLAY_ORDER)
