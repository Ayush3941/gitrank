ALTER TABLE user_profile_settings
    ADD COLUMN IF NOT EXISTS reduced_gamification BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_user_profile_settings_reduced_gamification
    ON user_profile_settings(user_id, updated_at DESC)
    WHERE reduced_gamification;
