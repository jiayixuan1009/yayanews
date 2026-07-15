CREATE TABLE IF NOT EXISTS loop_runs (
    id SERIAL PRIMARY KEY,
    run_key TEXT NOT NULL UNIQUE,
    run_type TEXT NOT NULL DEFAULT 'manual',
    mode TEXT NOT NULL DEFAULT 'dry-run',
    status TEXT NOT NULL DEFAULT 'running',
    source TEXT,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP,
    stats JSONB NOT NULL DEFAULT '{}'::jsonb,
    notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS seo_feedback_snapshots (
    id SERIAL PRIMARY KEY,
    source TEXT NOT NULL DEFAULT 'gsc_performance',
    import_batch TEXT NOT NULL,
    dimension TEXT NOT NULL,
    label TEXT NOT NULL,
    url TEXT,
    lang TEXT,
    entity_kind TEXT,
    entity_value TEXT,
    clicks INTEGER NOT NULL DEFAULT 0,
    impressions INTEGER NOT NULL DEFAULT 0,
    ctr NUMERIC(10, 6) NOT NULL DEFAULT 0,
    position NUMERIC(10, 2),
    date_start DATE,
    date_end DATE,
    raw JSONB NOT NULL DEFAULT '{}'::jsonb,
    imported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT seo_feedback_snapshots_unique_row UNIQUE (source, import_batch, dimension, label)
);

CREATE TABLE IF NOT EXISTS content_opportunities (
    id SERIAL PRIMARY KEY,
    opportunity_key TEXT NOT NULL UNIQUE,
    source_snapshot_id INTEGER REFERENCES seo_feedback_snapshots(id) ON DELETE SET NULL,
    opportunity_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    priority INTEGER NOT NULL DEFAULT 50,
    score NUMERIC(12, 4) NOT NULL DEFAULT 0,
    entity_kind TEXT NOT NULL,
    entity_value TEXT NOT NULL,
    url TEXT,
    lang TEXT,
    title TEXT NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    recommended_action TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS loop_actions (
    id SERIAL PRIMARY KEY,
    action_key TEXT NOT NULL UNIQUE,
    opportunity_id INTEGER REFERENCES content_opportunities(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'proposed',
    risk_level TEXT NOT NULL DEFAULT 'low',
    target_kind TEXT NOT NULL,
    target_id INTEGER,
    target_value TEXT,
    target_url TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    result JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    queued_at TIMESTAMP,
    executed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS loop_action_results (
    id SERIAL PRIMARY KEY,
    action_id INTEGER REFERENCES loop_actions(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    message TEXT NOT NULL DEFAULT '',
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_loop_runs_started_at
    ON loop_runs(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_seo_feedback_latest
    ON seo_feedback_snapshots(source, imported_at DESC);

CREATE INDEX IF NOT EXISTS idx_seo_feedback_dimension_metrics
    ON seo_feedback_snapshots(dimension, impressions DESC, clicks DESC);

CREATE INDEX IF NOT EXISTS idx_content_opportunities_status_priority
    ON content_opportunities(status, priority DESC, score DESC, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_opportunities_type
    ON content_opportunities(opportunity_type, status);

CREATE INDEX IF NOT EXISTS idx_loop_actions_status_type
    ON loop_actions(status, action_type, risk_level);

CREATE INDEX IF NOT EXISTS idx_loop_actions_target
    ON loop_actions(target_kind, target_id);
