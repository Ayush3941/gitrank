CREATE TABLE IF NOT EXISTS github_installations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    github_installation_id BIGINT NOT NULL UNIQUE,
    github_app_id BIGINT,
    app_slug TEXT NOT NULL DEFAULT '',
    account_login TEXT NOT NULL DEFAULT '',
    account_type TEXT NOT NULL DEFAULT '',
    target_type TEXT NOT NULL DEFAULT '',
    repository_selection TEXT NOT NULL DEFAULT 'all',
    permissions_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
    events TEXT[] NOT NULL DEFAULT '{}',
    suspended_at_source TIMESTAMPTZ,
    installed_at_source TIMESTAMPTZ,
    updated_at_source TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS github_installation_token_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    installation_id UUID NOT NULL REFERENCES github_installations(id) ON DELETE CASCADE,
    repository_scope_key TEXT NOT NULL DEFAULT '',
    permissions_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
    expires_at TIMESTAMPTZ NOT NULL,
    last_requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    UNIQUE(installation_id, repository_scope_key)
);

CREATE TABLE IF NOT EXISTS github_user_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    github_account_id UUID NOT NULL REFERENCES github_accounts(id) ON DELETE CASCADE,
    access_token_encrypted TEXT NOT NULL DEFAULT '',
    refresh_token_encrypted TEXT NOT NULL DEFAULT '',
    token_type TEXT NOT NULL DEFAULT 'bearer',
    scope TEXT NOT NULL DEFAULT '',
    expires_at TIMESTAMPTZ,
    refresh_token_expires_at TIMESTAMPTZ,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    UNIQUE(github_account_id)
);

CREATE TABLE IF NOT EXISTS github_installation_repositories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    installation_id UUID NOT NULL REFERENCES github_installations(id) ON DELETE CASCADE,
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    permissions_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
    selected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    removed_at TIMESTAMPTZ,
    UNIQUE(installation_id, repository_id)
);

CREATE TABLE IF NOT EXISTS github_webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    github_delivery_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    action TEXT NOT NULL DEFAULT '',
    installation_id UUID REFERENCES github_installations(id) ON DELETE SET NULL,
    repository_id UUID REFERENCES repositories(id) ON DELETE SET NULL,
    repository_full_name TEXT NOT NULL DEFAULT '',
    signature_sha256 TEXT NOT NULL DEFAULT '',
    payload_sha256 TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'received',
    redelivery BOOLEAN NOT NULL DEFAULT FALSE,
    first_received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_error TEXT NOT NULL DEFAULT '',
    payload_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS github_http_cache (
    cache_key TEXT PRIMARY KEY,
    etag TEXT NOT NULL DEFAULT '',
    last_modified TEXT NOT NULL DEFAULT '',
    response_hash TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS github_rate_limit_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credential_kind TEXT NOT NULL,
    credential_subject TEXT NOT NULL,
    resource TEXT NOT NULL DEFAULT '',
    limit_value INTEGER NOT NULL DEFAULT 0,
    remaining_value INTEGER NOT NULL DEFAULT 0,
    used_value INTEGER NOT NULL DEFAULT 0,
    reset_at_source TIMESTAMPTZ,
    request_id TEXT NOT NULL DEFAULT '',
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS github_sync_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_job_id UUID REFERENCES sync_jobs(id) ON DELETE SET NULL,
    run_type TEXT NOT NULL,
    status TEXT NOT NULL,
    installation_id UUID REFERENCES github_installations(id) ON DELETE SET NULL,
    repository_id UUID REFERENCES repositories(id) ON DELETE SET NULL,
    github_delivery_id TEXT NOT NULL DEFAULT '',
    correlation_id TEXT NOT NULL DEFAULT '',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    last_error TEXT NOT NULL DEFAULT '',
    metrics_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS github_sync_cursors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope_type TEXT NOT NULL,
    scope_id TEXT NOT NULL,
    resource_name TEXT NOT NULL,
    cursor_value TEXT NOT NULL DEFAULT '',
    etag TEXT NOT NULL DEFAULT '',
    last_modified TEXT NOT NULL DEFAULT '',
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(scope_type, scope_id, resource_name)
);

CREATE TABLE IF NOT EXISTS repository_labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    github_label_id BIGINT NOT NULL UNIQUE,
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at_source TIMESTAMPTZ,
    payload_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS repository_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    github_issue_id BIGINT NOT NULL UNIQUE,
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    author_github_account_id UUID REFERENCES github_accounts(id) ON DELETE SET NULL,
    number INTEGER NOT NULL,
    title TEXT NOT NULL,
    state TEXT NOT NULL,
    locked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at_source TIMESTAMPTZ NOT NULL,
    updated_at_source TIMESTAMPTZ NOT NULL,
    closed_at_source TIMESTAMPTZ,
    payload_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
    synced_at TIMESTAMPTZ,
    UNIQUE(repository_id, number)
);

CREATE TABLE IF NOT EXISTS repository_issue_labels (
    issue_id UUID NOT NULL REFERENCES repository_issues(id) ON DELETE CASCADE,
    label_id UUID NOT NULL REFERENCES repository_labels(id) ON DELETE CASCADE,
    PRIMARY KEY(issue_id, label_id)
);

CREATE TABLE IF NOT EXISTS pull_request_labels (
    pull_request_id UUID NOT NULL REFERENCES pull_requests(id) ON DELETE CASCADE,
    label_id UUID NOT NULL REFERENCES repository_labels(id) ON DELETE CASCADE,
    PRIMARY KEY(pull_request_id, label_id)
);

CREATE TABLE IF NOT EXISTS repository_commits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    sha TEXT NOT NULL,
    author_github_account_id UUID REFERENCES github_accounts(id) ON DELETE SET NULL,
    committer_github_account_id UUID REFERENCES github_accounts(id) ON DELETE SET NULL,
    authored_at_source TIMESTAMPTZ,
    committed_at_source TIMESTAMPTZ,
    message TEXT NOT NULL DEFAULT '',
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    additions INTEGER NOT NULL DEFAULT 0,
    deletions INTEGER NOT NULL DEFAULT 0,
    changed_files INTEGER NOT NULL DEFAULT 0,
    payload_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
    synced_at TIMESTAMPTZ,
    UNIQUE(repository_id, sha)
);

CREATE TABLE IF NOT EXISTS pull_request_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pull_request_id UUID NOT NULL REFERENCES pull_requests(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    previous_path TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT '',
    additions INTEGER NOT NULL DEFAULT 0,
    deletions INTEGER NOT NULL DEFAULT 0,
    changes INTEGER NOT NULL DEFAULT 0,
    patch TEXT NOT NULL DEFAULT '',
    blob_url TEXT NOT NULL DEFAULT '',
    raw_url TEXT NOT NULL DEFAULT '',
    payload_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE(pull_request_id, path)
);

CREATE TABLE IF NOT EXISTS pull_request_commits (
    pull_request_id UUID NOT NULL REFERENCES pull_requests(id) ON DELETE CASCADE,
    commit_id UUID NOT NULL REFERENCES repository_commits(id) ON DELETE CASCADE,
    PRIMARY KEY(pull_request_id, commit_id)
);

CREATE TABLE IF NOT EXISTS job_dead_letters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_job_id UUID NOT NULL REFERENCES sync_jobs(id) ON DELETE CASCADE,
    queue_name TEXT NOT NULL,
    job_type TEXT NOT NULL,
    github_delivery_id TEXT NOT NULL DEFAULT '',
    correlation_id TEXT NOT NULL DEFAULT '',
    installation_id UUID REFERENCES github_installations(id) ON DELETE SET NULL,
    repository_id UUID REFERENCES repositories(id) ON DELETE SET NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT NOT NULL DEFAULT '',
    payload_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sync_jobs
    ADD COLUMN IF NOT EXISTS queue_name TEXT NOT NULL DEFAULT 'github-sync',
    ADD COLUMN IF NOT EXISTS correlation_id TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS dedupe_key TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS installation_id UUID REFERENCES github_installations(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS not_before TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 10,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS dead_lettered_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_installation_repositories_installation ON github_installation_repositories(installation_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status_received ON github_webhook_deliveries(status, last_received_at DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limit_snapshots_subject_recorded ON github_rate_limit_snapshots(credential_kind, credential_subject, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_runs_status_started ON github_sync_runs(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_cursors_scope_resource ON github_sync_cursors(scope_type, scope_id, resource_name);
CREATE INDEX IF NOT EXISTS idx_repository_issues_repo_number ON repository_issues(repository_id, number);
CREATE INDEX IF NOT EXISTS idx_repository_commits_repo_sha ON repository_commits(repository_id, sha);
CREATE INDEX IF NOT EXISTS idx_pull_request_files_pull_request ON pull_request_files(pull_request_id);
CREATE INDEX IF NOT EXISTS idx_job_dead_letters_queue_created ON job_dead_letters(queue_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_queue_status_not_before ON sync_jobs(queue_name, status, not_before, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_delivery ON sync_jobs(github_delivery_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_correlation ON sync_jobs(correlation_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_jobs_active_dedupe
    ON sync_jobs(queue_name, dedupe_key)
    WHERE dedupe_key <> '' AND status IN ('pending', 'leased', 'running');
