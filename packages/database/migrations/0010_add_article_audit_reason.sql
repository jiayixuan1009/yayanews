ALTER TABLE articles
    ADD COLUMN IF NOT EXISTS audit_reason TEXT;
