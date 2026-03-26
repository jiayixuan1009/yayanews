"""迁移：为 articles 表添加 source / source_url 字段"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "data" / "yayanews.db"
conn = sqlite3.connect(str(DB_PATH))

for col, default in [("source", "''"), ("source_url", "''")]:
    try:
        conn.execute(f"ALTER TABLE articles ADD COLUMN {col} TEXT DEFAULT {default}")
        print(f"  Added: {col}")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower():
            print(f"  Skip (exists): {col}")
        else:
            print(f"  Error: {col} -> {e}")

conn.commit()
conn.close()
print("Migration done.")
