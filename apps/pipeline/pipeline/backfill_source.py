"""补填现有文章的 source 字段"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "data" / "yayanews.db"
conn = sqlite3.connect(str(DB_PATH))

rules = [
    ("Seeking Alpha", "slug LIKE 'bp-%' OR slug LIKE 'woodside-%' OR slug LIKE 'brent-%'"),
    ("CoinDesk", "slug LIKE 'senator-tim-%' OR slug LIKE 'bitcoin-s-rally%' OR slug LIKE 'u-s-sec-%'"),
]

for label, where in rules:
    result = conn.execute(f"UPDATE articles SET source=? WHERE ({where}) AND (source IS NULL OR source='')", (label,))
    print(f"  {label}: {result.rowcount} rows")

result = conn.execute("UPDATE articles SET source='YayaNews' WHERE source IS NULL OR source=''")
print(f"  YayaNews (default): {result.rowcount} rows")

conn.commit()

rows = conn.execute("SELECT source, COUNT(*) as cnt FROM articles GROUP BY source ORDER BY cnt DESC").fetchall()
print("\nResult:")
for r in rows:
    print(f"  {r[0]:20s} {r[1]} articles")

conn.close()
