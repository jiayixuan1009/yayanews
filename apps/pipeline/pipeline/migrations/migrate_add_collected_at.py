"""迁移：为 articles 和 flash_news 添加 collected_at 字段，用于计算处理耗时。"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "data" / "yayanews.db"


def migrate():
    conn = sqlite3.connect(str(DB_PATH))
    for table in ["articles", "flash_news"]:
        try:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN collected_at DATETIME")
            print(f"  Added collected_at to {table}")
        except sqlite3.OperationalError as e:
            if "duplicate column" in str(e).lower():
                print(f"  Skip (exists): {table}.collected_at")
            else:
                print(f"  Error: {e}")

    conn.execute(
        "UPDATE articles SET collected_at = created_at WHERE collected_at IS NULL"
    )
    conn.execute(
        "UPDATE flash_news SET collected_at = created_at WHERE collected_at IS NULL"
    )
    conn.commit()
    conn.close()
    print("Migration complete: collected_at backfilled from created_at.")


if __name__ == "__main__":
    migrate()
