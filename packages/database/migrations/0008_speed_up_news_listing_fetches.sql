CREATE INDEX IF NOT EXISTS idx_articles_lang_type_feed
  ON articles(lang, article_type, published_at DESC, id)
  WHERE status = 'published'
    AND audit_status = 'approved'
    AND deleted_at IS NULL
    AND is_indexable = TRUE;

CREATE INDEX IF NOT EXISTS idx_flash_news_lang_published
  ON flash_news(lang, published_at DESC, id);
