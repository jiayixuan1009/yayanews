"""用 Python 初始化 SQLite 数据库（不依赖 Node）。"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "data" / "yayanews.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

SCHEMA = """
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE, description TEXT, sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
  summary TEXT, content TEXT NOT NULL, cover_image TEXT,
  category_id INTEGER REFERENCES categories(id), author TEXT DEFAULT 'YayaNews',
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft','review','published','archived')),
  article_type TEXT DEFAULT 'standard' CHECK(article_type IN ('short','standard','deep')),
  sentiment TEXT DEFAULT '',
  tickers TEXT DEFAULT '',
  key_points TEXT DEFAULT '',
  source TEXT DEFAULT '',
  source_url TEXT DEFAULT '',
  subcategory TEXT DEFAULT '',
  collected_at DATETIME,
  view_count INTEGER DEFAULT 0, published_at DATETIME,
  lang TEXT DEFAULT 'zh',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS article_tags (
  article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
  tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, tag_id)
);
CREATE TABLE IF NOT EXISTS flash_news (
  id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, content TEXT NOT NULL,
  source TEXT, source_url TEXT, category_id INTEGER REFERENCES categories(id),
  importance TEXT DEFAULT 'normal' CHECK(importance IN ('low','normal','high','urgent')),
  subcategory TEXT DEFAULT '',
  collected_at DATETIME,
  lang TEXT DEFAULT 'zh',
  published_at DATETIME DEFAULT CURRENT_TIMESTAMP, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
  description TEXT, cover_image TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active','archived')),
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS topic_articles (
  topic_id INTEGER REFERENCES topics(id) ON DELETE CASCADE,
  article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0, PRIMARY KEY (topic_id, article_id)
);
CREATE TABLE IF NOT EXISTS guides (
  id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
  summary TEXT, content TEXT NOT NULL, cover_image TEXT, sort_order INTEGER DEFAULT 0,
  published_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS pipeline_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_type TEXT NOT NULL CHECK(run_type IN ('article','flash','full')),
  started_at DATETIME NOT NULL, finished_at DATETIME NOT NULL,
  total_seconds REAL NOT NULL,
  items_requested INTEGER DEFAULT 0, items_produced INTEGER DEFAULT 0,
  stage_timings TEXT DEFAULT '{}', channel_timings TEXT DEFAULT '{}',
  error_count INTEGER DEFAULT 0, notes TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at);
CREATE INDEX IF NOT EXISTS idx_flash_published ON flash_news(published_at);
CREATE INDEX IF NOT EXISTS idx_topics_slug ON topics(slug);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_type ON pipeline_runs(run_type);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_started ON pipeline_runs(started_at);

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

SEEDS = [
    ("美股", "us-stock", "美股市场资讯", 1),
    ("加密货币", "crypto", "加密货币与区块链资讯", 2),
    ("衍生品", "derivatives", "衍生品与大宗商品资讯", 3),
    ("港股", "hk-stock", "港股市场资讯", 4),
]


def init():
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.executescript(SCHEMA)
    for name, slug, desc, order in SEEDS:
        conn.execute(
            "INSERT OR IGNORE INTO categories (name, slug, description, sort_order) VALUES (?, ?, ?, ?)",
            (name, slug, desc, order),
        )
    conn.commit()
    count = conn.execute("SELECT count(*) FROM categories").fetchone()[0]
    print(f"[DB] Initialized: {DB_PATH}")
    print(f"[DB] Categories: {count}")
    conn.close()


if __name__ == "__main__":
    init()
