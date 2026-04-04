SELECT ticker, COUNT(*) as article_count
FROM (
  SELECT unnest(string_to_array(btrim(tickers, '[]" '), ',')) AS ticker
  FROM articles
  WHERE tickers IS NOT NULL AND tickers != ''
) t
WHERE ticker IS NOT NULL AND length(trim(ticker)) > 1
GROUP BY ticker
HAVING COUNT(*) > 20
ORDER BY article_count DESC
LIMIT 100;
