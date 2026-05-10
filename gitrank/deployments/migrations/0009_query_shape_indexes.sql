CREATE INDEX IF NOT EXISTS idx_users_public_handle_lower
    ON users ((LOWER(COALESCE(public_handle, ''))))
    WHERE COALESCE(public_handle, '') <> '';

CREATE INDEX IF NOT EXISTS idx_github_accounts_user_linked_at
    ON github_accounts(user_id, linked_at DESC)
    WHERE link_status = 'linked';

CREATE INDEX IF NOT EXISTS idx_score_replay_runs_user_completed_created
    ON score_replay_runs(user_id, created_at DESC)
    WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS idx_score_events_user_version_created
    ON score_events(user_id, score_version, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_badges_user_awarded
    ON user_badges(user_id, awarded_at DESC);

CREATE INDEX IF NOT EXISTS idx_pull_request_reviews_pr_submitted
    ON pull_request_reviews(pull_request_id, submitted_at_source, id);

CREATE INDEX IF NOT EXISTS idx_pull_requests_author_timeline
    ON pull_requests (
        author_github_account_id,
        (COALESCE(merged_at, closed_at_source, updated_at_source, created_at_source)),
        number
    );

CREATE INDEX IF NOT EXISTS idx_installation_repositories_active_selected
    ON github_installation_repositories(installation_id, selected_at DESC, repository_id)
    WHERE removed_at IS NULL;
