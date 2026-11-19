CREATE INDEX IF NOT EXISTS idx_profile_settings_updated_at
    ON user_profile_settings(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_score_events_canonical_pr
    ON score_events(pull_request_id, user_id, replay_run_id, created_at DESC, id DESC)
    WHERE event_type = 'score.computed';
