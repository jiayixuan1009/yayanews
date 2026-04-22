CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE, description TEXT, sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS topics (
    id SERIAL PRIMARY KEY, title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
    description TEXT, cover_image TEXT,
    status TEXT DEFAULT 'active',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS articles (
    id SERIAL PRIMARY KEY, title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
    summary TEXT, content TEXT NOT NULL, cover_image TEXT,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL, 
    topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL,
    parent_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
    author TEXT DEFAULT 'YayaNews',
    status TEXT DEFAULT 'draft',
    article_type TEXT DEFAULT 'standard',
    view_count INTEGER DEFAULT 0, published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    collected_at TIMESTAMP, lang TEXT DEFAULT 'zh' NOT NULL
);
CREATE TABLE IF NOT EXISTS article_tags (
    article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (article_id, tag_id)
);
CREATE TABLE IF NOT EXISTS flash_news (
    id SERIAL PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL,
    source TEXT, source_url TEXT, category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    importance TEXT DEFAULT 'normal',
    published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    collected_at TIMESTAMP, lang TEXT DEFAULT 'zh' NOT NULL
);

CREATE TABLE IF NOT EXISTS topic_articles (
    topic_id INTEGER REFERENCES topics(id) ON DELETE CASCADE,
    article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0, PRIMARY KEY (topic_id, article_id)
);
CREATE TABLE IF NOT EXISTS topic_featured_articles (
    topic_id INTEGER REFERENCES topics(id) ON DELETE CASCADE,
    article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0, PRIMARY KEY (topic_id, article_id)
);
CREATE TABLE IF NOT EXISTS guides (
    id SERIAL PRIMARY KEY, title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
    summary TEXT, content TEXT NOT NULL, cover_image TEXT, sort_order INTEGER DEFAULT 0,
    published_at TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS pipeline_runs (
    id SERIAL PRIMARY KEY,
    run_type TEXT NOT NULL,
    started_at TIMESTAMP NOT NULL,
    finished_at TIMESTAMP NOT NULL,
    total_seconds REAL NOT NULL,
    items_requested INTEGER DEFAULT 0,
    items_produced INTEGER DEFAULT 0,
    stage_timings TEXT DEFAULT '{}',
    channel_timings TEXT DEFAULT '{}',
    error_count INTEGER DEFAULT 0,
    notes TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS speed_benchmarks (
    id SERIAL PRIMARY KEY,
    article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
    article_title TEXT NOT NULL,
    our_published_at TIMESTAMP NOT NULL,
    competitor_title TEXT,
    competitor_source TEXT,
    competitor_url TEXT,
    competitor_published_at TIMESTAMP,
    diff_seconds REAL,
    search_query TEXT,
    result_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    error_message TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at);
CREATE INDEX IF NOT EXISTS idx_flash_published ON flash_news(published_at);
CREATE INDEX IF NOT EXISTS idx_topics_slug ON topics(slug);

INSERT INTO categories (name, slug, description, sort_order) VALUES 
('美股', 'us-stock', '美股市场资讯', 1),
('加密货币', 'crypto', '加密货币与区块链资讯', 2),
('衍生品', 'derivatives', '衍生品与大宗商品资讯', 3),
('港股', 'hk-stock', '港股市场资讯', 4)
ON CONFLICT (slug) DO NOTHING;

-- enable pgvector (Bypassed for native Windows PG without pgvector DLL)
-- CREATE EXTENSION IF NOT EXISTS vector;

-- add missing columns to articles
ALTER TABLE articles ADD COLUMN IF NOT EXISTS sentiment TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS tickers TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS key_points TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS subcategory TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES articles(id) ON DELETE CASCADE;
-- ALTER TABLE articles ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- add missing columns to flash_news
ALTER TABLE flash_news ADD COLUMN IF NOT EXISTS subcategory TEXT;
-- ALTER TABLE flash_news ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- add missing columns for Next.js queries (fixes 3515754433 Server-Side Error)
ALTER TABLE articles ADD COLUMN IF NOT EXISTS audit_status TEXT DEFAULT 'approved';
ALTER TABLE topics ADD COLUMN IF NOT EXISTS name_zh TEXT;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS name_en TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS name_zh TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS name_en TEXT;

-- i18n: add English name to tags for bilingual display
ALTER TABLE tags ADD COLUMN IF NOT EXISTS name_en TEXT;

-- i18n: add bilingual descriptions to topics
ALTER TABLE topics ADD COLUMN IF NOT EXISTS description_zh TEXT;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS description_en TEXT;
