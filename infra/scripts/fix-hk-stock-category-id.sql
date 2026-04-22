-- Migration: fix hk-stock category_id 7 → 4
-- settings.py changed hk-stock id from 7 to 4 to align with DB seed.
-- This script migrates any articles written under the old id=7.
--
-- Step 1: Check impact before running (dry-run)
--   SELECT COUNT(*) FROM articles WHERE category_id = 7;
--
-- Step 2: Confirm categories table has no legitimate id=7 row
--   SELECT * FROM categories WHERE id IN (4, 7);
--
-- Step 3: Run the fix
BEGIN;

UPDATE articles
   SET category_id = 4
 WHERE category_id = 7;

-- Optional: remove the orphan category row if it exists
-- DELETE FROM categories WHERE id = 7 AND slug = 'hk-stock';

COMMIT;
