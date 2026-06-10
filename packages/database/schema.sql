CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE, description TEXT, sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS authors (
    id SERIAL PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'news_writer',
    bio TEXT,
    expertise TEXT,
    avatar_url TEXT,
    email_or_contact TEXT,
    profile_url TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    review_status TEXT NOT NULL DEFAULT 'pending',
    is_external_source BOOLEAN NOT NULL DEFAULT FALSE,
    external_source_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    author_id INTEGER REFERENCES authors(id) ON DELETE SET NULL,
    author TEXT DEFAULT 'YayaNews',
    status TEXT DEFAULT 'draft',
    article_type TEXT DEFAULT 'standard',
    source_type TEXT NOT NULL DEFAULT 'original',
    original_url TEXT,
    license_type TEXT,
    editor_id INTEGER REFERENCES authors(id) ON DELETE SET NULL,
    reviewer_id INTEGER REFERENCES authors(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP,
    deleted_at TIMESTAMP,
    is_indexable BOOLEAN NOT NULL DEFAULT TRUE,
    canonical_url TEXT,
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
CREATE TABLE IF NOT EXISTS llm_usage (
    id SERIAL PRIMARY KEY,
    caller TEXT DEFAULT '',
    route TEXT DEFAULT '',
    model TEXT DEFAULT '',
    status TEXT DEFAULT 'ok',
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_tokens INTEGER,
    prompt_chars INTEGER DEFAULT 0,
    completion_chars INTEGER DEFAULT 0,
    max_tokens INTEGER,
    temperature REAL,
    latency_ms INTEGER,
    error_type TEXT DEFAULT '',
    error_message TEXT DEFAULT '',
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
CREATE INDEX IF NOT EXISTS idx_articles_author_id ON articles(author_id);
CREATE INDEX IF NOT EXISTS idx_articles_source_type ON articles(source_type);
CREATE INDEX IF NOT EXISTS idx_articles_indexable ON articles(is_indexable);
CREATE INDEX IF NOT EXISTS idx_articles_deleted_at ON articles(deleted_at);
CREATE INDEX IF NOT EXISTS idx_flash_published ON flash_news(published_at);
CREATE INDEX IF NOT EXISTS idx_topics_slug ON topics(slug);
CREATE INDEX IF NOT EXISTS idx_authors_status ON authors(status);
CREATE INDEX IF NOT EXISTS idx_authors_role ON authors(role);
CREATE INDEX IF NOT EXISTS idx_llm_usage_created_at ON llm_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_llm_usage_caller ON llm_usage(caller);

INSERT INTO categories (name, slug, description, sort_order) VALUES 
('美股', 'us-stock', '美股市场资讯', 1),
('加密货币', 'crypto', '加密货币与区块链资讯', 2),
('衍生品', 'derivatives', '衍生品与大宗商品资讯', 3),
('港股', 'hk-stock', '港股市场资讯', 4)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO authors (slug, display_name, role, bio, expertise, profile_url, status, review_status)
VALUES
('yayanews-editorial', 'YayaNews', 'editor', 'YayaNews Editorial Desk publishes market news, financial context and reviewed analysis across US stocks, Hong Kong markets, crypto assets, derivatives and global macro.', 'US stocks, Hong Kong markets, crypto, derivatives, global macro', '/authors/yayanews-editorial', 'active', 'approved'),
('yayanews-ai-desk', 'YayaNews AI Desk', 'ai_assisted_desk', 'YayaNews AI Desk uses AI-assisted tools for research organization, draft support, translation and formatting. Published work is reviewed before release.', 'financial news workflow, translation, market monitoring', '/authors/yayanews-ai-desk', 'active', 'approved')
ON CONFLICT (slug) DO NOTHING;

-- enable pgvector (Bypassed for native Windows PG without pgvector DLL)
-- CREATE EXTENSION IF NOT EXISTS vector;

-- add missing columns to articles
ALTER TABLE articles ADD COLUMN IF NOT EXISTS sentiment TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS tickers TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS key_points TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS author_id INTEGER REFERENCES authors(id) ON DELETE SET NULL;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'original';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS original_url TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS license_type TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS editor_id INTEGER REFERENCES authors(id) ON DELETE SET NULL;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS reviewer_id INTEGER REFERENCES authors(id) ON DELETE SET NULL;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS is_indexable BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS canonical_url TEXT;
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
