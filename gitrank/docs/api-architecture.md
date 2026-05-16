# API Architecture

This document describes the current external and internal API surface for GitRank as implemented in the repository today.

V1 production policy note:

- GitHub OAuth is the required auth path
- GitHub App installation auth remains optional and is currently used only for installation-scoped ingestion in the V2 path

## External APIs

### GitHub OAuth

Used by:

- `auth-service`

Purpose:

- browser redirect for sign-in
- OAuth code exchange
- GitHub user access token refresh

Config:

- `GITHUB_OAUTH_AUTHORIZE_URL`
- `GITHUB_OAUTH_EXCHANGE_URL`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_OAUTH_REDIRECT_URL`

Requested scopes in v1:

- `read:user`
- `user:email`

### GitHub App Installation Flow

Used by:

- `auth-service`
- `github-ingestor`

Status:

- optional in v1, actively used by the V2 installation-sync path when App credentials are configured

Purpose:

- install the GitHub App on repositories or organizations

Config:

- `GITHUB_APP_INSTALL_URL`
- `GITHUB_APP_SLUG`

### GitHub REST API

Used by:

- `github-ingestor`
- `auth-service` for identity lookups
- `api-gateway` as a documented upstream dependency only

Config:

- `GITHUB_API_BASE_URL`
- `GITHUB_REQUEST_TIMEOUT`
- `GITHUB_MAX_PAGE_SIZE`
- `GITHUB_REPOSITORY_CACHE_TTL`

### GitHub GraphQL API

Used by:

- `github-ingestor`

Config:

- `GITHUB_GRAPHQL_URL`
- `GITHUB_REQUEST_TIMEOUT`
- `GITHUB_GRAPHQL_PAGE_SIZE`

Usage rules:

- prefer REST for straightforward resource sync and webhook-driven fetches
- use GraphQL only where it materially reduces round-trips for public data hydration

### GitHub Webhooks

Used by:

- `github-ingestor`

Config:

- `GITHUB_WEBHOOK_SECRET`

Current contract:

- receiver path: `POST /webhooks/github`
- signature header: `X-Hub-Signature-256`
- delivery ID header: `X-GitHub-Delivery`
- event type header: `X-GitHub-Event`
- duplicate deliveries are deduplicated by GitHub delivery ID

### Gemini OpenAI-Compatible API

Used by:

- `pr-analyzer` as the future AI-enrichment boundary

Config:

- `GEMINI_BASE_URL`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `AI_REQUEST_TIMEOUT`
- `AI_PR_MAX_CHANGED_FILES`
- `AI_PR_MAX_FILE_RECORDS`
- `AI_PR_MAX_DIFF_LINES`
- `AI_PR_MAX_INPUT_CHARS`
- `AI_PR_MAX_ESTIMATED_TOKENS`
- `AI_PR_MAX_ESTIMATED_COST_USD`
- `AI_ESTIMATED_INPUT_TOKEN_COST_USD`

The analyzer enforces these hard limits before analysis so deterministic and future AI-assisted paths cannot silently process oversized PR input or exceed configured token/cost budgets.

## Internal Service APIs

### API Gateway

Base URL:

- `GITRANK_API_BASE_URL`

Implemented routes:

- `GET /healthz`
- `GET /readyz`
- `GET /metrics`
- `GET /v1/meta/manifest`
- `GET /v1/meta/dependencies`
- `POST /v1/sync`
- `POST /v1/sync/installation/execute`
- `POST /v1/sync/repository/execute`
- `GET /v1/me/profile`
- `PATCH /v1/me/profile`
- `PATCH /v1/me/profile/repositories/{owner}/{repo}`
- `POST /v1/me/account/unlink`
- `POST /v1/me/account/delete`
- `GET /v1/leaderboard`
- `GET /v1/users/{handle}`
- `GET /v1/users/{handle}/card`

Gateway behavior:

- injects `X-Request-ID`
- applies structured access logging and panic recovery
- enforces CORS for the configured public origin
- rate limits public reads, private reads, and state-changing routes separately
- verifies the browser session by calling `auth-service /v1/session/me`
- rotates downstream cookies if `auth-service` rotates the session
- forwards downstream session-clearing `Set-Cookie` headers from `auth-service`
- requires `X-CSRF-Token` on state-changing browser routes
- returns short-lived public caching headers for public profiles and leaderboard reads
- returns `Cache-Control: private, no-store` for authenticated profile, sync, and account-action routes

### Auth Service

Base URL:

- `AUTH_SERVICE_BASE_URL`

Implemented routes:

- `GET /healthz`
- `GET /readyz`
- `GET /metrics`
- `GET /v1/meta/manifest`
- `GET /oauth/github/install`
- `GET /oauth/github/start`
- `GET /oauth/github/callback`
- `POST /v1/account/link/start`
- `POST /v1/account/unlink`
- `POST /v1/account/delete`
- `GET /v1/session/me`
- `POST /v1/session/refresh`
- `POST /v1/session/logout`

Auth behavior:

- issues cookie-based browser sessions
- rotates sessions on inspection and refresh
- uses double-submit CSRF tokens for state-changing routes
- supports GitHub account linking, unlinking, and self-service account deletion
- encrypts GitHub user tokens at rest

### GitHub Ingestor

Base URL:

- `GITHUB_INGESTOR_BASE_URL`

Implemented routes:

- `GET /healthz`
- `GET /readyz`
- `GET /metrics`
- `GET /v1/meta/manifest`
- `POST /webhooks/github`
- `POST /v1/webhooks/github/deliveries/{delivery_id}/requeue`
- `POST /v1/sync/preview`
- `GET /v1/sync/runs`
- `POST /v1/sync/installation/execute`
- `POST /v1/sync/user/execute`
- `POST /v1/sync/repository/execute`
- `POST /v1/sync/pull-request/execute`
- `POST /v1/sync/review/execute`
- `POST /v1/sync/issue/execute`
- `POST /v1/sync/commit/execute`
- `POST /v1/sync/installation`
- `POST /v1/sync/user`
- `POST /v1/sync/repository`
- `POST /v1/sync/pull-request`
- `POST /v1/sync/review`
- `POST /v1/sync/issue`
- `POST /v1/sync/commit`

Current state:

- webhook validation, replay protection, and deduplication are implemented
- stored webhook deliveries can be manually requeued for recovery
- webhook delivery deduplication and requeue state persist in PostgreSQL when `DATABASE_URL` is configured
- webhook-driven repository, PR, review, issue, label, commit, installation, and sync-run entities persist idempotently in PostgreSQL when `DATABASE_URL` is configured
- `POST /v1/sync/installation/execute` now prefers live GitHub App installation repository inventory (`/installation/repositories`) plus installation access tokens when App credentials are configured, and falls back to persisted installation-repository associations when App auth is not configured
- `POST /v1/sync/user/execute` performs a bounded live user sync by walking recent public repositories owned by the requested GitHub login, discovering recent public PRs authored by that login through GitHub issue/PR search, and delegating concrete repositories and PRs to the repository and PR executors
- `POST /v1/sync/repository/execute` performs a bounded live repository sync through the public GitHub REST API and persists repository, pull request, review, issue, and commit data in PostgreSQL
- `POST /v1/sync/pull-request/execute` performs a bounded live pull-request sync and persists the PR, its reviews, and its review comments in PostgreSQL
- `POST /v1/sync/review/execute` performs a bounded live review sync by refreshing the review surface for one PR number and persists its reviews and review comments in PostgreSQL
- `POST /v1/sync/issue/execute` performs a bounded live issue sync and persists one standalone issue plus its labels in PostgreSQL
- `POST /v1/sync/commit/execute` performs a bounded live commit sync and persists one public commit in PostgreSQL
- manual sync requests persist queued sync-run records and can be queried through `GET /v1/sync/runs` with user, repository, subject, requester, correlation, and delivery filters
- sync requests still enqueue scheduler runtime-state jobs rather than a dedicated normalized job table
- bounded user-mode historical orchestration now covers score history, badge evidence, quests, PR reports, and leaderboard seasons through explicit scheduler modes

### PR Analyzer

Base URL:

- `PR_ANALYZER_BASE_URL`

Implemented routes:

- `GET /healthz`
- `GET /readyz`
- `GET /metrics`
- `GET /v1/meta/manifest`
- `POST /v1/analyze/pull-request`
- `POST /v1/analyze/pull-request/execute`

Current behavior:

- validates normalized PR analysis input before classification
- emits schema-versioned analysis envelopes with analyzer version, source, validation status, and deterministic fallback metadata
- enforces hallucination guardrails so future AI-assisted outputs cannot invent unsupported languages, issue links, criticality tags, flags, skills, or certainty-heavy summary phrasing
- derives detected languages, primary changed language, linked issue references, review-cycle counts, and criticality tags from normalized PR evidence
- persists deterministic analysis artifacts into `contribution_analyses` when the target repository and pull request have already been synced
- returns `analysis_id` and `pull_request_id` for persisted analysis envelopes
- ships a regression dataset for false-positive and false-negative analyzer cases under package testdata
- does not call a live AI provider yet; current output is deterministic and marked as such

### Scoring Engine

Base URL:

- `SCORING_ENGINE_BASE_URL`

Implemented routes:

- `GET /healthz`
- `GET /readyz`
- `GET /metrics`
- `GET /v1/meta/manifest`
- `POST /v1/score/contribution`
- `POST /v1/score/users/{user_id}/replay`
- `POST /v1/score/users/{user_id}/replay/verify`
- `GET /v1/score/users/{user_id}/snapshot`
- `GET /v1/score/users/{user_id}/events`

Current behavior:

- validates incoming analysis artifacts before deterministic scoring
- rejects unsupported categories, invalid AI-assisted envelope metadata, and score-override style strings in analysis hints
- remains deterministic even when future AI-assisted analysis metadata is present
- recomputes a user's score ledger from stored PR, review, file, repository, and analysis evidence
- persists immutable replay runs, score events, derived badges, and historical aggregate snapshots in PostgreSQL
- verifies score replay for a selected user, repository, date range, and supported formula version without mutating replay runs, score events, snapshots, or badge awards

### Profile Service

Base URL:

- `PROFILE_SERVICE_BASE_URL`

Implemented routes:

- `GET /healthz`
- `GET /readyz`
- `GET /metrics`
- `GET /v1/meta/manifest`
- `GET /v1/profile/schema`
- `POST /v1/profile/users/{user_id}/refresh`
- `POST /v1/profile/users/{user_id}/quests/backfill`
- `GET /v1/leaderboard`
- `POST /v1/leaderboard/materialize`
- `POST /v1/leaderboard/materialize/history`
- `GET /v1/users/{handle}`
- `GET /v1/users/{handle}/card`
- `GET /v1/me/profile`
- `PATCH /v1/me/profile`
- `PATCH /v1/me/profile/repositories/{owner}/{repo}`

Read-model behavior:

- serves snapshot-backed public and authenticated profiles
- can force a profile snapshot rebuild from persisted score events and badge evidence for scheduler-driven post-scoring refresh
- can backfill user-scoped quest assignments, completion, and reward evidence from persisted profile score history
- materializes public leaderboard rows into weekly season snapshots and rank movement events before serving rank evidence
- exposes an explicit leaderboard materialization endpoint for scheduler-driven season refresh
- exposes an explicit historical leaderboard materialization backfill endpoint for scheduler-driven weekly archive rebuilds
- exposes explicit staleness metadata
- applies privacy settings and per-repository visibility redaction
- caches public and private profile responses in Redis when configured

### Scheduler Worker

Base URL:

- `SCHEDULER_WORKER_BASE_URL`

Implemented routes:

- `GET /healthz`
- `GET /readyz`
- `GET /metrics`
- `GET /v1/meta/manifest`
- `GET /v1/jobs`
- `GET /v1/jobs/config`
- `POST /v1/jobs/sync`
- `POST /v1/jobs/tick`
- `POST /v1/jobs/lease`
- `POST /v1/jobs/run-once`
- `GET /v1/jobs/backfills`
- `POST /v1/jobs/backfills`
- `POST /v1/jobs/backfills/{plan_id}/pause`
- `POST /v1/jobs/backfills/{plan_id}/resume`
- `POST /v1/jobs/backfills/{plan_id}/cancel`
- `DELETE /v1/jobs/backfills/{plan_id}`
- `POST /v1/jobs/{job_id}/complete`
- `POST /v1/jobs/{job_id}/fail`
- `POST /v1/jobs/{job_id}/pause`
- `POST /v1/jobs/{job_id}/resume`
- `POST /v1/jobs/{job_id}/cancel`
- `GET /v1/jobs/dead-letters`
- `GET /v1/jobs/dead-letters/config`
- `POST /v1/jobs/dead-letters/{record_id}/replay`

Current state:

- in-memory queue orchestration is implemented for local and integration use
- queue jobs, dead letters, recurring backfill plans, rate-limit windows, and scheduler counters persist in dedicated PostgreSQL tables when `DATABASE_URL` is configured
- persistent mode reloads the latest scheduler state before reads and serializes leases, ticks, and control-plane mutations through the shared PostgreSQL scheduler counters row
- recurring backfill plans now retain the latest run correlation and can cancel queued or leased jobs for that run without overwriting the canceled terminal state when a worker reports completion afterward
- sync jobs are deduplicated by `dedupe_key`
- queue inspection supports filters for `user`, `repository`, `installation_id`, `status`, `type`, `subject`, and `correlation_id`
- ready jobs can be leased up to the configured worker concurrency
- the worker-mode scheduler process can execute ready `sync.installation` jobs by calling `github-ingestor /v1/sync/installation/execute`
- the worker-mode scheduler process can execute ready `sync.repository` jobs by calling `github-ingestor /v1/sync/repository/execute`
- the worker-mode scheduler process can execute ready `sync.user_history` jobs by calling `github-ingestor /v1/sync/user/execute`
- the worker-mode scheduler process can execute ready `sync.pull_request` jobs by calling `github-ingestor /v1/sync/pull-request/execute`
- the worker-mode scheduler process can execute ready `sync.review` jobs by calling `github-ingestor /v1/sync/review/execute`
- the worker-mode scheduler process can execute ready `sync.issue` jobs by calling `github-ingestor /v1/sync/issue/execute`
- the worker-mode scheduler process can execute ready `sync.commit` jobs by calling `github-ingestor /v1/sync/commit/execute`
- the worker-mode scheduler process can execute ready `analysis.pull_request` jobs by calling `pr-analyzer /v1/analyze/pull-request/execute`
- the worker-mode scheduler process can execute ready `score.replay_user` jobs by calling `scoring-engine /v1/score/users/{user_id}/replay` with a `backfill` trigger
- the worker-mode scheduler process can execute ready `profile.refresh_user` jobs by calling `profile-service /v1/profile/users/{user_id}/refresh`
- the worker-mode scheduler process can execute ready `score_history.backfill_user` jobs by chaining `score.replay_user` plus `profile.refresh_user`
- the worker-mode scheduler process can execute ready `badge.backfill_user` jobs by chaining `score.replay_user`, `quest.backfill_user`, and `profile.refresh_user`
- the worker-mode scheduler process can execute ready `quest.backfill_user` jobs by calling `profile-service /v1/profile/users/{user_id}/quests/backfill`
- the worker-mode scheduler process can execute ready `report.materialize_pull_request` jobs by calling `profile-service /v1/pr/{owner}/{repo}/{number}/report/materialize`
- the worker-mode scheduler process can execute ready `report.backfill_user_pull_requests` jobs by calling `profile-service /v1/profile/users/{user_id}/pr-reports/backfill`
- the worker-mode scheduler process can execute ready `leaderboard.materialize_season` jobs by calling `profile-service /v1/leaderboard/materialize`
- the worker-mode scheduler process can execute ready `leaderboard.backfill_history` jobs by calling `profile-service /v1/leaderboard/materialize/history?weeks=26`
- the worker-mode scheduler process can execute ready `pipeline.backfill_user_history` jobs by chaining `score.replay_user`, `profile.refresh_user`, `quest.backfill_user`, `profile.refresh_user`, `report.backfill_user_pull_requests`, and `leaderboard.materialize_season` in one user-scoped durable run
- the worker-mode scheduler process can execute ready `pipeline.grade_pull_request` jobs by chaining PR sync, persisted PR analysis, score replay, profile refresh, report materialization, and live PR-report verification for a known user and PR
- bounded installation execution now supports live GitHub App installation repository discovery and installation-token-authenticated repository sync when App credentials are configured; persisted installation repositories remain the fallback path when App auth is unavailable
- bounded user execution currently means recent public owned repositories plus recent public authored PRs discoverable through GitHub issue/PR search, not a full historical search across every contribution surface
- bounded review execution currently means "refresh the reviews and review comments for one PR number", not a review-id-specific sync
- retries apply exponential backoff before the next eligible lease
- poison jobs move into a dead-letter queue and can be manually replayed; use `docs/runbooks/dead-letter-replay.md` for stage-specific replay order and idempotency checks
- recurring cron plans can enqueue normalized sync targets on each scheduler tick
- recurring plans can be paused, resumed, canceled for their latest queued run, or deleted through the scheduler control plane
- per-user and per-installation rate limits throttle repeated sync generation
- persistent mode stores jobs, dead letters, recurring plans, rate-limit windows, and scheduler counters in dedicated PostgreSQL tables, with the legacy JSONB snapshot row kept only for compatibility import

## Browser Auth Scheme

Current browser-facing auth contract:

- session cookie: `gitrank_session`
- CSRF cookie: `gitrank_csrf`
- CSRF header: `X-CSRF-Token`

Route requirements:

- `GET /v1/me/profile` requires a valid session cookie
- `PATCH /v1/me/profile` requires a valid session cookie and matching CSRF header
- `PATCH /v1/me/profile/repositories/{owner}/{repo}` requires a valid session cookie and matching CSRF header
- `POST /v1/me/account/unlink` requires a valid session cookie and matching CSRF header
- `POST /v1/me/account/delete` requires a valid session cookie and matching CSRF header
- `POST /v1/sync` requires a valid session cookie and matching CSRF header

## Rate Limiting

Current gateway rate-limit groups:

- public profile reads
- authenticated profile reads
- authenticated state-changing routes

Headers:

- `Retry-After` is returned on `429 Too Many Requests`
- the gateway does not currently expose remaining-quota headers

## Caching Rules

Current cache policy:

- public profile reads: `Cache-Control: public, max-age=60, stale-while-revalidate=300`
- authenticated profile reads: `Cache-Control: private, no-store`
- sync trigger responses: `Cache-Control: private, no-store`

Profile-service cache behavior:

- public profile cache key includes handle, snapshot ID, privacy settings timestamp, and repository visibility timestamp
- private profile cache key includes user ID, snapshot ID, privacy settings timestamp, and repository visibility timestamp

## Sync Modes

`POST /v1/sync` accepts the following normalized modes:

- `installation`
- `user`
- `repository`
- `pull_request`
- `review`
- `issue`
- `commit`

Normalization rules:

- empty `mode` defaults to `user`
- `mode=user` defaults `user` to the authenticated GitHub login if omitted
- repository-like modes require `repository`
- numbered artifact modes require `number`
- `mode=installation` requires `installation_id`
- `mode=commit` requires `sha`

## Pagination, Filtering, and Sorting Conventions

No current `/v1` route returns a paginated collection, but future collection routes should follow these conventions:

- `page[size]` for page size
- `page[after]` and `page[before]` for cursor pagination
- `sort` for comma-separated sort keys, with `-field` for descending order
- `filter[field]=value` for exact-match filters
- time-window filters should prefer explicit ISO timestamps over relative words

## Idempotency Expectations

- `GET` routes are safe and idempotent
- `PATCH` privacy and repository-visibility routes are idempotent by final resource state
- `POST /v1/sync` is not fully idempotent today and does not accept an idempotency key
- `POST /webhooks/github` is replay-protected using GitHub delivery IDs

## Breaking Change Policy

The current compatibility bar for public routes is:

- additive optional fields are allowed within `/v1`
- enum expansions are allowed when callers are expected to ignore unknown future values safely
- field removals, required-field additions, semantic repurposing, or path renames require a new versioned route family
- docs must be updated in the same change set as the implementation

## Shared API Packages

- `packages/httpkit`: shared HTTP middleware, JSON helpers, CORS, metrics, request IDs, recovery, access logs, and server runner
- `packages/githubapi`: GitHub OAuth URL construction, webhook verification, REST and GraphQL clients, installation tokens, and OAuth token helpers
- `packages/authkit`: opaque tokens, OAuth state tokens, CSRF helpers, cookie helpers, bearer middleware, and permission checks
- `packages/contracts`: request and response DTOs, event payloads, manifests, and versioning notes
- `packages/events`: event envelopes plus publisher and subscriber interfaces

## Debugging Strategy

The current architecture favors debuggability:

- every service exposes health, readiness, manifest, and metrics routes
- service dependencies are explicit in config and manifests
- request IDs are injected at the HTTP edge
- gateway readiness checks verify critical HTTP dependencies
- auth, profile, and gateway flows use shared error envelopes
- profile responses surface snapshot freshness and stale-state metadata explicitly
