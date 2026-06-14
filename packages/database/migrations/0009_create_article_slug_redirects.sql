CREATE TABLE IF NOT EXISTS article_slug_redirects (
    id SERIAL PRIMARY KEY,
    old_slug TEXT NOT NULL UNIQUE,
    article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    new_slug TEXT NOT NULL,
    lang TEXT NOT NULL DEFAULT 'zh',
    reason TEXT NOT NULL DEFAULT 'slug_backfill',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT article_slug_redirects_changed CHECK (old_slug <> new_slug)
);

CREATE INDEX IF NOT EXISTS idx_article_slug_redirects_article_id
    ON article_slug_redirects(article_id);

CREATE INDEX IF NOT EXISTS idx_article_slug_redirects_new_slug
    ON article_slug_redirects(new_slug);
