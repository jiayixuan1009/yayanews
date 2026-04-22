-- 云端增量更新 SQL 脚本 (安全更新版本)
-- 适用场景：仅向已有的生产数据库追加由于 i18n 多语言改造引发的新增字段，不会 DROP 现有任何数据！

-- 1. 更新 categories 表：追加 name_en, name_zh
ALTER TABLE categories ADD COLUMN IF NOT EXISTS name_en VARCHAR(255);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS name_zh VARCHAR(255);

-- 2. 更新 tags 表：追加 name_en, name_zh
ALTER TABLE tags ADD COLUMN IF NOT EXISTS name_en VARCHAR(255);
ALTER TABLE tags ADD COLUMN IF NOT EXISTS name_zh VARCHAR(255);

-- 3. 更新 topics 表：改写 description 为中英分离
ALTER TABLE topics ADD COLUMN IF NOT EXISTS description_zh TEXT;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS description_en TEXT;

-- 注意：
-- 执行完此脚本后，这几个新列将会是 NULL。
-- 请务必在云服务器上通过 ssh 运行我们刚提交的 node seed-i18n-names.mjs！
