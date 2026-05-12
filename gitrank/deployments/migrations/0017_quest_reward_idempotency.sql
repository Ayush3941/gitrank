CREATE UNIQUE INDEX IF NOT EXISTS idx_score_events_user_live_event_key
    ON score_events(user_id, event_key)
    WHERE replay_run_id IS NULL AND event_key <> '';

CREATE INDEX IF NOT EXISTS idx_user_quest_assignments_snapshot
    ON user_quest_assignments(source_snapshot_id, updated_at DESC)
    WHERE source_snapshot_id IS NOT NULL;
