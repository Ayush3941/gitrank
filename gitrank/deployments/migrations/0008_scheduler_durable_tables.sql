CREATE TABLE IF NOT EXISTS scheduler_jobs (
    service_name TEXT NOT NULL,
    job_id TEXT NOT NULL,
    queue_name TEXT NOT NULL,
    job_type TEXT NOT NULL,
    status TEXT NOT NULL,
    correlation_id TEXT NOT NULL DEFAULT '',
    delivery_id TEXT NOT NULL DEFAULT '',
    installation_id BIGINT NOT NULL DEFAULT 0,
    repository TEXT NOT NULL DEFAULT '',
    subject TEXT NOT NULL DEFAULT '',
    dedupe_key TEXT NOT NULL DEFAULT '',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    not_before TIMESTAMPTZ NOT NULL,
    lease_expires_at TIMESTAMPTZ NULL,
    last_error TEXT NOT NULL DEFAULT '',
    payload_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (service_name, job_id)
);

CREATE INDEX IF NOT EXISTS idx_scheduler_jobs_service_status_not_before
    ON scheduler_jobs(service_name, status, not_before ASC);

CREATE INDEX IF NOT EXISTS idx_scheduler_jobs_service_correlation
    ON scheduler_jobs(service_name, correlation_id);

CREATE INDEX IF NOT EXISTS idx_scheduler_jobs_service_repository
    ON scheduler_jobs(service_name, repository);

CREATE INDEX IF NOT EXISTS idx_scheduler_jobs_service_delivery
    ON scheduler_jobs(service_name, delivery_id);

CREATE TABLE IF NOT EXISTS scheduler_dead_letters (
    service_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    job_id TEXT NOT NULL,
    queue_name TEXT NOT NULL,
    job_type TEXT NOT NULL,
    delivery_id TEXT NOT NULL DEFAULT '',
    correlation_id TEXT NOT NULL DEFAULT '',
    installation_id BIGINT NOT NULL DEFAULT 0,
    repository TEXT NOT NULL DEFAULT '',
    subject TEXT NOT NULL DEFAULT '',
    dedupe_key TEXT NOT NULL DEFAULT '',
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL,
    error_message TEXT NOT NULL DEFAULT '',
    payload_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL,
    replayed_at TIMESTAMPTZ NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (service_name, record_id)
);

CREATE INDEX IF NOT EXISTS idx_scheduler_dead_letters_service_created
    ON scheduler_dead_letters(service_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scheduler_dead_letters_service_job
    ON scheduler_dead_letters(service_name, job_id);

CREATE INDEX IF NOT EXISTS idx_scheduler_dead_letters_service_correlation
    ON scheduler_dead_letters(service_name, correlation_id);

CREATE TABLE IF NOT EXISTS scheduler_backfill_plans (
    service_name TEXT NOT NULL,
    plan_id TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    cron TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    targets_jsonb JSONB NOT NULL DEFAULT '[]'::jsonb,
    last_run_at TIMESTAMPTZ NULL,
    next_run_at TIMESTAMPTZ NULL,
    queued_jobs_total INTEGER NOT NULL DEFAULT 0,
    deduplicated_total INTEGER NOT NULL DEFAULT 0,
    rate_limited_total INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    last_correlation_id TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (service_name, plan_id)
);

CREATE INDEX IF NOT EXISTS idx_scheduler_backfill_plans_service_next
    ON scheduler_backfill_plans(service_name, enabled, next_run_at ASC);

CREATE INDEX IF NOT EXISTS idx_scheduler_backfill_plans_service_correlation
    ON scheduler_backfill_plans(service_name, last_correlation_id);

CREATE TABLE IF NOT EXISTS scheduler_rate_limit_windows (
    service_name TEXT NOT NULL,
    scope TEXT NOT NULL,
    scope_key TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    hit_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (service_name, scope, scope_key)
);

CREATE INDEX IF NOT EXISTS idx_scheduler_rate_limit_windows_service_scope
    ON scheduler_rate_limit_windows(service_name, scope, started_at ASC);

CREATE TABLE IF NOT EXISTS scheduler_runtime_counters (
    service_name TEXT NOT NULL PRIMARY KEY,
    queue_retry_count INTEGER NOT NULL DEFAULT 0,
    queue_failure_count INTEGER NOT NULL DEFAULT 0,
    queue_replay_count INTEGER NOT NULL DEFAULT 0,
    tick_runs INTEGER NOT NULL DEFAULT 0,
    due_plans INTEGER NOT NULL DEFAULT 0,
    executed_plans INTEGER NOT NULL DEFAULT 0,
    queued_jobs INTEGER NOT NULL DEFAULT 0,
    deduplicated_jobs INTEGER NOT NULL DEFAULT 0,
    rate_limited_targets INTEGER NOT NULL DEFAULT 0,
    last_tick_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduler_runtime_counters_updated_at
    ON scheduler_runtime_counters(updated_at DESC);

CREATE TABLE IF NOT EXISTS scheduler_tick_scope_totals (
    service_name TEXT NOT NULL,
    scope TEXT NOT NULL,
    total_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (service_name, scope)
);
