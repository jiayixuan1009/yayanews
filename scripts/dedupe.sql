-- Deduplicate flash_news: Keep the earliest published_at
ALTER TABLE articles ADD COLUMN IF NOT EXISTS audit_status TEXT DEFAULT 'approved';

DELETE FROM flash_news
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY title ORDER BY COALESCE(published_at, created_at, 'epoch'::timestamp) ASC, id ASC) AS rn
        FROM flash_news
    ) t
    WHERE t.rn > 1
);

-- Deduplicate articles by normalized title: Keep published/approved rows first,
-- then the earliest published_at/created_at.
WITH ranked_articles AS (
    SELECT
        id,
        FIRST_VALUE(id) OVER (
            PARTITION BY lower(trim(title))
            ORDER BY
                CASE WHEN status = 'published' THEN 0 ELSE 1 END,
                CASE WHEN audit_status = 'approved' THEN 0 ELSE 1 END,
                COALESCE(published_at, created_at, 'epoch'::timestamp) ASC,
                id ASC
        ) AS keeper_id,
        ROW_NUMBER() OVER (
            PARTITION BY lower(trim(title))
            ORDER BY
                CASE WHEN status = 'published' THEN 0 ELSE 1 END,
                CASE WHEN audit_status = 'approved' THEN 0 ELSE 1 END,
                COALESCE(published_at, created_at, 'epoch'::timestamp) ASC,
                id ASC
        ) AS rn
    FROM articles
    WHERE NULLIF(trim(title), '') IS NOT NULL
)
UPDATE articles child
SET parent_id = ranked_articles.keeper_id
FROM ranked_articles
WHERE child.parent_id = ranked_articles.id
  AND ranked_articles.rn > 1
  AND child.id <> ranked_articles.keeper_id;

WITH ranked_articles AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY lower(trim(title))
            ORDER BY
                CASE WHEN status = 'published' THEN 0 ELSE 1 END,
                CASE WHEN audit_status = 'approved' THEN 0 ELSE 1 END,
                COALESCE(published_at, created_at, 'epoch'::timestamp) ASC,
                id ASC
        ) AS rn
    FROM articles
    WHERE NULLIF(trim(title), '') IS NOT NULL
)
DELETE FROM articles
WHERE id IN (
    SELECT id
    FROM ranked_articles
    WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_normalized_title_unique
ON articles ((lower(trim(title))))
WHERE NULLIF(trim(title), '') IS NOT NULL;
