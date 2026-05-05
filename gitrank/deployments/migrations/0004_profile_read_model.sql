ALTER TABLE users
    ADD COLUMN IF NOT EXISTS bio TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS user_profile_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    show_exact_prs BOOLEAN NOT NULL DEFAULT TRUE,
    show_ai_summaries BOOLEAN NOT NULL DEFAULT TRUE,
    show_leaderboard_participation BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_repository_visibility (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    visibility TEXT NOT NULL DEFAULT 'public',
    reason TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, repository_id)
);

ALTER TABLE profile_snapshots
    ADD COLUMN IF NOT EXISTS summary_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS repositories_jsonb JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS score_history_jsonb JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS share_card_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS stale_after TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS source_watermark TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_repository_visibility_user_updated
    ON user_repository_visibility(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_profile_snapshots_user_refreshed
    ON profile_snapshots(user_id, refreshed_at DESC);
