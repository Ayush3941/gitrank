# GitRank

AI-powered open source skill reputation and gamification platform.

GitRank turns public GitHub activity into a more meaningful developer reputation system. Instead of rewarding raw activity such as commit counts, contribution streaks, or low-effort pull requests, GitRank evaluates the quality, depth, difficulty, and impact of open-source work. The goal is simple: represent what a developer actually contributed, not just how often they clicked "commit".

## Core Thesis

GitRank does not only ask:

> How much did you contribute?

It asks:

> How meaningful was your contribution?

That distinction is the product.

## Why GitRank Exists

GitHub already exposes a lot of public data:

- commits
- pull requests
- review comments
- stars and forks
- contribution graphs
- repository activity

Those signals are useful, but they are weak proxies for engineering skill.

A typo fix, a flaky test cleanup, a production bug repair, a performance optimization, and a cross-service refactor may all show up as "1 merged PR". Traditional profiles flatten these contributions into the same unit even though they carry very different technical weight.

GitRank is designed to close that gap.

## Problem

Current open-source reputation systems have three major issues:

1. They reward volume more than quality.
2. They are easy to game with low-value contributions.
3. They do not clearly separate beginner activity from high-signal engineering work.

This creates a credibility problem for:

- students trying to prove real skill
- recruiters trying to evaluate developers fairly
- maintainers looking for consistent contributors
- contributors who do difficult but less flashy work such as tests, infra, refactors, and code review

## Solution

GitRank evaluates GitHub contributions with repository context and AI-assisted analysis to build an evidence-backed skill profile.

For each pull request, GitRank can inspect:

- changed files and languages
- lines added and removed
- test impact
- issue links and labels
- review comments and requested changes
- merge outcome
- repository importance and activity
- contributor consistency over time
- maintainer interactions
- contribution category and difficulty

These signals feed a scoring engine that produces:

- contribution intensity scores
- skill-specific XP
- levels and rank progression
- badges
- public reputation profiles
- trend lines over time

## Product Goals

- Make open-source effort legible.
- Reward meaningful work over spam.
- Encourage long-term contributor growth.
- Help developers showcase real engineering ability.
- Give maintainers and recruiters a better signal than raw GitHub graphs.

## Key Product Features

### 1. PR Intensity Score

Every pull request receives a weighted score based on technical depth and contribution context.

Example factors:

- files changed
- code churn adjusted for noise
- module criticality
- presence of tests
- review iteration count
- whether feedback was addressed
- whether the PR was merged
- whether the change affected architecture, performance, reliability, or security

### 2. AI PR Analysis

An LLM-assisted analyzer classifies what kind of engineering work happened in the PR and summarizes its likely difficulty.

Possible categories:

- documentation
- tests
- bug fix
- feature
- refactor
- performance
- infrastructure
- security
- developer tooling
- maintainer design work

### 3. Skill Reputation Profile

Instead of one generic score, GitRank can model strengths across dimensions such as:

- backend engineering
- systems design
- testing discipline
- debugging
- API design
- developer tooling
- performance optimization
- documentation quality
- open-source consistency

### 4. Levels and XP

Developers progress through a reputation ladder as they accumulate verified contribution evidence.

Illustrative rank ladder:

- Explorer
- Contributor
- Builder
- Specialist
- Maintainer
- Architect

### 5. Contribution Badges

Focused achievements help developers tell a clearer story.

Examples:

- Bug Hunter
- Test Builder
- Docs Improver
- Performance Optimizer
- Backend Contributor
- Systems Builder
- Reliable Reviewer
- Refactor Specialist

### 6. Public Skill Card

Each user gets a shareable public profile with:

- overall GitRank
- strongest skill areas
- contribution history
- top repositories
- notable badges
- growth over time

## Anti-Gaming Principles

GitRank should not become a platform that rewards noise. The scoring model should explicitly resist shallow optimization.

Core anti-gaming rules:

- merged work counts more than unmerged work
- repeated micro-PR spam should have diminishing returns
- documentation and small fixes can still matter, but context should determine their weight
- maintainers' review acceptance should matter more than self-opened activity
- repository quality and project significance should influence contribution weight
- copy-paste churn and cosmetic edits should be discounted
- consistency over time should beat short bursts of low-value activity

Eligibility rules:

- only public repositories are in scope for scoring
- public repositories owned by organizations are treated like any other public repository
- private repositories do not count toward GitRank
- self-merged pull requests are monitored through score-event metadata and receive zero XP
- bot-authored and bot-assisted pull requests do not count toward GitRank

## Frozen V1 Decisions

The production policy baseline is frozen in these docs:

- [docs/production-decision-register.md](./docs/production-decision-register.md)
- [docs/MAINTAINER_GUIDE.md](./docs/MAINTAINER_GUIDE.md)
- [docs/github-integration-policy.md](./docs/github-integration-policy.md)
- [docs/ai-governance.md](./docs/ai-governance.md)
- [docs/privacy-and-data-handling.md](./docs/privacy-and-data-handling.md)
- [docs/analytics-plan.md](./docs/analytics-plan.md)
- [docs/infrastructure-baseline.md](./docs/infrastructure-baseline.md)

Important v1 decisions:

- GitHub OAuth is the required auth path
- public profiles and the leaderboard are enabled by default for signed-in users
- bounded public PR diffs may be used for AI enrichment, but private code and full repository files are out of scope
- Kubernetes and OCI images are the deployment baseline
- Git tags, GitHub Releases, and OCI publication are required in v1, while signing and provenance are deferred
- DCO is required and CLA is not

## High-Level Architecture

GitRank is structured as a Go monorepo with multiple services and shared packages.

```mermaid
flowchart LR
    User[User Dashboard / Public Profile] --> APIGW[API Gateway]
    APIGW --> AUTH[Auth Service]
    APIGW --> PROFILE[Profile Service]
    APIGW --> SCORE[Scoring Engine]
    APIGW --> INGEST[GitHub Ingestor]
    SCHED[Scheduler Worker] --> INGEST
    INGEST --> ANALYZER[PR Analyzer]
    ANALYZER --> SCORE
    SCORE --> PROFILE
    AUTH --> GH[GitHub OAuth / GitHub API]
    INGEST --> GH
```

## Repository Layout

```text
gitrank/
├── deployments/
├── docs/
├── go.work
├── packages/
│   ├── aiapi/
│   ├── authkit/
│   ├── config/
│   ├── contracts/
│   ├── errors/
│   ├── events/
│   ├── githubapi/
│   ├── httpkit/
│   └── logger/
├── scripts/
└── services/
    ├── api-gateway/
    ├── auth-service/
    ├── github-ingestor/
    ├── pr-analyzer/
    ├── profile-service/
    ├── scheduler-worker/
    └── scoring-engine/
```

## Service Responsibilities

### `services/api-gateway`

External entrypoint for frontend clients and third-party consumers.

Responsibilities:

- route public and authenticated API traffic
- aggregate data from internal services
- enforce auth and rate limits
- expose profile, score, badge, and contribution endpoints

### `services/auth-service`

Handles identity and GitHub OAuth integration.

Responsibilities:

- sign-in with GitHub
- session or token issuance
- identity linking
- permission checks for private or scoped data

### `services/github-ingestor`

Fetches and normalizes GitHub data.

Responsibilities:

- call GitHub REST and GraphQL APIs
- pull repository, PR, review, commit, and issue metadata
- normalize raw data into internal contracts
- schedule incremental syncs
- handle rate limits, retries, and caching

### `services/pr-analyzer`

Converts raw pull request data into structured technical signals.

Responsibilities:

- classify PR type
- estimate complexity and effort
- detect tests, refactors, docs-only work, infra work, or security-related changes
- produce AI summaries and machine-readable labels

### `services/scoring-engine`

Transforms analyzed contribution data into reputation outputs.

Responsibilities:

- calculate PR intensity
- assign XP and skill weights
- apply anti-spam and anti-gaming rules
- compute badges, ranks, and trend lines

### `services/profile-service`

Owns user-facing profile and leaderboard views.

Responsibilities:

- build public profile responses
- aggregate repository and contribution stats
- expose badge, level, and timeline data
- prepare shareable profile cards

### `services/scheduler-worker`

Runs asynchronous jobs.

Responsibilities:

- enqueue and deduplicate internal sync jobs
- trigger recurring backfill plans from cron schedules
- lease ready work with bounded concurrency
- execute bounded in-process installation, repository, user, pull-request, review, issue, and commit sync jobs against `github-ingestor`
- apply retry and exponential backoff policy
- throttle repeated sync generation per user and installation
- expose filtered queue inspection for user, repository, installation, and correlation tracing
- move poison jobs to a dead-letter queue
- support pause, cancel, manual replay, and recurring-plan control flows, including canceling the latest queued or leased backfill run for a plan

## Shared Package Responsibilities

### `packages/contracts`

Shared types, DTOs, and internal service contracts.

### `packages/logger`

Structured logging helpers and common logging configuration.

### `packages/config`

Centralized environment and service configuration loading.

### `packages/errors`

Common error types, wrappers, and API-safe error mapping.

### `packages/events`

Event payloads and publisher/subscriber interfaces for async workflows.

### `packages/authkit`

Shared authentication helpers, middleware, and token utilities.

### `packages/httpkit`

Shared HTTP server bootstrap, request IDs, access logging, panic recovery, and JSON helpers.

### `packages/githubapi`

GitHub-specific API helpers for OAuth URL generation, webhook verification, rate-limit-aware clients, and optional future App-path request shaping.

### `packages/aiapi`

AI-provider request building and integration boundaries for analyzer-side enrichment.

## Proposed Data Flow

1. A user signs in with GitHub.
2. GitRank stores the user's GitHub identity and sync preferences.
3. The scheduler triggers repository and PR ingestion jobs.
4. The GitHub ingestor fetches PR metadata, diffs, reviews, labels, linked issues, and repository context.
5. The PR analyzer classifies the contribution and extracts technical signals.
6. The scoring engine converts those signals into XP, badges, and rank movement.
7. The profile service materializes an updated public profile.
8. The API gateway serves dashboard and public profile requests.

## Scoring Model Direction

The scoring model is the core intellectual asset of the product. A good first version should stay understandable and auditable.

Illustrative scoring dimensions:

### Contribution Type Weight

Base weight for the category of work:

- docs: low to medium
- tests: medium
- bug fix: medium to high
- feature: high
- refactor: medium to high
- performance: high
- infra or tooling: medium to high
- security: high
- architecture or maintainer work: very high

### Technical Depth

Signals that increase depth:

- multiple important files changed
- non-trivial logic updates
- complex code paths
- schema, API, or concurrency changes
- meaningful tests added or updated
- cross-module integration work

### Review Strength

Signals that improve confidence:

- maintainers requested changes and the contributor addressed them
- the PR received detailed review discussion
- the final merge indicates approval from trusted reviewers

### Repository Weight

Not all repositories carry the same signal.

Possible weighting inputs:

- repository activity
- number of maintainers
- issue and PR volume
- star count as a weak secondary feature
- age and health of the project

### Outcome Weight

- merged PRs count the most
- closed without merge counts less
- draft or abandoned work should contribute little or nothing

### Consistency Multiplier

Contributors who do meaningful work steadily over time should earn more trust than contributors who appear briefly with noisy bursts.

## Example Scoring Formula

This is only a directional model for v1:

```text
PR Score =
  BaseCategoryWeight
  x TechnicalDepth
  x ReviewConfidence
  x RepositoryWeight
  x OutcomeMultiplier
  x ConsistencyModifier
  - SpamPenalty
```

This formula should remain interpretable. If AI is used, it should enrich features rather than hide the scoring logic behind an opaque model.

## AI Layer Design

The AI layer should assist classification, not replace system design.

Good uses of AI:

- summarize the technical purpose of a PR
- classify the contribution type
- estimate whether the change is shallow, moderate, or deep
- identify likely skill areas involved
- generate human-readable profile insights

AI should not be trusted blindly for:

- final scoring without deterministic checks
- security-critical claims
- contributor identity trust
- exact difficulty estimation without repo context

Recommended approach:

- deterministic feature extraction first
- AI classification second
- rule-based scoring third

## Suggested Storage Model

The first version will likely need:

- PostgreSQL for users, repositories, pull requests, analysis results, scores, badges, and profile snapshots
- Redis for caching, job coordination, and temporary rate-limit protection

Core entities:

- users
- github_accounts
- repositories
- pull_requests
- pull_request_reviews
- contribution_analyses
- score_events
- badges
- user_badges
- profile_snapshots
- sync_jobs

## Proposed Tech Stack

### Backend

- Go for services
- PostgreSQL for primary relational storage
- Redis for caching and background coordination
- GitHub REST and GraphQL APIs for source data
- OpenAI or another LLM provider for PR analysis and profile insights

### Frontend

- dashboard for authenticated users
- public shareable profile pages
- contribution timeline, badges, and skill breakdown views

### Infrastructure

- OCI-containerized services
- Kubernetes as the v1 deployment baseline
- managed PostgreSQL and Redis preferred for production state
- async workers for ingestion and re-scoring
- observability through structured logs, metrics, and planned tracing

## API Direction

Current gateway routes:

- `GET /healthz`
- `GET /readyz`
- `GET /metrics`
- `GET /v1/meta/manifest`
- `GET /v1/meta/dependencies`
- `POST /v1/sync`
- `POST /v1/sync/installation/execute`
- `POST /v1/sync/repository/execute`
- `GET /v1/me/profile`
- `GET /v1/me/quests`
- `PATCH /v1/me/profile`
- `PATCH /v1/me/profile/repositories/{owner}/{repo}`
- `GET /v1/pr/{owner}/{repo}/{number}/report`
- `GET /v1/leaderboard`
- `GET /v1/users/{handle}`
- `GET /v1/users/{handle}/card`

Implemented service routes today:

- `GET /v1/meta/manifest` and `GET /metrics` on every service
- `GET /oauth/github/start`, `GET /oauth/github/callback`, `GET /v1/session/me`, `POST /v1/session/refresh`, and `POST /v1/session/logout` on `auth-service`
- `POST /webhooks/github`, `POST /v1/webhooks/github/deliveries/{delivery_id}/requeue`, `POST /v1/sync/preview`, `GET /v1/sync/runs`, `POST /v1/sync/installation/execute`, `POST /v1/sync/user/execute`, `POST /v1/sync/repository/execute`, `POST /v1/sync/pull-request/execute`, `POST /v1/sync/review/execute`, `POST /v1/sync/issue/execute`, `POST /v1/sync/commit/execute`, and the normalized `POST /v1/sync/*` routes on `github-ingestor`
- `POST /v1/analyze/pull-request` on `pr-analyzer`
- `POST /v1/score/contribution`, `POST /v1/score/users/{user_id}/replay`, `GET /v1/score/users/{user_id}/snapshot`, and `GET /v1/score/users/{user_id}/events` on `scoring-engine`
- `GET /v1/profile/schema`, `GET /v1/leaderboard`, `GET /v1/users/{handle}`, `GET /v1/users/{handle}/card`, `GET /v1/me/profile`, `GET /v1/me/quests`, `GET /v1/pr/{owner}/{repo}/{number}/report`, and profile privacy update routes on `profile-service`
- `GET /v1/jobs`, `POST /v1/jobs/sync`, `POST /v1/jobs/tick`, `POST /v1/jobs/lease`, `POST /v1/jobs/run-once`, `GET|POST /v1/jobs/backfills`, recurring-plan pause/resume/cancel/delete routes, `GET /v1/jobs/dead-letters`, job control routes, and dead-letter replay routes on `scheduler-worker`

## Local Development

### Prerequisites

- Go `1.26+`
- GitHub OAuth app credentials
- PostgreSQL
- Redis
- an AI provider API key for PR analysis

Optional future-upgrade path:

- GitHub App credentials for deeper org-scale ingestion are not required for the v1 production baseline

### Current Workspace

This repository is currently scaffolded as a Go workspace using `go.work` with one module per service and shared package.

### Useful Commands

From the project root:

```bash
cd gitrank
go work sync
make test
```

To inspect the workspace:

```bash
go work edit -json
```

### Suggested Environment Variables

```bash
GITRANK_ENV=development
GITRANK_HTTP_PORT=8080
GITHUB_CLIENT_ID=your_github_oauth_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_client_secret
GITHUB_WEBHOOK_SECRET=your_github_webhook_secret
DATABASE_URL=postgres://postgres:postgres@localhost:5432/gitrank?sslmode=disable
REDIS_URL=redis://localhost:6379
OPENAI_API_KEY=your_api_key
```

See [`.env.example`](./.env.example) for the full local configuration surface, including optional future GitHub App settings that are not required in the v1 production baseline.

Optional local seed data:

```bash
cd gitrank
DATABASE_URL=postgres://postgres:postgres@localhost:5432/gitrank?sslmode=disable \
GITRANK_ENV=development \
ALLOW_LOCAL_SEED=1 \
make seed-local
```

This seed path is intentionally local-only. It creates one deterministic sample user, repository, PR, score event, badge, and profile snapshot for profile and scoring development.

## MVP Roadmap

### Phase 1: Foundation

- GitHub OAuth
- user onboarding
- PR ingestion for public repositories
- normalized storage for PRs, reviews, repositories, and users

### Phase 2: Contribution Analysis

- rule-based PR classification
- AI-generated PR summaries
- first-pass technical depth scoring
- docs vs tests vs bugfix vs feature categorization

### Phase 3: Reputation Engine

- user XP
- skill weights
- levels
- badge issuance
- contribution timeline

### Phase 4: Public Profiles

- public profile pages
- shareable skill cards
- repository highlights
- progress history

### Phase 5: Trust and Platform Features

- leaderboards
- maintainer signals
- contributor streaks based on meaningful work
- org or team dashboards

## Example User Journey

1. A developer connects GitHub.
2. GitRank imports their merged PR history.
3. The system analyzes each contribution.
4. The developer sees which repositories, languages, and skills contribute most to their score.
5. They earn badges for meaningful work patterns such as testing, debugging, or sustained backend contributions.
6. They share their public GitRank profile on resumes, portfolios, and social platforms.

## Intended Users

- students building proof of skill
- early-career developers who need stronger public credibility
- open-source contributors who want recognition beyond streaks
- maintainers who want better contributor insight
- recruiters, mentors, and communities who need better evaluation signals

## Design Principles

- evidence over hype
- quality over volume
- explainable scoring over black-box ranking
- sustained contribution over one-off activity
- contributor growth over vanity metrics

## Risks and Challenges

This product only works if the scoring feels credible. Major challenges include:

- avoiding false precision in AI judgments
- preventing gaming through micro-contributions
- handling repository context fairly
- keeping scores interpretable
- respecting GitHub rate limits and API constraints
- avoiding bias toward only large or popular repositories

These should shape the architecture from the start.

## Long-Term Vision

If executed well, GitRank can become a serious reputation layer on top of open source:

- a motivation system for contributors
- a discovery signal for maintainers
- a credibility signal for recruiters
- a progress tracker for developers improving in public

The best version of GitRank does not just make contribution graphs prettier. It makes open-source work more legible, more rewarding, and harder to fake.

## Current Status

The repository currently contains a working foundation, not just an empty scaffold:

- workspace modules for all core services
- shared packages for config, logging, errors, events, auth, HTTP, and GitHub API access
- a frozen v1 production decision register plus maintainer, privacy, AI-governance, analytics, and infrastructure policy docs
- DCO workflow enforcement plus PR-template sign-off reminders
- real auth-service session, OAuth, token refresh, linking, unlinking, and audit logic
- webhook intake plus normalized repository, PR, review, issue, label, commit, installation, and sync-run persistence in the GitHub ingestor, including queryable manual sync traceability by user, repository, requester, and correlation ID
- GitHub REST and GraphQL client protections with bounded concurrency, secondary-rate-limit backoff, and provider-failure circuit breakers
- GitHub REST and GraphQL fault-injection tests that prove secondary-rate-limit recovery and `Retry-After` handling on the shared client path
- configurable `github-ingestor` repository metadata caching for stable `/repos/{owner}/{repo}` responses during bounded sync execution
- OAuth-token-backed GraphQL batching in `github-ingestor` for repository PR details and reviews, with public REST list enrichment and REST fallback when the requester has no usable linked OAuth token
- GitHub login, repository, and commit sync target validation plus HTTP(S)-only outbound URL guards for gateway, GitHub, and AI clients
- a CI-backed Go safety audit that fails on non-test `unsafe` or reflection-heavy code paths unless they are reviewed explicitly
- W3C `traceparent` propagation across service HTTP boundaries, scheduler-triggered async sync execution, GitHub API calls, OAuth token calls, and AI request builders
- renderable Prometheus and Grafana Kubernetes manifests that mount the committed alert rules and dashboards, with a local `make verify-observability-manifests` check
- Kubernetes deployment rollback workflow support plus a local `make verify-rollback-procedure` check for manifest rendering and rollback wiring
- environment-separated ExternalSecret examples plus key-ring-aware auth/token secret rotation runbooks verified by `make verify-secret-policy`
- local verification Makefile targets pass `TMPDIR` through so manifest render checks do not depend on limited system `/tmp` space
- a bounded live user sync execution path that walks recent public repositories owned by a GitHub login and persists them through the repository executor in `github-ingestor`
- a bounded installation sync execution path that replays repositories already associated with a persisted installation record and delegates them through the repository executor without requiring GitHub App installation auth in the v1 baseline
- a bounded live repository sync execution path that fetches recent repository, PR, review, issue, and commit data from the public GitHub REST API and persists it directly through `github-ingestor`
- a bounded live pull-request sync execution path that fetches one public PR plus its reviews and review comments and persists them directly through `github-ingestor`
- a bounded live review sync execution path that refreshes the review surface for one PR number and persists its reviews and review comments through `github-ingestor`
- a bounded live issue sync execution path that fetches one standalone public issue plus its labels and persists it directly through `github-ingestor`
- a bounded live commit sync execution path that fetches one public commit and persists it directly through `github-ingestor`
- an ingestion throughput benchmark target, `make bench-ingestion`, for PostgreSQL-backed pull-request webhook persistence when `GITRANK_INGESTOR_DATABASE_URL` is configured
- optional PostgreSQL-backed webhook delivery persistence for durable dedupe and requeue state in the GitHub ingestor
- query-shape indexes for profile, scoring, sync-run, auth-session, and installation replay reads, with profile/scoring bulk reads avoiding application-level N+1 query loops
- deterministic PR analysis and deterministic contribution scoring services, with schema-validated analysis envelopes, grounded-language and summary guardrails for future AI-assisted outputs, deterministic language and critical-path heuristics, issue-link and review-cycle extraction, regression datasets, scorer-side artifact validation before XP computation, and persisted replay runs with immutable score events plus historical score snapshots
- a snapshot-backed profile-service read model with privacy controls, repository visibility, caching, and share-card data
- a scheduler-worker orchestration layer with deduplicated enqueue, recurring backfill plans, plan pause/resume/cancel/delete controls, per-scope throttling, leasing, retries, dead letters, pause/cancel controls, manual replay, bounded in-process execution for `sync.installation`, `sync.repository`, `sync.user_history`, `sync.pull_request`, `sync.review`, `sync.issue`, and `sync.commit` jobs, plus PostgreSQL-backed durable scheduler tables and cross-instance mutation serialization when `DATABASE_URL` is configured
- live profile route integration through api-gateway plus frontend BFF routes for public profile and settings pages, including settings-triggered sync, account data export, recent PR battle-report summaries, GitHub disconnect, and self-service account deletion
- API-gateway product analytics counters for onboarding completion, sync success/failure, profile views, score explanation opens, and badge views, with bounded event payloads and no raw code/token capture
- metrics endpoints and shared request instrumentation across the Go services, including queue depth, cache hit rate, sync duration, score computation duration, PR analysis breakdowns, estimated analysis token/cost telemetry, GitHub rate-limit tracking, and HTTP error counters
- PostgreSQL migrations for core entities, GitHub ingestion state, and auth/session security tables
- generic OCI build packaging under `deployments/docker/` and a release workflow that builds binaries, publishes GitHub Releases, and pushes per-service OCI images
- a Kubernetes deployment baseline under `deployments/k8s/` with per-service Deployments, Services, gateway/auth ingress, staging and production overlays, runtime secret contracts, and migration Job wiring
- committed observability assets under `deployments/observability/`, including Grafana dashboards, Prometheus alert rules, and service runbooks
- a substantial Next.js frontend with dashboard, profile, leaderboard, quest, badge, onboarding, and PR-report flows, with live profile/settings/account actions, account export download, live dashboard/badge/contribution/recent-report data from the authenticated profile snapshot, live quest recommendations from profile score evidence, live PR battle reports from persisted public PR analysis and score evidence, live leaderboard data from public profile snapshots, season/rank progression presentation, player-card public profiles, badge rarity styling, and an account-backed reduced-gamification preference for authenticated dashboard flows
- CI, frontend CI, release-artifact, Kubernetes deployment, dependency-review, CodeQL for Go and TypeScript, Scorecard, repo-level secret scanning, pinned Trivy filesystem and service-image scanning
- a CI-enforced critical-path test coverage map plus Docker-backed local flow tests covering OAuth, sync, PR ingestion, analysis, scoring, profile projection, and webhook idempotency paths
- a GitHub repository-controls runbook and token-based verifier for proving live branch protection, required checks, dependency graph, and Dependabot alerts

Major gaps remain:

- no external worker backend yet; scheduler-worker persistent mode now uses dedicated PostgreSQL tables for jobs, dead letters, backfill plans, rate-limit windows, and scheduler counters, but only bounded `sync.installation`, `sync.repository`, owned-repository `sync.user_history`, direct `sync.pull_request`, PR-surface `sync.review`, direct `sync.issue`, and direct `sync.commit` jobs currently auto-execute inside `scheduler-worker`
- PR report pages now use a live read model, authenticated profiles expose recent persisted PR reports for dashboard rendering, and direct PR sync persists bounded changed-file metadata, derived file/diff features, and public patch excerpts for report evidence. The report still depends on analysis and score events already being persisted; exact scorer-component materialization, badge-unlock details, and full pipeline orchestration remain pending. Quests now use a live profile-owned read model and have persistence tables for definitions, assignments, progress events, completions, rewards, and audit events, but assignment/reward writers are still pending
- live GitHub repository controls still need to be applied with `make apply-github-repository-controls` or GitHub settings, then verified with `make verify-github-repository-controls`
- no deployed tracing backend or observability stack yet; dashboards and alert rules are committed, and `gitrank/docs/runbooks/production-observability.md` defines the live verification path
- rollback wiring is locally verified, but a real staging or production-like rollback drill still has to be executed and recorded
- the Kubernetes assets are still provider-neutral and require a real `gitrank-runtime-secrets` source, TLS Secret, ingress controller, managed PostgreSQL, managed Redis, and registry owner/tag substitution before production apply

V2 direction:

- replace every production mock and demo-only product path with real backend contracts, persistence, orchestration, and verification
- frontend CI now includes a live-fixture smoke suite that renders dashboard, quests, PR reports, profile, leaderboard, and settings without using frontend mock API functions
- see `CONTRIBUTING.md` for the V1 limitations inventory and V2 no-mock checklist

## License

This project is licensed under the MIT License.
