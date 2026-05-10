CREATE INDEX IF NOT EXISTS idx_profile_snapshots_leaderboard_latest
    ON profile_snapshots(user_id, refreshed_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_profile_snapshots_leaderboard_score
    ON profile_snapshots(total_score DESC, refreshed_at DESC, created_at DESC, user_id);

CREATE INDEX IF NOT EXISTS idx_users_public_leaderboard_handle
    ON users((LOWER(COALESCE(profile_visibility, 'public'))), public_handle)
    WHERE COALESCE(public_handle, '') <> '';
