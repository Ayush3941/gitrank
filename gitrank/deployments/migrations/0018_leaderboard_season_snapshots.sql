CREATE TABLE IF NOT EXISTS leaderboard_seasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_key TEXT NOT NULL UNIQUE,
    season_type TEXT NOT NULL DEFAULT 'weekly'
        CHECK (season_type IN ('weekly', 'monthly', 'all_time')),
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'closed')),
    snapshot_version TEXT NOT NULL,
    score_version TEXT NOT NULL DEFAULT '',
    window_start_at TIMESTAMPTZ NOT NULL,
    window_end_at TIMESTAMPTZ NOT NULL,
    source_watermark TIMESTAMPTZ NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    entry_count INTEGER NOT NULL DEFAULT 0 CHECK (entry_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT leaderboard_seasons_key_not_empty
        CHECK (btrim(season_key) <> ''),
    CONSTRAINT leaderboard_seasons_snapshot_version_not_empty
        CHECK (btrim(snapshot_version) <> ''),
    CONSTRAINT leaderboard_seasons_window_valid
        CHECK (window_end_at > window_start_at)
);

CREATE TABLE IF NOT EXISTS leaderboard_rank_movement_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id UUID NOT NULL REFERENCES leaderboard_seasons(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    profile_snapshot_id UUID NOT NULL REFERENCES profile_snapshots(id) ON DELETE CASCADE,
    event_key TEXT NOT NULL UNIQUE,
    previous_rank INTEGER CHECK (previous_rank IS NULL OR previous_rank > 0),
    current_rank INTEGER NOT NULL CHECK (current_rank > 0),
    movement_delta INTEGER NOT NULL DEFAULT 0,
    previous_total_xp INTEGER CHECK (previous_total_xp IS NULL OR previous_total_xp >= 0),
    current_total_xp INTEGER NOT NULL CHECK (current_total_xp >= 0),
    score_version TEXT NOT NULL DEFAULT '',
    evidence_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT leaderboard_rank_movement_event_key_not_empty
        CHECK (btrim(event_key) <> ''),
    CONSTRAINT leaderboard_rank_movement_evidence_object
        CHECK (jsonb_typeof(evidence_jsonb) = 'object')
);

CREATE TABLE IF NOT EXISTS leaderboard_season_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id UUID NOT NULL REFERENCES leaderboard_seasons(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    profile_snapshot_id UUID NOT NULL REFERENCES profile_snapshots(id) ON DELETE CASCADE,
    rank_movement_event_id UUID REFERENCES leaderboard_rank_movement_events(id) ON DELETE SET NULL,
    rank INTEGER NOT NULL CHECK (rank > 0),
    rank_tier TEXT NOT NULL DEFAULT 'Bronze I',
    total_xp INTEGER NOT NULL DEFAULT 0 CHECK (total_xp >= 0),
    weekly_xp INTEGER NOT NULL DEFAULT 0,
    movement INTEGER NOT NULL DEFAULT 0,
    focus TEXT NOT NULL DEFAULT '',
    score_version TEXT NOT NULL DEFAULT '',
    profile_snapshot_version TEXT NOT NULL,
    source_watermark TIMESTAMPTZ NOT NULL,
    refreshed_at TIMESTAMPTZ NOT NULL,
    stale_after TIMESTAMPTZ NOT NULL,
    snapshot_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (season_id, user_id),
    CONSTRAINT leaderboard_season_snapshots_profile_version_not_empty
        CHECK (btrim(profile_snapshot_version) <> ''),
    CONSTRAINT leaderboard_season_snapshots_snapshot_object
        CHECK (jsonb_typeof(snapshot_jsonb) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_seasons_current
    ON leaderboard_seasons(season_type, status, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_leaderboard_season_snapshots_rank
    ON leaderboard_season_snapshots(season_id, rank ASC, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_leaderboard_season_snapshots_profile
    ON leaderboard_season_snapshots(profile_snapshot_id);

CREATE INDEX IF NOT EXISTS idx_leaderboard_rank_movement_user_created
    ON leaderboard_rank_movement_events(user_id, created_at DESC);
