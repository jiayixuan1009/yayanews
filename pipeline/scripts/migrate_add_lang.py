"""
Migration: Add 'lang' column to articles and flash_news tables.
"""
import sqlite3
import sys
from pathlib import Path

# 获取项目根目录，以便找到数据库文件
PROJECT_ROOT = Path(__file__).parent.parent.parent
DB_PATH = PROJECT_ROOT / "data" / "yayanews.db"

def migrate():
    print(f"Connecting to database at {DB_PATH}")
    if not DB_PATH.exists():
        print("Database not found! Migration failed.")
        sys.exit(1)
        
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Add 'lang' to articles
    try:
        cursor.execute("ALTER TABLE articles ADD COLUMN lang TEXT DEFAULT 'zh' NOT NULL;")
        print("Success: Added 'lang' column to articles table.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print("Info: 'lang' column already exists in articles table.")
        else:
            print(f"Error adding 'lang' to articles: {e}")
            
    # Add 'lang' to flash_news
    try:
        cursor.execute("ALTER TABLE flash_news ADD COLUMN lang TEXT DEFAULT 'zh' NOT NULL;")
        print("Success: Added 'lang' column to flash_news table.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print("Info: 'lang' column already exists in flash_news table.")
        else:
            print(f"Error adding 'lang' to flash_news: {e}")
            
    # Add 'lang' to Flash_news init_db.py schema (just a reminder, actual schema change is in init_db.py)
    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
