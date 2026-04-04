SELECT t.name as tag_name, COUNT(at.article_id) as article_count
FROM tags t
JOIN article_tags at ON t.id = at.tag_id
JOIN articles a ON at.article_id = a.id
GROUP BY t.name
HAVING COUNT(at.article_id) > 20
ORDER BY article_count DESC
LIMIT 20;
