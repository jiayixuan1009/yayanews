-- 在目标 PostgreSQL 上执行，查看中英文稿件与快讯数量（用于确认是否需从备份恢复）
SELECT 'articles' AS tbl, COALESCE(lang, '(null)') AS lang, status, COALESCE(audit_status, '(null)') AS audit_status, COUNT(*)::int AS n
FROM articles
GROUP BY 1, 2, 3, 4
ORDER BY tbl, lang, status;

SELECT 'flash_news' AS tbl, COALESCE(lang, '(null)') AS lang, COUNT(*)::int AS n
FROM flash_news
GROUP BY 1, 2
ORDER BY tbl, lang;
