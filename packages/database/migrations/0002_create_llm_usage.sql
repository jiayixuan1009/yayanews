CREATE TABLE IF NOT EXISTS llm_usage (
    id SERIAL PRIMARY KEY,
    caller TEXT DEFAULT '',
    route TEXT DEFAULT '',
    model TEXT DEFAULT '',
    status TEXT DEFAULT 'ok',
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_tokens INTEGER,
    prompt_chars INTEGER DEFAULT 0,
    completion_chars INTEGER DEFAULT 0,
    max_tokens INTEGER,
    temperature REAL,
    latency_ms INTEGER,
    error_type TEXT DEFAULT '',
    error_message TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_llm_usage_created_at ON llm_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_llm_usage_caller ON llm_usage(caller);
