-- V2 staging seed evidence only.
-- This file intentionally does not insert score_events, score_replay_runs,
-- score_snapshots, user_badges, or profile_snapshots. The seed script must
-- create those artifacts through the real scoring and profile APIs.

\set seed_user_id 'b2000000-0000-4000-8000-000000000001'
\set seed_account_id 'b2000000-0000-4000-8000-000000000002'
\set seed_repo_id 'b2000000-0000-4000-8000-000000000003'
\set seed_pr_id 'b2000000-0000-4000-8000-000000000004'
\set seed_analysis_id 'b2000000-0000-4000-8000-000000000005'
\set seed_review_approved_id 'b2000000-0000-4000-8000-000000000006'
\set seed_review_changes_id 'b2000000-0000-4000-8000-000000000007'
\set seed_comment_id 'b2000000-0000-4000-8000-000000000008'
\set seed_file_auth_id 'b2000000-0000-4000-8000-000000000009'
\set seed_file_test_id 'b2000000-0000-4000-8000-000000000010'
\set seed_file_doc_id 'b2000000-0000-4000-8000-000000000011'

DELETE FROM profile_snapshots
WHERE user_id = :'seed_user_id'::uuid;

DELETE FROM score_replay_runs
WHERE user_id = :'seed_user_id'::uuid;

DELETE FROM user_badges
WHERE user_id = :'seed_user_id'::uuid;

INSERT INTO users (
    id,
    display_name,
    public_handle,
    avatar_url,
    bio,
    status,
    profile_visibility
) VALUES (
    :'seed_user_id'::uuid,
    'V2 Staging Maintainer',
    'v2-staging',
    'https://avatars.githubusercontent.com/u/583231?v=4',
    'Synthetic staging identity backed by persisted GitHub-like evidence.',
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
    :'seed_account_id'::uuid,
    :'seed_user_id'::uuid,
    9900000001,
    'v2-contributor',
    'U_v2_staging_contributor',
    'oauth',
    ARRAY['read:user','user:email']::text[],
    0,
    'v2-contributor@seed.invalid',
    'https://avatars.githubusercontent.com/u/583231?v=4',
    'V2 Contributor',
    'User',
    FALSE,
    NOW() - INTERVAL '14 days',
    'linked',
    NOW() - INTERVAL '14 days',
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
    :'seed_repo_id'::uuid,
    9900001001,
    'v2-staging',
    'realtime-evidence',
    'v2-staging/realtime-evidence',
    FALSE,
    FALSE,
    'Go',
    'main',
    980,
    63,
    9,
    FALSE,
    FALSE,
    '{"seed":"v2-staging","source":"synthetic-github-evidence"}'::jsonb,
    NOW()
)
ON CONFLICT (github_repository_id) DO UPDATE
SET owner_login = EXCLUDED.owner_login,
    name = EXCLUDED.name,
    full_name = EXCLUDED.full_name,
    is_private = EXCLUDED.is_private,
    is_fork = EXCLUDED.is_fork,
    primary_language = EXCLUDED.primary_language,
    default_branch = EXCLUDED.default_branch,
    stars_count = EXCLUDED.stars_count,
    forks_count = EXCLUDED.forks_count,
    open_issues_count = EXCLUDED.open_issues_count,
    archived = EXCLUDED.archived,
    disabled = EXCLUDED.disabled,
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
    :'seed_pr_id'::uuid,
    9900002001,
    :'seed_repo_id'::uuid,
    :'seed_account_id'::uuid,
    42,
    'feat: replace preview scoring path with persisted evidence',
    'closed',
    FALSE,
    TRUE,
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '3 days',
    'main',
    'feat/v2-real-evidence',
    3,
    214,
    48,
    4,
    jsonb_build_object(
        'seed', 'v2-staging',
        'body', 'Replaces preview-only scoring with persisted evidence, route coverage, and auth-sensitive tests. Closes #42.',
        'user', jsonb_build_object('login', 'v2-contributor'),
        'merged_by', jsonb_build_object('login', 'v2-maintainer')
    ),
    NOW()
)
ON CONFLICT (github_pull_request_id) DO UPDATE
SET repository_id = EXCLUDED.repository_id,
    author_github_account_id = EXCLUDED.author_github_account_id,
    title = EXCLUDED.title,
    state = EXCLUDED.state,
    draft = EXCLUDED.draft,
    merged = EXCLUDED.merged,
    merged_at = EXCLUDED.merged_at,
    created_at_source = EXCLUDED.created_at_source,
    updated_at_source = EXCLUDED.updated_at_source,
    closed_at_source = EXCLUDED.closed_at_source,
    base_branch = EXCLUDED.base_branch,
    head_branch = EXCLUDED.head_branch,
    changed_files = EXCLUDED.changed_files,
    additions = EXCLUDED.additions,
    deletions = EXCLUDED.deletions,
    commits = EXCLUDED.commits,
    payload_jsonb = EXCLUDED.payload_jsonb,
    synced_at = NOW();

INSERT INTO pull_request_files (
    id,
    pull_request_id,
    path,
    status,
    additions,
    deletions,
    changes,
    patch,
    blob_url,
    raw_url,
    payload_jsonb,
    feature_jsonb
) VALUES
(
    :'seed_file_auth_id'::uuid,
    :'seed_pr_id'::uuid,
    'services/auth-service/internal/httpapi/session_rotation.go',
    'modified',
    126,
    19,
    145,
    '@@ bounded public diff excerpt for auth session rotation @@',
    'https://github.com/v2-staging/realtime-evidence/blob/main/services/auth-service/internal/httpapi/session_rotation.go',
    '',
    '{"seed":"v2-staging"}'::jsonb,
    '{"file_type":"source","language":"Go","bounded_patch":true,"criticality":["auth_identity","api_surface"]}'::jsonb
),
(
    :'seed_file_test_id'::uuid,
    :'seed_pr_id'::uuid,
    'services/auth-service/internal/httpapi/session_rotation_test.go',
    'added',
    73,
    0,
    73,
    '@@ bounded public diff excerpt for session fixation regression tests @@',
    'https://github.com/v2-staging/realtime-evidence/blob/main/services/auth-service/internal/httpapi/session_rotation_test.go',
    '',
    '{"seed":"v2-staging"}'::jsonb,
    '{"file_type":"test","language":"Go","bounded_patch":true,"criticality":["auth_identity"]}'::jsonb
),
(
    :'seed_file_doc_id'::uuid,
    :'seed_pr_id'::uuid,
    'docs/runbooks/session-rotation.md',
    'added',
    15,
    0,
    15,
    '@@ bounded public diff excerpt for operator runbook @@',
    'https://github.com/v2-staging/realtime-evidence/blob/main/docs/runbooks/session-rotation.md',
    '',
    '{"seed":"v2-staging"}'::jsonb,
    '{"file_type":"documentation","language":"Markdown","bounded_patch":true,"criticality":["security_sensitive"]}'::jsonb
)
ON CONFLICT (pull_request_id, path) DO UPDATE
SET status = EXCLUDED.status,
    additions = EXCLUDED.additions,
    deletions = EXCLUDED.deletions,
    changes = EXCLUDED.changes,
    patch = EXCLUDED.patch,
    blob_url = EXCLUDED.blob_url,
    raw_url = EXCLUDED.raw_url,
    payload_jsonb = EXCLUDED.payload_jsonb,
    feature_jsonb = EXCLUDED.feature_jsonb;

INSERT INTO pull_request_reviews (
    id,
    github_review_id,
    pull_request_id,
    reviewer_github_account_id,
    state,
    submitted_at_source,
    body,
    payload_jsonb
) VALUES
(
    :'seed_review_changes_id'::uuid,
    9900003001,
    :'seed_pr_id'::uuid,
    NULL,
    'CHANGES_REQUESTED',
    NOW() - INTERVAL '4 days',
    'Please add regression coverage for session fixation.',
    '{"author_association":"MEMBER","seed":"v2-staging"}'::jsonb
),
(
    :'seed_review_approved_id'::uuid,
    9900003002,
    :'seed_pr_id'::uuid,
    NULL,
    'APPROVED',
    NOW() - INTERVAL '3 days',
    'Coverage and runbook look good.',
    '{"author_association":"MEMBER","seed":"v2-staging"}'::jsonb
)
ON CONFLICT (github_review_id) DO UPDATE
SET pull_request_id = EXCLUDED.pull_request_id,
    reviewer_github_account_id = EXCLUDED.reviewer_github_account_id,
    state = EXCLUDED.state,
    submitted_at_source = EXCLUDED.submitted_at_source,
    body = EXCLUDED.body,
    payload_jsonb = EXCLUDED.payload_jsonb;

INSERT INTO pull_request_review_comments (
    id,
    github_review_comment_id,
    pull_request_id,
    review_id,
    author_github_account_id,
    path,
    position,
    body,
    created_at_source,
    payload_jsonb
) VALUES (
    :'seed_comment_id'::uuid,
    9900004001,
    :'seed_pr_id'::uuid,
    :'seed_review_changes_id'::uuid,
    NULL,
    'services/auth-service/internal/httpapi/session_rotation.go',
    27,
    'This branch needs a replay-safe session rotation assertion.',
    NOW() - INTERVAL '4 days',
    '{"seed":"v2-staging"}'::jsonb
)
ON CONFLICT (github_review_comment_id) DO UPDATE
SET pull_request_id = EXCLUDED.pull_request_id,
    review_id = EXCLUDED.review_id,
    author_github_account_id = EXCLUDED.author_github_account_id,
    path = EXCLUDED.path,
    position = EXCLUDED.position,
    body = EXCLUDED.body,
    created_at_source = EXCLUDED.created_at_source,
    payload_jsonb = EXCLUDED.payload_jsonb;

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
    :'seed_analysis_id'::uuid,
    :'seed_pr_id'::uuid,
    'deterministic.v2-staging',
    '',
    '',
    'deterministic',
    'security',
    0.9100,
    'Synthetic V2 seed PR with auth-sensitive source changes, regression tests, docs, and maintainer review.',
    '["category=security","languages=Go,Markdown","criticality=auth_identity,api_surface,security_sensitive","seed=v2-staging"]'::jsonb,
    NOW() - INTERVAL '3 days'
)
ON CONFLICT (id) DO UPDATE
SET pull_request_id = EXCLUDED.pull_request_id,
    analyzer_version = EXCLUDED.analyzer_version,
    prompt_version = EXCLUDED.prompt_version,
    model_name = EXCLUDED.model_name,
    analysis_source = EXCLUDED.analysis_source,
    classification = EXCLUDED.classification,
    confidence = EXCLUDED.confidence,
    summary = EXCLUDED.summary,
    signals_jsonb = EXCLUDED.signals_jsonb,
    created_at = EXCLUDED.created_at;

INSERT INTO user_profile_settings (
    user_id,
    show_exact_prs,
    show_ai_summaries,
    show_leaderboard_participation,
    reduced_gamification,
    updated_at
) VALUES (
    :'seed_user_id'::uuid,
    TRUE,
    TRUE,
    TRUE,
    FALSE,
    NOW()
)
ON CONFLICT (user_id) DO UPDATE
SET show_exact_prs = EXCLUDED.show_exact_prs,
    show_ai_summaries = EXCLUDED.show_ai_summaries,
    show_leaderboard_participation = EXCLUDED.show_leaderboard_participation,
    reduced_gamification = EXCLUDED.reduced_gamification,
    updated_at = NOW();

INSERT INTO user_repository_visibility (
    user_id,
    repository_id,
    visibility,
    reason,
    updated_at
) VALUES (
    :'seed_user_id'::uuid,
    :'seed_repo_id'::uuid,
    'public',
    'V2 staging evidence repository',
    NOW()
)
ON CONFLICT (user_id, repository_id) DO UPDATE
SET visibility = EXCLUDED.visibility,
    reason = EXCLUDED.reason,
    updated_at = NOW();
