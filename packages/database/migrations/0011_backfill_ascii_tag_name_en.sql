UPDATE tags
SET name_en = name
WHERE (name_en IS NULL OR TRIM(name_en) = '')
  AND name ~ '^[A-Za-z0-9][A-Za-z0-9 .,&/+()''-]*$';
