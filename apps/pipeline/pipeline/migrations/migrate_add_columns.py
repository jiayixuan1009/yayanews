"""一次性迁移：给 articles 表添加 sentiment, tickers, key_points 字段。"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "data" / "yayanews.db"

conn = sqlite3.connect(str(DB_PATH))
for col in ["sentiment", "tickers", "key_points"]:
    try:
        conn.execute(f"ALTER TABLE articles ADD COLUMN {col} TEXT DEFAULT ''")
        print(f"  Added: {col}")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower():
            print(f"  Skip (exists): {col}")
        else:
            print(f"  Error: {col} -> {e}")
conn.commit()
conn.close()
print("Migration done.")
