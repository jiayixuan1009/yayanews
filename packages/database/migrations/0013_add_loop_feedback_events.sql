CREATE TABLE IF NOT EXISTS loop_feedback_events (
    id SERIAL PRIMARY KEY,
    dedupe_key TEXT NOT NULL,
    source TEXT NOT NULL,
    import_batch TEXT NOT NULL,
    event_type TEXT NOT NULL,
    url TEXT,
    lang TEXT,
    entity_kind TEXT,
    entity_value TEXT,
    metric_name TEXT,
    metric_value NUMERIC(16, 4),
    date_start DATE,
    date_end DATE,
    raw JSONB NOT NULL DEFAULT '{}'::jsonb,
    imported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS loop_feedback_events_unique_row
    ON loop_feedback_events(source, import_batch, event_type, dedupe_key);

CREATE INDEX IF NOT EXISTS idx_loop_feedback_source_latest
    ON loop_feedback_events(source, imported_at DESC);

CREATE INDEX IF NOT EXISTS idx_loop_feedback_entity
    ON loop_feedback_events(entity_kind, entity_value, event_type);

CREATE INDEX IF NOT EXISTS idx_loop_feedback_metric
    ON loop_feedback_events(metric_name, metric_value DESC);
