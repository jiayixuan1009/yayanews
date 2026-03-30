"""迁移：为 articles 和 flash_news 表添加 subcategory 字段"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "data" / "yayanews.db"
conn = sqlite3.connect(str(DB_PATH))

for table in ["articles", "flash_news"]:
    try:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN subcategory TEXT DEFAULT ''")
        print(f"  Added subcategory to {table}")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower():
            print(f"  Skip (exists): {table}.subcategory")
        else:
            print(f"  Error: {e}")

conn.execute("CREATE INDEX IF NOT EXISTS idx_articles_subcategory ON articles(subcategory)")
conn.execute("CREATE INDEX IF NOT EXISTS idx_flash_subcategory ON flash_news(subcategory)")

# 回填现有衍生品文章的 subcategory
RULES = [
    ("commodity", ["黄金", "原油", "gold", "oil", "铜", "copper", "wheat", "commodity", "大宗商品", "Brent", "crude", "OPEC"]),
    ("futures", ["期货", "futures", "螺纹钢"]),
    ("options", ["期权", "options"]),
    ("forex", ["外汇", "forex", "USD", "EUR", "CNY", "JPY", "汇率"]),
    ("bonds", ["债券", "bond", "treasury", "国债"]),
]

derivatives_cat_id = conn.execute("SELECT id FROM categories WHERE slug='derivatives'").fetchone()
if derivatives_cat_id:
    cat_id = derivatives_cat_id[0]
    rows = conn.execute("SELECT id, title, content FROM articles WHERE category_id=? AND (subcategory IS NULL OR subcategory='')", (cat_id,)).fetchall()
    updated = 0
    for row_id, title, content in rows:
        text = f"{title} {content}".lower()
        matched = ""
        for sub_slug, keywords in RULES:
            if any(kw.lower() in text for kw in keywords):
                matched = sub_slug
                break
        if not matched:
            matched = "commodity"
        conn.execute("UPDATE articles SET subcategory=? WHERE id=?", (matched, row_id))
        updated += 1
    print(f"  Backfilled {updated} articles subcategory")

    rows = conn.execute("SELECT id, title, content FROM flash_news WHERE category_id=? AND (subcategory IS NULL OR subcategory='')", (cat_id,)).fetchall()
    updated = 0
    for row_id, title, content in rows:
        text = f"{title} {content}".lower()
        matched = ""
        for sub_slug, keywords in RULES:
            if any(kw.lower() in text for kw in keywords):
                matched = sub_slug
                break
        if not matched:
            matched = "commodity"
        conn.execute("UPDATE flash_news SET subcategory=? WHERE id=?", (matched, row_id))
        updated += 1
    print(f"  Backfilled {updated} flash subcategory")

conn.commit()
conn.close()
print("Done.")
