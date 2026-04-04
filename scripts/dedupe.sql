-- Deduplicate flash_news: Keep the earliest published_at
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

-- Deduplicate articles: Keep the earliest published_at
DELETE FROM articles
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY title ORDER BY COALESCE(published_at, created_at, 'epoch'::timestamp) ASC, id ASC) AS rn
        FROM articles
    ) t
    WHERE t.rn > 1
);
