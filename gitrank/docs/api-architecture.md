# API Architecture

This document describes the current external and internal API surface for GitRank as implemented in the repository today.

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
- `GITHUB_OAUTH_TOKEN_URL`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_OAUTH_REDIRECT_URL`

### GitHub App Installation Flow

Used by:

- `auth-service`

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

### GitHub GraphQL API

Used by:

- `github-ingestor`

Config:

- `GITHUB_GRAPHQL_URL`
- `GITHUB_REQUEST_TIMEOUT`
- `GITHUB_GRAPHQL_PAGE_SIZE`

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

### OpenAI Responses API

Used by:

- `pr-analyzer` as the future AI-enrichment boundary

Config:

- `OPENAI_BASE_URL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `AI_REQUEST_TIMEOUT`

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
- `GET /v1/me/profile`
- `PATCH /v1/me/profile`
- `PATCH /v1/me/profile/repositories/{owner}/{repo}`
- `GET /v1/users/{handle}`
- `GET /v1/users/{handle}/card`

Gateway behavior:

- injects `X-Request-ID`
- applies structured access logging and panic recovery
- enforces CORS for the configured public origin
- rate limits public reads, private reads, and state-changing routes separately
- verifies the browser session by calling `auth-service /v1/session/me`
- rotates downstream cookies if `auth-service` rotates the session
- requires `X-CSRF-Token` on state-changing browser routes
- returns short-lived public caching headers for public profiles
- returns `Cache-Control: private, no-store` for authenticated profile and sync routes

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
- `GET /v1/session/me`
- `POST /v1/session/refresh`
- `POST /v1/session/logout`

Auth behavior:

- issues cookie-based browser sessions
- rotates sessions on inspection and refresh
- uses double-submit CSRF tokens for state-changing routes
- supports GitHub account linking and unlinking
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
- sync requests currently enqueue in-memory preview jobs
- persistent worker execution and normalized persistence are still pending

### PR Analyzer

Base URL:

- `PR_ANALYZER_BASE_URL`

Implemented routes:

- `GET /healthz`
- `GET /readyz`
- `GET /metrics`
- `GET /v1/meta/manifest`
- `POST /v1/analyze/pull-request`

### Scoring Engine

Base URL:

- `SCORING_ENGINE_BASE_URL`

Implemented routes:

- `GET /healthz`
- `GET /readyz`
- `GET /metrics`
- `GET /v1/meta/manifest`
- `POST /v1/score/contribution`

### Profile Service

Base URL:

- `PROFILE_SERVICE_BASE_URL`

Implemented routes:

- `GET /healthz`
- `GET /readyz`
- `GET /metrics`
- `GET /v1/meta/manifest`
- `GET /v1/profile/schema`
- `GET /v1/users/{handle}`
- `GET /v1/users/{handle}/card`
- `GET /v1/me/profile`
- `PATCH /v1/me/profile`
- `PATCH /v1/me/profile/repositories/{owner}/{repo}`

Read-model behavior:

- serves snapshot-backed public and authenticated profiles
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
- `GET /v1/jobs/config`
- `GET /v1/jobs/dead-letters/config`

## Browser Auth Scheme

Current browser-facing auth contract:

- session cookie: `gitrank_session`
- CSRF cookie: `gitrank_csrf`
- CSRF header: `X-CSRF-Token`

Route requirements:

- `GET /v1/me/profile` requires a valid session cookie
- `PATCH /v1/me/profile` requires a valid session cookie and matching CSRF header
- `PATCH /v1/me/profile/repositories/{owner}/{repo}` requires a valid session cookie and matching CSRF header
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
