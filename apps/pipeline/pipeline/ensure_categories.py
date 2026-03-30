"""
确保 categories 表包含标准栏目（含 AI资讯）。可与 db:init 配合使用或单独执行。

用法：
  python -m pipeline.ensure_categories
"""
import sqlite3
from pathlib import Path

from pipeline.category_config import CATEGORY_DISPLAY_ORDER, CATEGORY_NAMES

PROJECT = Path(__file__).resolve().parent.parent
DB_PATH = PROJECT / "data" / "yayanews.db"


def main() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          description TEXT,
          sort_order INTEGER NOT NULL DEFAULT 0
        )
        """
    )
    for i, slug in enumerate(CATEGORY_DISPLAY_ORDER):
        name = CATEGORY_NAMES.get(slug, slug)
        desc = "AI 与智能金融" if slug == "ai" else None
        conn.execute(
            """
            INSERT OR IGNORE INTO categories (name, slug, description, sort_order)
            VALUES (?, ?, ?, ?)
            """,
            (name, slug, desc or "", i),
        )
    conn.commit()
    conn.close()
    print("categories OK (含 AI资讯 ai)")


if __name__ == "__main__":
    main()
