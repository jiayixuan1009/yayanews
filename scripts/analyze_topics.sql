SELECT ticker, COUNT(*) as article_count
FROM (
  SELECT unnest(string_to_array(btrim(tickers, '[]" '), ',')) AS ticker
  FROM articles
  WHERE topic_id IS NULL
    AND tickers IS NOT NULL 
    AND tickers != ''
) t
WHERE ticker IS NOT NULL AND length(trim(ticker)) > 0
GROUP BY ticker
HAVING COUNT(*) > 10
ORDER BY article_count DESC
LIMIT 50;
