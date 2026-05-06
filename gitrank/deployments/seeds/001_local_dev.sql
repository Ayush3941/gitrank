-- Local development seed data only.
-- Apply through scripts/seed_local_dev.sh or `make seed-local`.

INSERT INTO users (
    id,
    display_name,
    public_handle,
    avatar_url,
    bio,
    status,
    profile_visibility
) VALUES (
    '11111111-1111-1111-1111-111111111111',
    'Local Dev',
    'local-dev',
    'https://avatars.githubusercontent.com/u/583231?v=4',
    'Seeded local development profile for GitRank.',
    'active',
    'public'
)
ON CONFLICT (id) DO UPDATE
SET display_name = EXCLUDED.display_name,
    public_handle = EXCLUDED.public_handle,
    avatar_url = EXCLUDED.avatar_url,
    bio = EXCLUDED.bio,
    status = EXCLUDED.status,
    profile_visibility = EXCLUDED.profile_visibility,
    updated_at = NOW();

INSERT INTO github_accounts (
    id,
    user_id,
    github_user_id,
    login,
    node_id,
    access_mode,
    oauth_scopes,
    installation_count,
    email,
    avatar_url,
    display_name,
    user_type,
    site_admin,
    linked_at,
    link_status,
    created_at,
    updated_at
) VALUES (
    '22222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    583231,
    'octocat',
    'MDQ6VXNlcjU4MzIzMQ==',
    'oauth',
    ARRAY['read:user','user:email']::text[],
    0,
    'octocat@seed.local',
    'https://avatars.githubusercontent.com/u/583231?v=4',
    'The Octocat',
    'User',
    FALSE,
    NOW() - INTERVAL '30 days',
    'linked',
    NOW() - INTERVAL '30 days',
    NOW()
)
ON CONFLICT (github_user_id) DO UPDATE
SET user_id = EXCLUDED.user_id,
    login = EXCLUDED.login,
    oauth_scopes = EXCLUDED.oauth_scopes,
    email = EXCLUDED.email,
    avatar_url = EXCLUDED.avatar_url,
    display_name = EXCLUDED.display_name,
    user_type = EXCLUDED.user_type,
    link_status = EXCLUDED.link_status,
    updated_at = NOW();

INSERT INTO repositories (
    id,
    github_repository_id,
    owner_login,
    name,
    full_name,
    is_private,
    is_fork,
    primary_language,
    default_branch,
    stars_count,
    forks_count,
    open_issues_count,
    archived,
    disabled,
    metadata_jsonb,
    synced_at
) VALUES (
    '33333333-3333-3333-3333-333333333333',
    900000001,
    'octo',
    'seeded-repo',
    'octo/seeded-repo',
    FALSE,
    FALSE,
    'Go',
    'main',
    420,
    37,
    12,
    FALSE,
    FALSE,
    '{"seeded":true,"kind":"local-development"}'::jsonb,
    NOW()
)
ON CONFLICT (github_repository_id) DO UPDATE
SET owner_login = EXCLUDED.owner_login,
    name = EXCLUDED.name,
    full_name = EXCLUDED.full_name,
    primary_language = EXCLUDED.primary_language,
    stars_count = EXCLUDED.stars_count,
    forks_count = EXCLUDED.forks_count,
    open_issues_count = EXCLUDED.open_issues_count,
    metadata_jsonb = EXCLUDED.metadata_jsonb,
    synced_at = NOW();

INSERT INTO pull_requests (
    id,
    github_pull_request_id,
    repository_id,
    author_github_account_id,
    number,
    title,
    state,
    draft,
    merged,
    merged_at,
    created_at_source,
    updated_at_source,
    closed_at_source,
    base_branch,
    head_branch,
    changed_files,
    additions,
    deletions,
    commits,
    payload_jsonb,
    synced_at
) VALUES (
    '44444444-4444-4444-4444-444444444444',
    900000101,
    '33333333-3333-3333-3333-333333333333',
    '22222222-2222-2222-2222-222222222222',
    17,
    'feat: add deterministic analyzer signals',
    'closed',
    FALSE,
    TRUE,
    NOW() - INTERVAL '7 days',
    NOW() - INTERVAL '9 days',
    NOW() - INTERVAL '7 days',
    NOW() - INTERVAL '7 days',
    'main',
    'feature/deterministic-signals',
    5,
    180,
    40,
    3,
    '{"seeded":true}'::jsonb,
    NOW()
)
ON CONFLICT (github_pull_request_id) DO UPDATE
SET repository_id = EXCLUDED.repository_id,
    author_github_account_id = EXCLUDED.author_github_account_id,
    title = EXCLUDED.title,
    state = EXCLUDED.state,
    merged = EXCLUDED.merged,
    merged_at = EXCLUDED.merged_at,
    changed_files = EXCLUDED.changed_files,
    additions = EXCLUDED.additions,
    deletions = EXCLUDED.deletions,
    commits = EXCLUDED.commits,
    payload_jsonb = EXCLUDED.payload_jsonb,
    synced_at = NOW();

INSERT INTO contribution_analyses (
    id,
    pull_request_id,
    analyzer_version,
    prompt_version,
    model_name,
    analysis_source,
    classification,
    confidence,
    summary,
    signals_jsonb,
    created_at
) VALUES (
    '55555555-5555-5555-5555-555555555555',
    '44444444-4444-4444-4444-444444444444',
    'deterministic.v1',
    '',
    '',
    'deterministic',
    'feature',
    0.8600,
    'Seeded feature PR touching API and auth-sensitive paths.',
    '["category=feature","languages=Go","criticality=api_surface,auth_identity"]'::jsonb,
    NOW() - INTERVAL '7 days'
)
ON CONFLICT (id) DO UPDATE
SET pull_request_id = EXCLUDED.pull_request_id,
    analyzer_version = EXCLUDED.analyzer_version,
    analysis_source = EXCLUDED.analysis_source,
    classification = EXCLUDED.classification,
    confidence = EXCLUDED.confidence,
    summary = EXCLUDED.summary,
    signals_jsonb = EXCLUDED.signals_jsonb;

INSERT INTO score_events (
    id,
    user_id,
    pull_request_id,
    analysis_id,
    score_version,
    event_type,
    delta_total_xp,
    delta_skill_jsonb,
    explanation_jsonb,
    created_at
) VALUES (
    '66666666-6666-6666-6666-666666666666',
    '11111111-1111-1111-1111-111111111111',
    '44444444-4444-4444-4444-444444444444',
    '55555555-5555-5555-5555-555555555555',
    'v1alpha1',
    'score.computed',
    148,
    '{"backend":74,"api_design":74}'::jsonb,
    '{"summary":["score version v1alpha1","merged outcome increased the result","critical path touched"]}'::jsonb,
    NOW() - INTERVAL '7 days'
)
ON CONFLICT (id) DO UPDATE
SET user_id = EXCLUDED.user_id,
    pull_request_id = EXCLUDED.pull_request_id,
    analysis_id = EXCLUDED.analysis_id,
    score_version = EXCLUDED.score_version,
    event_type = EXCLUDED.event_type,
    delta_total_xp = EXCLUDED.delta_total_xp,
    delta_skill_jsonb = EXCLUDED.delta_skill_jsonb,
    explanation_jsonb = EXCLUDED.explanation_jsonb;

INSERT INTO user_badges (
    id,
    user_id,
    badge_key,
    awarded_at,
    evidence_jsonb
) VALUES (
    '77777777-7777-7777-7777-777777777777',
    '11111111-1111-1111-1111-111111111111',
    'critical-path-contributor',
    NOW() - INTERVAL '6 days',
    '{"pull_request_id":"44444444-4444-4444-4444-444444444444","seeded":true}'::jsonb
)
ON CONFLICT (user_id, badge_key) DO UPDATE
SET awarded_at = EXCLUDED.awarded_at,
    evidence_jsonb = EXCLUDED.evidence_jsonb;

INSERT INTO user_profile_settings (
    user_id,
    show_exact_prs,
    show_ai_summaries,
    show_leaderboard_participation,
    updated_at
) VALUES (
    '11111111-1111-1111-1111-111111111111',
    TRUE,
    TRUE,
    TRUE,
    NOW()
)
ON CONFLICT (user_id) DO UPDATE
SET show_exact_prs = EXCLUDED.show_exact_prs,
    show_ai_summaries = EXCLUDED.show_ai_summaries,
    show_leaderboard_participation = EXCLUDED.show_leaderboard_participation,
    updated_at = NOW();

INSERT INTO user_repository_visibility (
    user_id,
    repository_id,
    visibility,
    reason,
    updated_at
) VALUES (
    '11111111-1111-1111-1111-111111111111',
    '33333333-3333-3333-3333-333333333333',
    'public',
    'seeded local development repository',
    NOW()
)
ON CONFLICT (user_id, repository_id) DO UPDATE
SET visibility = EXCLUDED.visibility,
    reason = EXCLUDED.reason,
    updated_at = NOW();

INSERT INTO profile_snapshots (
    id,
    user_id,
    snapshot_version,
    total_score,
    level,
    top_skills_jsonb,
    badges_jsonb,
    trend_jsonb,
    summary_jsonb,
    repositories_jsonb,
    score_history_jsonb,
    share_card_jsonb,
    refreshed_at,
    stale_after,
    source_watermark,
    created_at
) VALUES (
    '88888888-8888-8888-8888-888888888888',
    '11111111-1111-1111-1111-111111111111',
    'v1',
    148,
    'Specialist',
    '["backend","api_design"]'::jsonb,
    '[{"key":"critical-path-contributor","name":"Critical Path Contributor","description":"Touched auth or API critical paths.","awarded_at":"2026-04-29T00:00:00Z"}]'::jsonb,
    '{"window":{"label":"Last 6 weeks","bucket":"week","start_at":"2026-03-15T00:00:00Z","end_at":"2026-04-26T00:00:00Z"},"points":[{"bucket_start":"2026-04-20T00:00:00Z","bucket_end":"2026-04-26T00:00:00Z","delta_xp":148,"total_xp":148}]}'::jsonb,
    '{"strength_summary":"Appears strongest in backend and API changes based on the current seeded window.","merged_pull_requests":1,"badges_earned":1}'::jsonb,
    '[{"full_name":"octo/seeded-repo","owner":"octo","name":"seeded-repo","total_xp":148,"contribution_count":1,"merged_pull_requests":1,"primary_skill":"backend","last_contribution_at":"2026-04-26T00:00:00Z","visibility":"public"}]'::jsonb,
    '[{"event_id":"66666666-6666-6666-6666-666666666666","event_type":"score.computed","delta_xp":148,"created_at":"2026-04-26T00:00:00Z","pull_request":{"repository":"octo/seeded-repo","number":17,"title":"feat: add deterministic analyzer signals"},"explanation":["score version v1alpha1","merged outcome increased the result","critical path touched"]}]'::jsonb,
    '{"handle":"local-dev","display_name":"Local Dev","headline":"Seeded local developer profile","level":{"label":"Specialist","current_level":3,"current_xp":148,"next_level_xp":180,"rank_tier":"specialist"},"total_xp":148,"top_skills":["backend","api_design"],"badge_keys":["critical-path-contributor"],"refreshed_at":"2026-04-26T00:00:00Z"}'::jsonb,
    NOW(),
    NOW() + INTERVAL '7 days',
    NOW() - INTERVAL '7 days',
    NOW()
)
ON CONFLICT (id) DO UPDATE
SET user_id = EXCLUDED.user_id,
    snapshot_version = EXCLUDED.snapshot_version,
    total_score = EXCLUDED.total_score,
    level = EXCLUDED.level,
    top_skills_jsonb = EXCLUDED.top_skills_jsonb,
    badges_jsonb = EXCLUDED.badges_jsonb,
    trend_jsonb = EXCLUDED.trend_jsonb,
    summary_jsonb = EXCLUDED.summary_jsonb,
    repositories_jsonb = EXCLUDED.repositories_jsonb,
    score_history_jsonb = EXCLUDED.score_history_jsonb,
    share_card_jsonb = EXCLUDED.share_card_jsonb,
    refreshed_at = EXCLUDED.refreshed_at,
    stale_after = EXCLUDED.stale_after,
    source_watermark = EXCLUDED.source_watermark;
