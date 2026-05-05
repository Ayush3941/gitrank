CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    display_name TEXT NOT NULL DEFAULT '',
    public_handle TEXT UNIQUE,
    avatar_url TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    profile_visibility TEXT NOT NULL DEFAULT 'public'
);

CREATE TABLE IF NOT EXISTS github_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    github_user_id BIGINT NOT NULL UNIQUE,
    login TEXT NOT NULL,
    node_id TEXT NOT NULL DEFAULT '',
    access_mode TEXT NOT NULL DEFAULT 'oauth',
    oauth_scopes TEXT[] NOT NULL DEFAULT '{}',
    installation_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS repositories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    github_repository_id BIGINT NOT NULL UNIQUE,
    owner_login TEXT NOT NULL,
    name TEXT NOT NULL,
    full_name TEXT NOT NULL UNIQUE,
    is_private BOOLEAN NOT NULL DEFAULT FALSE,
    is_fork BOOLEAN NOT NULL DEFAULT FALSE,
    primary_language TEXT NOT NULL DEFAULT '',
    default_branch TEXT NOT NULL DEFAULT 'main',
    stars_count INTEGER NOT NULL DEFAULT 0,
    forks_count INTEGER NOT NULL DEFAULT 0,
    open_issues_count INTEGER NOT NULL DEFAULT 0,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    disabled BOOLEAN NOT NULL DEFAULT FALSE,
    metadata_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
    synced_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS pull_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    github_pull_request_id BIGINT NOT NULL UNIQUE,
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    author_github_account_id UUID REFERENCES github_accounts(id) ON DELETE SET NULL,
    number INTEGER NOT NULL,
    title TEXT NOT NULL,
    state TEXT NOT NULL,
    draft BOOLEAN NOT NULL DEFAULT FALSE,
    merged BOOLEAN NOT NULL DEFAULT FALSE,
    merged_at TIMESTAMPTZ,
    created_at_source TIMESTAMPTZ NOT NULL,
    updated_at_source TIMESTAMPTZ NOT NULL,
    closed_at_source TIMESTAMPTZ,
    base_branch TEXT NOT NULL DEFAULT '',
    head_branch TEXT NOT NULL DEFAULT '',
    changed_files INTEGER NOT NULL DEFAULT 0,
    additions INTEGER NOT NULL DEFAULT 0,
    deletions INTEGER NOT NULL DEFAULT 0,
    commits INTEGER NOT NULL DEFAULT 0,
    payload_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
    synced_at TIMESTAMPTZ,
    UNIQUE(repository_id, number)
);

CREATE TABLE IF NOT EXISTS pull_request_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    github_review_id BIGINT NOT NULL UNIQUE,
    pull_request_id UUID NOT NULL REFERENCES pull_requests(id) ON DELETE CASCADE,
    reviewer_github_account_id UUID REFERENCES github_accounts(id) ON DELETE SET NULL,
    state TEXT NOT NULL,
    submitted_at_source TIMESTAMPTZ,
    body TEXT NOT NULL DEFAULT '',
    payload_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS pull_request_review_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    github_review_comment_id BIGINT NOT NULL UNIQUE,
    pull_request_id UUID NOT NULL REFERENCES pull_requests(id) ON DELETE CASCADE,
    review_id UUID REFERENCES pull_request_reviews(id) ON DELETE SET NULL,
    author_github_account_id UUID REFERENCES github_accounts(id) ON DELETE SET NULL,
    path TEXT NOT NULL DEFAULT '',
    position INTEGER,
    body TEXT NOT NULL DEFAULT '',
    created_at_source TIMESTAMPTZ,
    payload_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS contribution_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pull_request_id UUID NOT NULL REFERENCES pull_requests(id) ON DELETE CASCADE,
    analyzer_version TEXT NOT NULL,
    prompt_version TEXT NOT NULL DEFAULT '',
    model_name TEXT NOT NULL DEFAULT '',
    analysis_source TEXT NOT NULL,
    classification TEXT NOT NULL,
    confidence NUMERIC(5,4) NOT NULL DEFAULT 0,
    summary TEXT NOT NULL DEFAULT '',
    signals_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS score_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pull_request_id UUID REFERENCES pull_requests(id) ON DELETE SET NULL,
    analysis_id UUID REFERENCES contribution_analyses(id) ON DELETE SET NULL,
    score_version TEXT NOT NULL,
    event_type TEXT NOT NULL,
    delta_total_xp INTEGER NOT NULL DEFAULT 0,
    delta_skill_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
    explanation_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_key TEXT NOT NULL,
    awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    evidence_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE(user_id, badge_key)
);

CREATE TABLE IF NOT EXISTS profile_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    snapshot_version TEXT NOT NULL,
    total_score INTEGER NOT NULL DEFAULT 0,
    level TEXT NOT NULL DEFAULT 'Explorer',
    top_skills_jsonb JSONB NOT NULL DEFAULT '[]'::jsonb,
    badges_jsonb JSONB NOT NULL DEFAULT '[]'::jsonb,
    trend_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sync_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type TEXT NOT NULL,
    status TEXT NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    repository_id UUID REFERENCES repositories(id) ON DELETE SET NULL,
    github_delivery_id TEXT NOT NULL DEFAULT '',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT NOT NULL DEFAULT '',
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    payload_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_type TEXT NOT NULL,
    actor_id TEXT NOT NULL DEFAULT '',
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL DEFAULT '',
    metadata_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_repositories_full_name ON repositories(full_name);
CREATE INDEX IF NOT EXISTS idx_pull_requests_repo_number ON pull_requests(repository_id, number);
CREATE INDEX IF NOT EXISTS idx_pull_requests_author_merged ON pull_requests(author_github_account_id, merged_at);
CREATE INDEX IF NOT EXISTS idx_reviews_pull_request ON pull_request_reviews(pull_request_id);
CREATE INDEX IF NOT EXISTS idx_review_comments_pull_request ON pull_request_review_comments(pull_request_id);
CREATE INDEX IF NOT EXISTS idx_analyses_pull_request_created ON contribution_analyses(pull_request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_score_events_user_created ON score_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_snapshots_user_created ON profile_snapshots(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status_scheduled ON sync_jobs(status, scheduled_at);
