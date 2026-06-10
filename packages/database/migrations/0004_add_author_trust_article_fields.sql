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

CREATE INDEX IF NOT EXISTS idx_authors_status ON authors(status);
CREATE INDEX IF NOT EXISTS idx_authors_role ON authors(role);

INSERT INTO authors
    (slug, display_name, role, bio, expertise, profile_url, status, review_status, is_external_source, external_source_url)
VALUES
    (
      'yayanews-editorial',
      'YayaNews',
      'editor',
      'YayaNews Editorial Desk publishes market news, financial context and reviewed analysis across US stocks, Hong Kong markets, crypto assets, derivatives and global macro.',
      'US stocks, Hong Kong markets, crypto, derivatives, global macro',
      '/authors/yayanews-editorial',
      'active',
      'approved',
      FALSE,
      NULL
    ),
    (
      'yayanews-ai-desk',
      'YayaNews AI Desk',
      'ai_assisted_desk',
      'YayaNews AI Desk uses AI-assisted tools for research organization, draft support, translation and formatting. Published work is reviewed before release.',
      'financial news workflow, translation, market monitoring',
      '/authors/yayanews-ai-desk',
      'active',
      'approved',
      FALSE,
      NULL
    ),
    ('reuters', 'Reuters', 'syndication_source', 'Syndicated source for global market and business news referenced by YayaNews coverage.', 'global markets, business news', '/authors/reuters', 'active', 'pending', TRUE, 'https://www.reuters.com/'),
    ('bloomberg', 'Bloomberg', 'syndication_source', 'Syndicated source for global market and business news referenced by YayaNews coverage.', 'global markets, business news', '/authors/bloomberg', 'active', 'pending', TRUE, 'https://www.bloomberg.com/'),
    ('cnbc', 'CNBC', 'syndication_source', 'Syndicated source for market and business news referenced by YayaNews coverage.', 'markets, business news', '/authors/cnbc', 'active', 'pending', TRUE, 'https://www.cnbc.com/'),
    ('coindesk', 'CoinDesk', 'syndication_source', 'Syndicated source for cryptocurrency and blockchain news referenced by YayaNews coverage.', 'cryptocurrency, blockchain', '/authors/coindesk', 'active', 'pending', TRUE, 'https://www.coindesk.com/'),
    ('cointelegraph', 'CoinTelegraph', 'syndication_source', 'Syndicated source for cryptocurrency and blockchain news referenced by YayaNews coverage.', 'cryptocurrency, blockchain', '/authors/cointelegraph', 'active', 'pending', TRUE, 'https://cointelegraph.com/'),
    ('seeking-alpha', 'Seeking Alpha', 'syndication_source', 'Syndicated source for market analysis referenced by YayaNews coverage.', 'equities, market analysis', '/authors/seeking-alpha', 'active', 'pending', TRUE, 'https://seekingalpha.com/'),
    ('wall-street-journal', 'Wall Street Journal', 'syndication_source', 'Syndicated source for business and market news referenced by YayaNews coverage.', 'business news, markets', '/authors/wall-street-journal', 'active', 'pending', TRUE, 'https://www.wsj.com/'),
    ('financial-times', 'Financial Times', 'syndication_source', 'Syndicated source for business and market news referenced by YayaNews coverage.', 'business news, markets', '/authors/financial-times', 'active', 'pending', TRUE, 'https://www.ft.com/')
ON CONFLICT (slug) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    role = EXCLUDED.role,
    bio = COALESCE(authors.bio, EXCLUDED.bio),
    expertise = COALESCE(authors.expertise, EXCLUDED.expertise),
    profile_url = COALESCE(authors.profile_url, EXCLUDED.profile_url),
    status = EXCLUDED.status,
    review_status = EXCLUDED.review_status,
    is_external_source = EXCLUDED.is_external_source,
    external_source_url = COALESCE(authors.external_source_url, EXCLUDED.external_source_url),
    updated_at = CURRENT_TIMESTAMP;

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

CREATE INDEX IF NOT EXISTS idx_articles_author_id ON articles(author_id);
CREATE INDEX IF NOT EXISTS idx_articles_source_type ON articles(source_type);
CREATE INDEX IF NOT EXISTS idx_articles_indexable ON articles(is_indexable);
CREATE INDEX IF NOT EXISTS idx_articles_deleted_at ON articles(deleted_at);

UPDATE articles
SET source_type = CASE
    WHEN LOWER(COALESCE(author, '')) LIKE '%ai%' THEN 'ai_assisted'
    WHEN COALESCE(NULLIF(TRIM(source), ''), 'YayaNews') NOT IN ('YayaNews', 'Yaya Financial News') THEN 'syndicated'
    ELSE 'original'
  END
WHERE source_type IS NULL OR source_type = 'original';

UPDATE articles
SET original_url = source_url
WHERE original_url IS NULL
  AND source_url IS NOT NULL
  AND source_url <> ''
  AND source_type IN ('syndicated', 'translated', 'partner');

WITH distinct_names AS (
  SELECT DISTINCT COALESCE(NULLIF(TRIM(source), ''), NULLIF(TRIM(author), ''), 'YayaNews') AS display_name,
         CASE
           WHEN COALESCE(NULLIF(TRIM(source), ''), '') NOT IN ('', 'YayaNews', 'Yaya Financial News') THEN TRUE
           ELSE FALSE
         END AS is_external_source
  FROM articles
),
normalized AS (
  SELECT
    CASE
      WHEN LOWER(display_name) IN ('yayanews', 'yaya financial news') THEN 'yayanews-editorial'
      WHEN LOWER(display_name) IN ('yayanews ai desk', 'ai') THEN 'yayanews-ai-desk'
      ELSE COALESCE(
        NULLIF(TRIM(BOTH '-' FROM LOWER(REGEXP_REPLACE(REGEXP_REPLACE(display_name, '&', ' and ', 'g'), '[^a-zA-Z0-9]+', '-', 'g'))), ''),
        'author-' || SUBSTRING(MD5(display_name), 1, 12)
      )
    END AS slug,
    display_name,
    is_external_source
  FROM distinct_names
)
INSERT INTO authors (slug, display_name, role, profile_url, status, review_status, is_external_source)
SELECT
  slug,
  display_name,
  CASE WHEN is_external_source THEN 'syndication_source' ELSE 'news_writer' END,
  '/authors/' || slug,
  'active',
  'pending',
  is_external_source
FROM normalized
WHERE slug <> ''
ON CONFLICT (slug) DO NOTHING;

UPDATE articles a
SET author_id = au.id
FROM authors au
WHERE a.author_id IS NULL
  AND a.source_type IN ('syndicated', 'translated', 'partner')
  AND au.slug = COALESCE(
    NULLIF(TRIM(BOTH '-' FROM LOWER(REGEXP_REPLACE(REGEXP_REPLACE(COALESCE(NULLIF(TRIM(a.source), ''), a.author, 'YayaNews'), '&', ' and ', 'g'), '[^a-zA-Z0-9]+', '-', 'g'))), ''),
    'author-' || SUBSTRING(MD5(COALESCE(NULLIF(TRIM(a.source), ''), a.author, 'YayaNews')), 1, 12)
  );

UPDATE articles a
SET author_id = au.id
FROM authors au
WHERE a.author_id IS NULL
  AND au.slug = CASE
    WHEN LOWER(COALESCE(NULLIF(TRIM(a.author), ''), 'YayaNews')) IN ('yayanews', 'yaya financial news') THEN 'yayanews-editorial'
    WHEN LOWER(COALESCE(NULLIF(TRIM(a.author), ''), 'YayaNews')) IN ('ai', 'yayanews ai desk') THEN 'yayanews-ai-desk'
    ELSE COALESCE(
      NULLIF(TRIM(BOTH '-' FROM LOWER(REGEXP_REPLACE(REGEXP_REPLACE(COALESCE(NULLIF(TRIM(a.author), ''), 'YayaNews'), '&', ' and ', 'g'), '[^a-zA-Z0-9]+', '-', 'g'))), ''),
      'author-' || SUBSTRING(MD5(COALESCE(NULLIF(TRIM(a.author), ''), 'YayaNews')), 1, 12)
    )
  END;
