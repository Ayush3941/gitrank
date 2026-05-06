ALTER TABLE github_sync_runs
    ADD COLUMN IF NOT EXISTS subject TEXT NOT NULL DEFAULT '';

ALTER TABLE github_sync_runs
    ADD COLUMN IF NOT EXISTS requested_user_login TEXT NOT NULL DEFAULT '';

ALTER TABLE github_sync_runs
    ADD COLUMN IF NOT EXISTS requested_repository_full_name TEXT NOT NULL DEFAULT '';

ALTER TABLE github_sync_runs
    ADD COLUMN IF NOT EXISTS requested_by_subject TEXT NOT NULL DEFAULT '';

ALTER TABLE github_sync_runs
    ADD COLUMN IF NOT EXISTS requested_by_github_login TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_sync_runs_requested_user_started
    ON github_sync_runs(requested_user_login, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_runs_requested_repo_started
    ON github_sync_runs(requested_repository_full_name, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_runs_requested_by_subject_started
    ON github_sync_runs(requested_by_subject, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_runs_requested_by_login_started
    ON github_sync_runs(requested_by_github_login, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_runs_correlation_started
    ON github_sync_runs(correlation_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_runs_delivery
    ON github_sync_runs(github_delivery_id);
