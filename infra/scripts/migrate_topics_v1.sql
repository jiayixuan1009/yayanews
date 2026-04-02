-- ============================================================
-- YayaNews 专题系统数据库迁移脚本
-- 版本：v1.0
-- 日期：2026-04-02
-- 操作：在生产服务器执行: psql $DATABASE_URL -f migrate_topics_v1.sql
-- ============================================================

BEGIN;

-- 1. 扩展 topics 表：新增双语字段、status、related_topics
ALTER TABLE topics
  ADD COLUMN IF NOT EXISTS name_zh       VARCHAR(100),
  ADD COLUMN IF NOT EXISTS name_en       VARCHAR(100),
  ADD COLUMN IF NOT EXISTS description_zh TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT,
  ADD COLUMN IF NOT EXISTS related_topics INT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS category_id   INT REFERENCES categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cover_image   VARCHAR(500);

-- 用现有 title 字段初始化 name_zh（如果 title 已存在）
UPDATE topics SET name_zh = title WHERE name_zh IS NULL AND title IS NOT NULL;
UPDATE topics SET name_en = title WHERE name_en IS NULL AND title IS NOT NULL;
UPDATE topics SET description_zh = description WHERE description_zh IS NULL AND description IS NOT NULL;
UPDATE topics SET description_en = description WHERE description_en IS NULL AND description IS NOT NULL;

-- 修正 status 字段取值（原为 'active'/'archived'，PRD 要求 'draft'/'active'/'archive'）
-- 若原 status 为 'archived'，迁移为 'archive'
DO $$
BEGIN
  -- 先检查 status 列是否存在且有约束
  ALTER TABLE topics ALTER COLUMN status SET DEFAULT 'active';
  UPDATE topics SET status = 'draft' WHERE status IS NULL;
  -- 将旧的 'archived' 改为 'archive'
  UPDATE topics SET status = 'archive' WHERE status = 'archived';
EXCEPTION WHEN others THEN
  RAISE NOTICE 'status column migration skipped: %', SQLERRM;
END $$;

-- 2. articles 表新增 topic_id 字段（主要专题关联）
ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS topic_id INT REFERENCES topics(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_articles_topic_id ON articles(topic_id);

-- 3. 创建精选文章关联表（替代原有 topic_articles 作为精选用途）
-- 注意：原 topic_articles 保留，用于精选文章管理
CREATE TABLE IF NOT EXISTS topic_featured_articles (
  topic_id    INT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  article_id  INT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  sort_order  INT NOT NULL DEFAULT 10,
  PRIMARY KEY (topic_id, article_id)
);

CREATE INDEX IF NOT EXISTS idx_tfa_topic_id ON topic_featured_articles(topic_id);

-- 4. 补充 topics 表索引
CREATE INDEX IF NOT EXISTS idx_topics_status ON topics(status);
CREATE INDEX IF NOT EXISTS idx_topics_slug ON topics(slug);

COMMIT;

-- 验证
SELECT 'Migration complete. Topics count: ' || COUNT(*)::text FROM topics;
SELECT 'Articles with topic_id: ' || COUNT(*)::text FROM articles WHERE topic_id IS NOT NULL;
