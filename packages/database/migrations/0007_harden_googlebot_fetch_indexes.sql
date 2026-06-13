CREATE INDEX IF NOT EXISTS idx_articles_slug_indexable
  ON articles(slug)
  WHERE status = 'published'
    AND audit_status = 'approved'
    AND deleted_at IS NULL
    AND is_indexable = TRUE;

CREATE INDEX IF NOT EXISTS idx_articles_category_feed
  ON articles(category_id, lang, published_at DESC, id)
  WHERE status = 'published'
    AND audit_status = 'approved'
    AND deleted_at IS NULL
    AND is_indexable = TRUE;

CREATE INDEX IF NOT EXISTS idx_articles_topic_feed
  ON articles(topic_id, published_at DESC, id)
  WHERE status = 'published'
    AND audit_status = 'approved'
    AND deleted_at IS NULL
    AND is_indexable = TRUE;

CREATE INDEX IF NOT EXISTS idx_articles_published_id_feed
  ON articles(published_at DESC, id)
  WHERE status = 'published'
    AND audit_status = 'approved'
    AND deleted_at IS NULL
    AND is_indexable = TRUE;

CREATE INDEX IF NOT EXISTS idx_article_tags_article_tag
  ON article_tags(article_id, tag_id);
