"""迁移: futures -> derivatives (衍生品)"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "data" / "yayanews.db"
conn = sqlite3.connect(str(DB_PATH))

conn.execute(
    "UPDATE categories SET name=?, slug=?, description=? WHERE slug=?",
    ("衍生品", "derivatives", "衍生品与大宗商品资讯", "futures"),
)
conn.commit()

rows = conn.execute("SELECT id, name, slug FROM categories ORDER BY sort_order").fetchall()
for r in rows:
    print(f"  id={r[0]} slug={r[2]} name={r[1]}")

conn.close()
print("Done.")
