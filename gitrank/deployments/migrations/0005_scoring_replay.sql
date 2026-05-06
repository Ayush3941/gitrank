CREATE TABLE IF NOT EXISTS score_replay_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score_version TEXT NOT NULL,
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('live', 'replay', 'backfill')),
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
    source_watermark TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_count INTEGER NOT NULL DEFAULT 0 CHECK (event_count >= 0),
    aggregate_total_xp INTEGER NOT NULL DEFAULT 0,
    aggregate_skill_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE score_events
    ADD COLUMN IF NOT EXISTS replay_run_id UUID REFERENCES score_replay_runs(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS event_key TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS metadata_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS score_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    replay_run_id UUID NOT NULL UNIQUE REFERENCES score_replay_runs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score_version TEXT NOT NULL,
    total_xp INTEGER NOT NULL DEFAULT 0,
    level TEXT NOT NULL DEFAULT 'Explorer',
    rank_tier TEXT NOT NULL DEFAULT 'Bronze I',
    top_skills_jsonb JSONB NOT NULL DEFAULT '[]'::jsonb,
    badge_keys_jsonb JSONB NOT NULL DEFAULT '[]'::jsonb,
    contribution_count INTEGER NOT NULL DEFAULT 0 CHECK (contribution_count >= 0),
    suspicious_events INTEGER NOT NULL DEFAULT 0 CHECK (suspicious_events >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_score_replay_runs_user_created
    ON score_replay_runs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_score_events_replay_created
    ON score_events(replay_run_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_score_events_replay_event_key
    ON score_events(replay_run_id, event_key)
    WHERE replay_run_id IS NOT NULL AND event_key <> '';

CREATE INDEX IF NOT EXISTS idx_score_snapshots_user_created
    ON score_snapshots(user_id, created_at DESC);
