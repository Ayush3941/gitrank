CREATE TABLE IF NOT EXISTS quest_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quest_key TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('draft', 'active', 'retired')),
    cadence TEXT NOT NULL DEFAULT 'skill_based'
        CHECK (cadence IN ('one_time', 'daily', 'weekly', 'seasonal', 'skill_based')),
    goal INTEGER NOT NULL DEFAULT 1 CHECK (goal > 0),
    reward_xp INTEGER NOT NULL DEFAULT 0 CHECK (reward_xp >= 0),
    reward_badge_key TEXT NOT NULL DEFAULT '',
    weak_area_target TEXT NOT NULL DEFAULT '',
    rules_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
    starts_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (BTRIM(quest_key) <> ''),
    CHECK (BTRIM(title) <> ''),
    CHECK (expires_at IS NULL OR starts_at IS NULL OR expires_at > starts_at)
);

CREATE TABLE IF NOT EXISTS user_quest_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_key TEXT NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quest_definition_id UUID NOT NULL REFERENCES quest_definitions(id) ON DELETE RESTRICT,
    source_snapshot_id UUID REFERENCES profile_snapshots(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('locked', 'active', 'completed', 'expired', 'canceled')),
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0),
    goal INTEGER NOT NULL DEFAULT 1 CHECK (goal > 0),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    activated_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    source_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (BTRIM(assignment_key) <> ''),
    CHECK (progress <= goal),
    CHECK (status <> 'completed' OR completed_at IS NOT NULL),
    CHECK (expires_at IS NULL OR expires_at > assigned_at)
);

CREATE TABLE IF NOT EXISTS user_quest_progress_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_key TEXT NOT NULL UNIQUE,
    assignment_id UUID NOT NULL REFERENCES user_quest_assignments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quest_definition_id UUID NOT NULL REFERENCES quest_definitions(id) ON DELETE RESTRICT,
    pull_request_id UUID REFERENCES pull_requests(id) ON DELETE SET NULL,
    score_event_id UUID REFERENCES score_events(id) ON DELETE SET NULL,
    evidence_type TEXT NOT NULL DEFAULT 'system'
        CHECK (evidence_type IN ('system', 'sync', 'pull_request', 'score_event')),
    delta_progress INTEGER NOT NULL DEFAULT 0 CHECK (delta_progress >= 0),
    progress_after INTEGER NOT NULL DEFAULT 0 CHECK (progress_after >= 0),
    evidence_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (BTRIM(event_key) <> '')
);

CREATE TABLE IF NOT EXISTS user_quest_completion_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_key TEXT NOT NULL UNIQUE,
    assignment_id UUID NOT NULL UNIQUE REFERENCES user_quest_assignments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quest_definition_id UUID NOT NULL REFERENCES quest_definitions(id) ON DELETE RESTRICT,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reward_xp INTEGER NOT NULL DEFAULT 0 CHECK (reward_xp >= 0),
    reward_badge_key TEXT NOT NULL DEFAULT '',
    evidence_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (BTRIM(event_key) <> '')
);

CREATE TABLE IF NOT EXISTS user_quest_reward_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grant_key TEXT NOT NULL UNIQUE,
    completion_event_id UUID NOT NULL REFERENCES user_quest_completion_events(id) ON DELETE CASCADE,
    assignment_id UUID NOT NULL REFERENCES user_quest_assignments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quest_definition_id UUID NOT NULL REFERENCES quest_definitions(id) ON DELETE RESTRICT,
    reward_type TEXT NOT NULL CHECK (reward_type IN ('xp', 'badge')),
    xp_amount INTEGER NOT NULL DEFAULT 0 CHECK (xp_amount >= 0),
    badge_key TEXT NOT NULL DEFAULT '',
    score_event_id UUID REFERENCES score_events(id) ON DELETE SET NULL,
    user_badge_id UUID REFERENCES user_badges(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'applied'
        CHECK (status IN ('pending', 'applied', 'revoked')),
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    metadata_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (BTRIM(grant_key) <> ''),
    CHECK (
        (reward_type = 'xp' AND xp_amount > 0)
        OR (reward_type = 'badge' AND BTRIM(badge_key) <> '')
    ),
    CHECK (status <> 'revoked' OR revoked_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS quest_audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_key TEXT NOT NULL UNIQUE,
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    quest_definition_id UUID REFERENCES quest_definitions(id) ON DELETE SET NULL,
    assignment_id UUID REFERENCES user_quest_assignments(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    request_id TEXT NOT NULL DEFAULT '',
    metadata_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (BTRIM(event_key) <> ''),
    CHECK (BTRIM(action) <> '')
);

CREATE INDEX IF NOT EXISTS idx_quest_definitions_status_cadence
    ON quest_definitions(status, cadence, quest_key);

CREATE INDEX IF NOT EXISTS idx_user_quest_assignments_user_status
    ON user_quest_assignments(user_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_quest_assignments_definition_status
    ON user_quest_assignments(quest_definition_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_quest_progress_assignment_occurred
    ON user_quest_progress_events(assignment_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_quest_progress_score_event
    ON user_quest_progress_events(score_event_id)
    WHERE score_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_quest_completion_user_completed
    ON user_quest_completion_events(user_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_quest_rewards_user_status
    ON user_quest_reward_grants(user_id, status, granted_at DESC);

CREATE INDEX IF NOT EXISTS idx_quest_audit_events_created_action
    ON quest_audit_events(created_at DESC, action);
