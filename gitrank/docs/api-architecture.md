# API Architecture

This document lists the current internal and external API surface for GitRank.

## External APIs

### GitHub OAuth

- authorization endpoint
- token exchange endpoint

Used by:

- `auth-service`

Config:

- `GITHUB_OAUTH_AUTHORIZE_URL`
- `GITHUB_OAUTH_TOKEN_URL`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_OAUTH_REDIRECT_URL`

### GitHub REST API

Used by:

- `github-ingestor`
- `api-gateway` as an upstream dependency map

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

### GitHub Webhooks

Used by:

- `github-ingestor`

Config:

- `GITHUB_WEBHOOK_SECRET`

### OpenAI Responses API

Used by:

- `pr-analyzer` as the future AI-enrichment boundary

Config:

- `OPENAI_BASE_URL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `AI_REQUEST_TIMEOUT`

### OpenAI Moderation and Embeddings

Reserved for:

- prompt and payload safety
- future repository or skill clustering work

Config:

- `OPENAI_MODERATION_MODEL`
- `OPENAI_EMBEDDING_MODEL`

## Internal Service APIs

### API Gateway

Base URL:

- `GITRANK_API_BASE_URL`

Implemented routes:

- `GET /healthz`
- `GET /readyz`
- `GET /v1/meta/manifest`
- `GET /v1/meta/dependencies`

Planned routes:

- `POST /v1/sync`
- `GET /v1/me/profile`
- `GET /v1/users/{handle}`

### Auth Service

Base URL:

- `AUTH_SERVICE_BASE_URL`

Implemented routes:

- `GET /healthz`
- `GET /readyz`
- `GET /v1/meta/manifest`
- `GET /oauth/github/install`
- `GET /oauth/github/start`
- `GET /oauth/github/callback`
- `POST /oauth/github/token/exchange`
- `POST /oauth/github/token/refresh`
- `GET /v1/session/debug`

Planned routes:

- `GET /v1/session/me`

### GitHub Ingestor

Base URL:

- `GITHUB_INGESTOR_BASE_URL`

Implemented routes:

- `GET /healthz`
- `GET /readyz`
- `GET /v1/meta/manifest`
- `POST /webhooks/github`
- `POST /v1/sync/preview`
- `POST /v1/sync/installation`
- `POST /v1/sync/user`
- `POST /v1/sync/repository`
- `POST /v1/sync/pull-request`
- `POST /v1/sync/review`
- `POST /v1/sync/issue`
- `POST /v1/sync/commit`

### PR Analyzer

Base URL:

- `PR_ANALYZER_BASE_URL`

Implemented routes:

- `GET /healthz`
- `GET /readyz`
- `GET /v1/meta/manifest`
- `POST /v1/analyze/pull-request`

### Scoring Engine

Base URL:

- `SCORING_ENGINE_BASE_URL`

Implemented routes:

- `GET /healthz`
- `GET /readyz`
- `GET /v1/meta/manifest`
- `POST /v1/score/contribution`

### Profile Service

Base URL:

- `PROFILE_SERVICE_BASE_URL`

Implemented routes:

- `GET /healthz`
- `GET /readyz`
- `GET /v1/meta/manifest`
- `GET /v1/profile/schema`

Planned routes:

- `GET /v1/users/{handle}`
- `GET /v1/me/profile`

### Scheduler Worker

Base URL:

- `SCHEDULER_WORKER_BASE_URL`

Implemented routes:

- `GET /healthz`
- `GET /readyz`
- `GET /v1/meta/manifest`
- `GET /v1/jobs/config`
- `GET /v1/jobs/dead-letters/config`

## Shared API Packages

- `packages/httpkit`: shared HTTP middleware, JSON helpers, request IDs, recovery, access logs, and server runner
- `packages/githubapi`: GitHub OAuth URL construction, webhook verification, and GitHub-specific request helpers
- `packages/aiapi`: OpenAI Responses request building and future AI client boundary

## Debugging Strategy

The current architecture favors debuggability:

- every service exposes a route manifest
- service dependencies are explicit in config and manifests
- request IDs are injected at the HTTP edge
- access logging and panic recovery are shared
- deterministic analysis and scoring run without network dependencies
