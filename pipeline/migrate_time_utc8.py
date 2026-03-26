"""迁移：将所有现有时间从 UTC 修正为 UTC+8"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "data" / "yayanews.db"
conn = sqlite3.connect(str(DB_PATH))

tables_columns = [
    ("articles", ["published_at", "created_at", "updated_at"]),
    ("flash_news", ["published_at", "created_at"]),
    ("categories", ["created_at"]),
    ("tags", ["created_at"]),
    ("topics", ["created_at", "updated_at"]),
    ("guides", ["published_at", "created_at", "updated_at"]),
]

total = 0
for table, columns in tables_columns:
    for col in columns:
        try:
            result = conn.execute(
                f"UPDATE {table} SET {col} = datetime({col}, '+8 hours') WHERE {col} IS NOT NULL"
            )
            count = result.rowcount
            total += count
            print(f"  {table}.{col}: {count} rows updated")
        except Exception as e:
            print(f"  {table}.{col}: ERROR - {e}")

conn.commit()
conn.close()
print(f"\nDone. Total rows updated: {total}")
