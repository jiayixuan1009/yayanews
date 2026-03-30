"""迁移脚本：新建 speed_benchmarks 表"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "data" / "yayanews.db"

SQL = """
CREATE TABLE IF NOT EXISTS speed_benchmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
  article_title TEXT NOT NULL,
  our_published_at DATETIME NOT NULL,
  competitor_title TEXT,
  competitor_source TEXT,
  competitor_url TEXT,
  competitor_published_at DATETIME,
  diff_seconds REAL,
  search_query TEXT,
  result_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','done','failed','no_result')),
  error_message TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_speed_bench_article ON speed_benchmarks(article_id);
CREATE INDEX IF NOT EXISTS idx_speed_bench_created ON speed_benchmarks(created_at);
"""

if __name__ == "__main__":
    conn = sqlite3.connect(str(DB_PATH))
    conn.executescript(SQL)
    conn.commit()
    print("[Migrate] speed_benchmarks table created.")
    conn.close()
