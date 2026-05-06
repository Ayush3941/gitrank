CREATE TABLE IF NOT EXISTS scheduler_runtime_states (
    service_name TEXT NOT NULL,
    state_key TEXT NOT NULL,
    state_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (service_name, state_key)
);

CREATE INDEX IF NOT EXISTS idx_scheduler_runtime_states_updated_at
    ON scheduler_runtime_states(updated_at DESC);
