"""迁移：A股 → 美股，新增港股分类。"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "data" / "yayanews.db"
conn = sqlite3.connect(str(DB_PATH))

conn.execute("UPDATE categories SET name='美股', slug='us-stock', description='美股市场资讯' WHERE slug='a-stock'")
print("Updated: a-stock -> us-stock (美股)")

try:
    conn.execute("INSERT INTO categories (name, slug, description, sort_order) VALUES ('港股', 'hk-stock', '港股市场资讯', 4)")
    print("Added: hk-stock (港股)")
except sqlite3.IntegrityError:
    print("Skip: hk-stock already exists")

conn.commit()

rows = conn.execute("SELECT id, name, slug, sort_order FROM categories ORDER BY sort_order").fetchall()
for r in rows:
    print(f"  id={r[0]} name={r[1]} slug={r[2]} order={r[3]}")
conn.close()
print("Done.")
