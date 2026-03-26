import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbDir = join(__dirname, '..', 'data');
mkdirSync(dbDir, { recursive: true });

const db = new Database(join(dbDir, 'yayanews.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
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
    view_count INTEGER DEFAULT 0, published_at DATETIME,
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
  CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
  CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
  CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at);
  CREATE INDEX IF NOT EXISTS idx_flash_published ON flash_news(published_at);
  CREATE INDEX IF NOT EXISTS idx_topics_slug ON topics(slug);

  INSERT OR IGNORE INTO categories (name, slug, description, sort_order) VALUES ('美股', 'us-stock', '美股市场资讯', 1);
  INSERT OR IGNORE INTO categories (name, slug, description, sort_order) VALUES ('加密货币', 'crypto', '加密货币与区块链资讯', 2);
  INSERT OR IGNORE INTO categories (name, slug, description, sort_order) VALUES ('衍生品', 'derivatives', '衍生品与大宗商品资讯', 3);
  INSERT OR IGNORE INTO categories (name, slug, description, sort_order) VALUES ('港股', 'hk-stock', '港股市场资讯', 4);
`);

console.log('[DB] Initialized at data/yayanews.db');
db.close();
