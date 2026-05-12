# Data Model

This is the initial relational model direction for PostgreSQL.

## Design Rules

- Source data from GitHub should be normalized and upsert-safe by stable GitHub IDs.
- Derived analysis and scoring data should be versioned.
- Evidence tables should stay explainable and replayable.
- User-facing aggregates should be rebuildable from source and derived evidence.

## Query Shape and Index Rules

- Public profile reads load users, latest score selection, score rows, badges, repository visibility, and snapshots with bounded bulk queries rather than row-by-row repository or badge lookups.
- Scoring replay loads pull requests, latest analyses, files, and reviews in one candidate query using lateral aggregate subqueries to avoid application-level N+1 query loops.
- Migration `0009_query_shape_indexes.sql` adds indexes for the concrete profile, scoring, auth-session, sync-replay, and installation-replay access patterns used by the services.
- New service queries should either reuse these indexed shapes or add a matching migration and migration smoke assertion in the same change.

## Core Tables

### `users`

- `id` UUID primary key
- `created_at`
- `updated_at`
- `display_name`
- `public_handle`
- `avatar_url`
- `status`
- `profile_visibility`

### `github_accounts`

- `id` UUID primary key
- `user_id` foreign key
- `github_user_id` unique
- `login`
- `node_id`
- `access_mode` enum
- `oauth_scopes`
- `installation_count`
- `created_at`
- `updated_at`

### `repositories`

- `id` UUID primary key
- `github_repository_id` unique
- `owner_login`
- `name`
- `full_name`
- `is_private`
- `is_fork`
- `primary_language`
- `default_branch`
- `stars_count`
- `forks_count`
- `open_issues_count`
- `archived`
- `disabled`
- `metadata_jsonb`
- `synced_at`

### `github_installations`

- `id` UUID primary key
- `github_installation_id` unique
- `github_app_id`
- `app_slug`
- `account_login`
- `account_type`
- `target_type`
- `repository_selection`
- `permissions_jsonb`
- `events`
- `suspended_at_source`
- `installed_at_source`
- `updated_at_source`
- `created_at`
- `updated_at`

### `github_installation_repositories`

- `id` UUID primary key
- `installation_id` foreign key
- `repository_id` foreign key
- `permissions_jsonb`
- `selected_at`
- `removed_at`

### `pull_requests`

- `id` UUID primary key
- `github_pull_request_id` unique
- `repository_id` foreign key
- `author_github_account_id` nullable foreign key
- `number`
- `title`
- `state`
- `draft`
- `merged`
- `merged_at`
- `created_at_source`
- `updated_at_source`
- `closed_at_source`
- `base_branch`
- `head_branch`
- `changed_files`
- `additions`
- `deletions`
- `commits`
- `payload_jsonb`
- `synced_at`

### `pull_request_reviews`

- `id` UUID primary key
- `github_review_id` unique
- `pull_request_id` foreign key
- `reviewer_github_account_id` nullable foreign key
- `state`
- `submitted_at_source`
- `body`
- `payload_jsonb`

### `pull_request_review_comments`

- `id` UUID primary key
- `github_review_comment_id` unique
- `pull_request_id` foreign key
- `review_id` nullable foreign key
- `author_github_account_id` nullable foreign key
- `path`
- `position`
- `body`
- `created_at_source`
- `payload_jsonb`

### `repository_labels`

- `id` UUID primary key
- `github_label_id` unique
- `repository_id` foreign key
- `name`
- `color`
- `description`
- `is_default`
- `updated_at_source`
- `payload_jsonb`

### `repository_issues`

- `id` UUID primary key
- `github_issue_id` unique
- `repository_id` foreign key
- `author_github_account_id` nullable foreign key
- `number`
- `title`
- `state`
- `locked`
- `created_at_source`
- `updated_at_source`
- `closed_at_source`
- `payload_jsonb`
- `synced_at`

### `repository_issue_labels`

- `issue_id` foreign key
- `label_id` foreign key
- primary key `(issue_id, label_id)`

### `pull_request_labels`

- `pull_request_id` foreign key
- `label_id` foreign key
- primary key `(pull_request_id, label_id)`

### `repository_commits`

- `id` UUID primary key
- `repository_id` foreign key
- `sha`
- `author_github_account_id` nullable foreign key
- `committer_github_account_id` nullable foreign key
- `authored_at_source`
- `committed_at_source`
- `message`
- `verified`
- `additions`
- `deletions`
- `changed_files`
- `payload_jsonb`
- `synced_at`

### `pull_request_files`

- `id` UUID primary key
- `pull_request_id` foreign key
- `path`
- `previous_path`
- `status`
- `additions`
- `deletions`
- `changes`
- `patch`
- `blob_url`
- `raw_url`
- `payload_jsonb`

### `pull_request_commits`

- `pull_request_id` foreign key
- `commit_id` foreign key
- primary key `(pull_request_id, commit_id)`

### `contribution_analyses`

- `id` UUID primary key
- `pull_request_id` foreign key
- `analyzer_version`
- `prompt_version` nullable
- `model_name` nullable
- `analysis_source` enum
- `classification`
- `confidence`
- `summary`
- `signals_jsonb`
- `created_at`

### `score_events`

- `id` UUID primary key
- `user_id` foreign key
- `pull_request_id` nullable foreign key
- `analysis_id` nullable foreign key
- `replay_run_id` nullable foreign key
- `event_key`
- `score_version`
- `event_type`
- `delta_total_xp`
- `delta_skill_jsonb`
- `explanation_jsonb`
- `metadata_jsonb`
- `created_at`

### `score_replay_runs`

- `id` UUID primary key
- `user_id` foreign key
- `score_version`
- `trigger_type`
- `status`
- `source_watermark`
- `event_count`
- `aggregate_total_xp`
- `aggregate_skill_jsonb`
- `created_at`

### `score_snapshots`

- `id` UUID primary key
- `replay_run_id` foreign key
- `user_id` foreign key
- `score_version`
- `total_xp`
- `level`

### `pull_request_report_snapshots`

- `id` UUID primary key
- `idempotency_key` unique non-empty text key
- `pull_request_id` foreign key
- `score_event_id` nullable foreign key
- `analysis_id` nullable foreign key
- `report_version`
- `score_version`
- `analysis_version`
- `evidence_status`
- `evidence_missing_jsonb`
- `is_stale`
- `report_jsonb`
- `source_updated_at`
- `generated_at`
- `created_at`
- `updated_at`

### `scheduler_jobs`

- composite primary key `(service_name, job_id)`
- `queue_name`
- `job_type`
- `status`
- `correlation_id`
- `delivery_id`
- `installation_id`
- `repository`
- `subject`
- `dedupe_key`
- `attempt_count`
- `max_attempts`
- `scheduled_at`
- `not_before`
- `lease_expires_at`
- `last_error`
- `payload_jsonb`
- `created_at`
- `updated_at`

### `scheduler_dead_letters`

- composite primary key `(service_name, record_id)`
- `job_id`
- `queue_name`
- `job_type`
- `delivery_id`
- `correlation_id`
- `installation_id`
- `repository`
- `subject`
- `dedupe_key`
- `attempts`
- `max_attempts`
- `error_message`
- `payload_jsonb`
- `created_at`
- `replayed_at`
- `updated_at`

### `scheduler_backfill_plans`

- composite primary key `(service_name, plan_id)`
- `name`
- `cron`
- `enabled`
- `targets_jsonb`
- `last_run_at`
- `next_run_at`
- `queued_jobs_total`
- `deduplicated_total`
- `rate_limited_total`
- `created_at`
- `updated_at`
- `last_correlation_id`

### `scheduler_rate_limit_windows`

- composite primary key `(service_name, scope, scope_key)`
- `started_at`
- `hit_count`
- `updated_at`

### `scheduler_runtime_counters`

- primary key `service_name`
- `queue_retry_count`
- `queue_failure_count`
- `queue_replay_count`
- `tick_runs`
- `due_plans`
- `executed_plans`
- `queued_jobs`
- `deduplicated_jobs`
- `rate_limited_targets`
- `last_tick_at`
- `created_at`
- `updated_at`

### `scheduler_tick_scope_totals`

- composite primary key `(service_name, scope)`
- `total_count`
- `updated_at`
- `rank_tier`
- `top_skills_jsonb`
- `badge_keys_jsonb`
- `contribution_count`
- `suspicious_events`
- `created_at`

### `user_badges`

- `id` UUID primary key
- `user_id` foreign key
- `badge_key`
- `awarded_at`
- `evidence_jsonb`

### `profile_snapshots`

- `id` UUID primary key
- `user_id` foreign key
- `snapshot_version`
- `total_score`
- `level`
- `top_skills_jsonb`
- `badges_jsonb`
- `trend_jsonb`
- `created_at`

### `sync_jobs`

- `id` UUID primary key
- `job_type`
- `status`
- `user_id` nullable
- `repository_id` nullable
- `github_delivery_id` nullable
- `attempt_count`
- `last_error`
- `scheduled_at`
- `started_at`
- `finished_at`
- `payload_jsonb`

### `github_webhook_deliveries`

- `id` UUID primary key
- `github_delivery_id` unique
- `event_type`
- `action`
- `installation_id` nullable foreign key
- `github_installation_id`
- `repository_id` nullable foreign key
- `repository_full_name`
- `signature_sha256`
- `payload_sha256`
- `status`
- `redelivery`
- `first_received_at`
- `last_received_at`
- `last_error`
- `payload_jsonb`

### `github_sync_runs`

- `id` UUID primary key
- `sync_job_id` nullable foreign key
- `run_type`
- `status`
- `subject`
- `installation_id` nullable foreign key
- `repository_id` nullable foreign key
- `github_delivery_id`
- `requested_user_login`
- `requested_repository_full_name`
- `requested_by_subject`
- `requested_by_github_login`
- `correlation_id`
- `started_at`
- `finished_at`
- `last_error`
- `metrics_jsonb`

### `audit_logs`

- `id` UUID primary key
- `actor_type`
- `actor_id`
- `action`
- `target_type`
- `target_id`
- `metadata_jsonb`
- `created_at`

## Constraints

Required constraints:

- unique GitHub IDs on source tables
- unique `users.public_handle` when public
- unique `(user_id, badge_key)` if badges are non-repeatable
- unique `(pull_request_id, analyzer_version, prompt_version, model_name, analysis_source)` where desired

## Persistence Policy Notes

- GitHub entities should use stable GitHub IDs for idempotent upsert behavior.
- Source evidence and audit records are the durable truth.
- Public profiles, scores, badges, levels, and leaderboard views are recomputed aggregates or snapshots.
- Manual score overrides are not allowed in v1.
- Soft-deletion or hidden-state transitions are preferred until explicit account deletion is requested.

## Retention Guidance

- raw payload JSON should be kept only as long as needed for debugging and replay
- prompts and model outputs should have explicit retention windows
- user deletion should tombstone or remove user-owned profile data according to policy

## Indexing Direction

Likely high-value indexes:

- `repositories(full_name)`
- `pull_requests(repository_id, number)`
- `pull_requests(author_github_account_id, merged_at)`
- `pull_request_reviews(pull_request_id)`
- `contribution_analyses(pull_request_id, created_at desc)`
- `score_events(user_id, created_at desc)`
- `score_events(user_id, event_key)` for live quest reward idempotency
- `pull_request_report_snapshots(pull_request_id, generated_at desc)`
- `user_quest_assignments(source_snapshot_id, updated_at desc)`
- `profile_snapshots(user_id, created_at desc)`
- `sync_jobs(status, scheduled_at)`
