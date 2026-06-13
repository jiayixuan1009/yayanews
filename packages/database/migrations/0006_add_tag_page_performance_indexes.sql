CREATE INDEX IF NOT EXISTS idx_tags_slug ON tags(slug);

CREATE INDEX IF NOT EXISTS idx_article_tags_tag_article
  ON article_tags(tag_id, article_id);

CREATE INDEX IF NOT EXISTS idx_articles_tag_page_feed
  ON articles(lang, published_at DESC, id)
  WHERE status = 'published'
    AND audit_status = 'approved'
    AND deleted_at IS NULL
    AND is_indexable = TRUE;
