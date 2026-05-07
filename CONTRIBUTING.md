# Contributing to GitRank

Last reviewed: May 5, 2026

This document is intentionally detailed.

It serves two purposes:

1. It explains what GitRank is and how contributors should approach the project.
2. It acts as the master production-readiness checklist for turning the current scaffold into a serious, deployable platform.

If an item in this file is unchecked, assume it is not production-ready yet.

Policy items that have been frozen in docs may be checked here even when their downstream engineering implementation is still incomplete. Use the linked policy docs to distinguish `decision made` from `runtime finished`.

## What GitRank Is

GitRank is an AI-assisted developer reputation platform built around one core idea:

> Open-source activity is easy to count, but hard to evaluate well.

GitHub already shows commits, pull requests, stars, forks, streaks, and contribution graphs. Those are activity signals, not skill signals.

GitRank exists to evaluate:

- what a developer actually changed
- how technically meaningful that work was
- how difficult the work appears to have been
- whether maintainers reviewed and accepted it
- whether the change improved quality, reliability, performance, security, or maintainability

The product should reward meaningful contribution, not spam.

That means GitRank must be:

- explainable
- evidence-based
- resistant to gaming
- respectful of privacy
- credible enough for contributors, maintainers, and recruiters to trust

## Current Repository Status

The repository is past the pure scaffold stage, but it is not production-ready.

Current state:

- [x] Top-level repository README exists.
- [x] Detailed project README exists at `gitrank/README.md`.
- [x] Go workspace exists at `gitrank/go.work`.
- [x] Core service modules are scaffolded.
- [x] Shared package modules are scaffolded.
- [x] Business logic exists for auth, webhook intake, deterministic PR analysis, scoring, and the mock frontend product flows.
- [x] API contracts are implemented.
- [x] Database schema exists.
- [x] Migrations exist.
- [x] Tests exist.
- [x] CI exists.
- [x] Security policy exists.
- [x] Code ownership rules exist.
- [x] Issue or PR templates exist.
- [x] Deployment manifests exist.
- [ ] Production observability exists.
- [x] Release process exists.
- [x] Frozen v1 production decision register exists.
- [x] Maintainer guide exists.
- [x] DCO enforcement workflow exists.

## Repository Layout

The backend workspace lives under `gitrank/`. The frontend lives under `frontend/`.

```text
.
├── CONTRIBUTING.md
├── README.md
├── frontend/
│   ├── app/
│   ├── components/
│   ├── features/
│   ├── hooks/
│   ├── lib/
│   └── types/
└── gitrank/
    ├── AGENTS.md
    ├── README.md
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

## Product Principles

Every meaningful contribution to GitRank should preserve these principles:

- Explainability over magic.
- Quality over activity volume.
- Deterministic scoring over opaque hype.
- Abuse resistance over vanity metrics.
- User trust over aggressive data collection.
- Production discipline over demo-only shortcuts.

## Before You Contribute

Read these first:

- `README.md`
- `gitrank/README.md`
- `gitrank/docs/production-decision-register.md`
- this file

Then understand the current reality:

- the project already contains meaningful implementation, but several services are still partial
- contributors are expected to improve both implementation and clarity
- a large portion of the remaining work is integration, persistence, and production hardening rather than pure feature polish

## Contribution Rules

### General expectations

- Keep pull requests focused.
- Prefer one coherent change over broad unrelated edits.
- Do not introduce fake handlers, fake persistence, fake success states, or silent TODO logic without documenting it.
- If you add a temporary shortcut, disclose it in both `README.md` and this file in the same change set.
- Match the repo’s architecture direction instead of adding convenience code that will need to be ripped out later.

### Communication expectations

- Open an issue before large architectural changes.
- Write down assumptions.
- Call out tradeoffs explicitly.
- If you change scoring logic, document why.
- If you change contributor-facing behavior, update docs in the same PR.

### Pull request expectations

Every PR should include:

- a clear summary
- the problem being solved
- design notes or tradeoffs
- testing performed
- known limitations
- follow-up work if the change is incomplete

### Review expectations

- Review for correctness first.
- Review for security second.
- Review for operability third.
- Review for maintainability fourth.
- Do not approve code you would not want to own in production.

## Branching and Commit Hygiene

- Use short-lived feature branches.
- Prefer atomic commits with meaningful messages.
- Rebase or merge main frequently enough to avoid stale branch drift.
- Do not mix refactors, infra changes, and product logic in one PR unless tightly coupled.

Recommended commit style:

- `feat: add GitHub installation token manager`
- `fix: prevent duplicate PR ingestion jobs`
- `docs: expand scoring design and threat model`
- `chore: add CodeQL and dependency review workflows`

## Development Workflow

1. Understand the target behavior first.
2. Read the relevant service and package boundaries before editing.
3. Design the change at the contract level.
4. Implement the smallest production-grade version of the change.
5. Add or update tests.
6. Update docs.
7. Run verification locally.
8. Self-review the diff.

## Local Development Expectations

The current project uses a Go workspace with multiple modules.

Contributors should be comfortable working with:

- `go.work`
- per-service `go.mod` files
- shared packages used across service boundaries

Useful commands from `gitrank/`:

```bash
go env GOWORK
go work sync
find . -name go.mod -execdir sh -c 'go test ./...' \;
```

When working on one module in isolation:

```bash
GOWORK=off go test ./...
```

## Definition of a Good First Production Contribution

A good early contribution is one that reduces ambiguity or adds a reusable foundation.

Examples:

- define shared API error envelopes
- add config loading and validation
- add structured logging primitives
- create base database migration tooling
- add webhook signature verification middleware
- define scoring event contracts
- add issue templates, PR templates, and security policy docs
- add CI with lint, tests, vuln scanning, and code scanning

Examples that are too early unless properly designed:

- leaderboard polish without score design
- badge UI without badge data model
- profile animations before profile contracts
- ranking formulas hidden inside prompt text

## Master Production Checklist

This is the main checklist for what remains to be done.

## 1. Community Health and Open Source Governance

- [x] Add a project license.
- [x] Add a `CODE_OF_CONDUCT.md`.
- [x] Add a `SECURITY.md`.
- [x] Add issue templates for bug reports, feature requests, architecture proposals, and scoring disputes.
- [x] Add a pull request template.
- [x] Add a `CODEOWNERS` file.
- [x] Define repository labels.
- [x] Define milestone strategy.
- [x] Define release versioning strategy.
- [x] Define support expectations for contributors and users.
- [x] Decide whether the project uses CLA, DCO, or neither.
- [x] Add a roadmap document under `gitrank/docs/`.
- [x] Add ADRs for major architecture decisions.
- [x] Add a maintainer guide for triage and release operations.

Why this matters:

- GitHub surfaces `CONTRIBUTING.md`, `SECURITY.md`, issue templates, PR templates, and code ownership directly in repository workflows.
- A public project without community health files looks unfinished and is harder to scale safely.

Settled v1 policy:

- GitRank uses DCO, not CLA.
- Maintainer operations are documented in `gitrank/docs/MAINTAINER_GUIDE.md`.

## 2. Product Definition and Scoring Credibility

- [x] Define the exact GitRank scoring thesis in one formal design doc.
- [x] Define the list of supported contribution categories.
- [x] Define what counts as meaningful work.
- [x] Define what counts as spam or low-signal work.
- [x] Define how merged, closed, draft, and abandoned PRs are treated.
- [x] Define how review quality affects score.
- [x] Define how repository significance affects score.
- [x] Define whether private repositories are in scope.
- [x] Define how organizations and team-owned repositories are handled.
- [x] Define how self-merged PRs are handled.
- [x] Define how bot-authored or bot-assisted PRs are handled.
- [x] Define how documentation-only work is scored fairly.
- [x] Define how test-only work is scored fairly.
- [x] Define how large churn with low value is discounted.
- [x] Define how contributor consistency is rewarded.
- [x] Define how score recalculation works when the formula changes.
- [x] Define whether users can appeal or dispute scores.
- [x] Define whether scores are versioned and reproducible.
- [x] Define fairness checks to reduce bias toward only popular repositories.

Required deliverables:

- [x] `gitrank/docs/scoring-model.md`
- [x] `gitrank/docs/anti-gaming.md`
- [x] `gitrank/docs/fairness-and-limitations.md`

Settled policy decisions:

- Private repositories are out of scope and do not count toward GitRank.
- Public organization-owned repositories are in scope and are treated like any other public repository.
- Self-merged pull requests do not count toward GitRank.
- Bot-authored and bot-assisted pull requests do not count toward GitRank.

## 3. Architecture Baseline

- [x] Decide whether the backend will be synchronous HTTP only, event-driven, or hybrid.
- [x] Define service-to-service communication style.
- [x] Define canonical API contracts.
- [x] Define event schemas.
- [x] Define idempotency strategy.
- [x] Define retry semantics.
- [x] Define correlation IDs and request IDs.
- [x] Define timeout budgets between services.
- [x] Define service ownership boundaries.
- [x] Define the canonical source of truth for user profile aggregates.
- [x] Define how recomputation jobs are triggered and replayed.
- [x] Define how historical re-scoring works.

Required output:

- [x] Architecture decision records.
- [x] A system context diagram.
- [x] A sequence diagram for sign-in, ingest, analyze, score, and profile refresh.
- [x] A failure-mode diagram for webhook retries and backfills.

## 4. Data Model and Persistence

- [x] Choose PostgreSQL version and baseline extensions.
- [x] Design relational schema for users, GitHub accounts, repositories, PRs, reviews, analyses, scores, badges, snapshots, jobs, and audits.
- [x] Define which data is immutable and which is recomputed.
- [x] Add a migration tool and migration directory.
- [x] Define primary keys and uniqueness constraints.
- [x] Define idempotent upsert behavior for GitHub entities.
- [x] Define soft-delete versus hard-delete policy.
- [x] Define audit logging for security-sensitive changes.
- [x] Define retention policy for raw ingestion payloads.
- [x] Define retention policy for AI prompts and outputs.
- [x] Define backup and restore procedures.
- [x] Define database indexing strategy.
- [x] Define partitioning strategy if high event volume is expected.
- [x] Define PII classification and storage rules.
- [x] Encrypt sensitive tokens and credentials at rest.

Required implementation work:

- [x] `gitrank/docs/data-model.md`
- [x] `gitrank/deployments/` database bootstrap assets
- [x] database migrations
- [x] seed data for local development only

Settled v1 policy docs:

- `gitrank/docs/data-model.md`
- `gitrank/docs/privacy-and-data-handling.md`
- `gitrank/docs/infrastructure-baseline.md`

## 5. API Gateway Checklist

Target directory:

- `gitrank/services/api-gateway`

Must be implemented:

- [x] HTTP server bootstrap
- [x] structured request logging
- [x] request ID middleware
- [x] panic recovery middleware
- [x] auth middleware
- [x] CORS policy
- [x] rate limiting
- [x] API versioning
- [x] input validation
- [x] consistent error envelopes
- [x] health endpoints
- [x] readiness endpoints
- [x] metrics endpoint or exporter integration
- [x] graceful shutdown
- [x] pagination conventions
- [x] caching headers where appropriate
- [x] public profile endpoints
- [x] authenticated user endpoints
- [x] sync trigger endpoints
- [x] no admin-only endpoints in v1 by policy

Production-grade expectations:

- [x] OpenAPI or equivalent contract doc exists.
- [x] Endpoint auth requirements are documented.
- [x] Error codes are documented.
- [x] Breaking change policy is documented.

## 6. Auth Service Checklist

Target directory:

- `gitrank/services/auth-service`

Must be implemented:

- [x] GitHub OAuth flow
- [x] CSRF-safe OAuth state handling
- [x] session or token issuance
- [x] token refresh or session rotation strategy
- [x] secure cookie policy if cookie-based
- [x] role model for admin or maintainer access
- [x] account linking and unlinking flows
- [x] logout and session invalidation
- [x] revoked or expired credential handling
- [x] least-privilege OAuth scopes
- [x] audit events for auth-sensitive actions

Security requirements:

- [x] no raw secrets in logs
- [x] encrypted secret storage
- [x] replay protection where relevant
- [x] session fixation protection
- [x] brute-force mitigation where relevant

## 7. GitHub Ingestor Checklist

Target directory:

- `gitrank/services/github-ingestor`

This service is one of the highest-risk parts of the system because reliability, cost, and trust depend on it.

Must be implemented:

- [x] GitHub OAuth user token support for the v1 public-data baseline
- [x] optional GitHub App authentication path exists as future-upgrade scaffolding
- [x] installation token lifecycle handling for the optional future App path
- [x] webhook receiver
- [x] webhook signature validation
- [x] webhook replay protection
- [x] webhook event deduplication
- [x] webhook retry safety
- [x] REST API client
- [x] GraphQL API client
- [x] pagination utilities
- [x] ETag or conditional request support where useful
- [x] rate limit tracking
- [x] secondary rate limit backoff
- [ ] queue-based backfill jobs
- [x] repository sync logic
- [x] pull request sync logic
- [x] review sync logic
- [x] issue and label sync logic
- [x] commit metadata sync logic
- [x] normalized persistence layer
- [ ] dead-letter handling for poison jobs

GitHub-specific requirements:

- [x] verify webhook payloads before processing
- [x] record GitHub delivery IDs for idempotency
- [x] document and request the minimum OAuth scopes needed in v1
- [x] support re-sync after missed webhooks
- [ ] support historical backfill without double-counting
- [x] document REST versus GraphQL usage rules
- [x] document GitHub API rate-limit strategy

Operational requirements:

- [x] ingestion failures are visible in metrics and alerts
- [x] manual requeue exists
- [x] backfill jobs are cancelable
- [x] sync jobs are traceable per user and per repo

Current preview state:

- webhook delivery deduplication and requeue state persist in PostgreSQL when `DATABASE_URL` is configured
- webhook-driven repository, PR, review, issue, label, commit, installation, and sync-run entities persist idempotently in PostgreSQL when `DATABASE_URL` is configured
- `POST /v1/sync/repository/execute` now performs a bounded live repository sync against the public GitHub REST API and persists repository, pull request, review, issue, and commit data directly
- `POST /v1/sync/user/execute` now performs a bounded live user sync by walking recent public repositories owned by the requested GitHub login and delegating to the repository executor
- `POST /v1/sync/installation/execute` now replays repositories already associated with a persisted installation record and delegates each repository to the bounded repository executor without requiring GitHub App installation auth in the v1 baseline
- `POST /v1/sync/pull-request/execute` now performs a bounded live pull-request sync and persists the PR, its reviews, and its review comments directly
- `POST /v1/sync/review/execute` now performs a bounded live review sync by refreshing the review surface for one PR number and persisting its reviews and review comments directly
- `POST /v1/sync/issue/execute` now performs a bounded live issue sync and persists one standalone issue plus its labels directly
- `POST /v1/sync/commit/execute` now performs a bounded live commit sync and persists one public commit directly
- manual sync requests also persist queued sync-run records and are queryable by user, repository, subject, requester, correlation ID, and delivery ID
- scheduler-worker queue, dead-letter, rate-limit window, and recurring backfill plan state now checkpoint to PostgreSQL when `DATABASE_URL` is configured, survive process restarts, and serialize leases, ticks, plan updates, and queue mutations across scheduler instances
- the latest queued or leased recurring backfill run can now be canceled per plan via its recorded correlation ID, and worker completion preserves that canceled terminal state instead of silently marking it completed

## 8. PR Analyzer Checklist

Target directory:

- `gitrank/services/pr-analyzer`

This service should combine deterministic feature extraction with AI assistance.

Deterministic feature extraction:

- [x] file change classification
- [x] language detection
- [x] docs-only detection
- [x] test-change detection
- [x] config or infra change detection
- [x] refactor heuristics
- [x] code churn normalization
- [x] directory criticality tagging
- [x] issue linkage extraction
- [x] review cycle counting
- [x] requested-changes detection
- [x] maintainer interaction signals

AI-assisted analysis:

- [x] prompt design documented
- [x] structured JSON output format defined
- [x] prompt versioning implemented
- [x] model fallback behavior defined
- [x] output validation implemented
- [x] confidence or uncertainty handling defined
- [x] prompt and response retention policy defined
- [x] hallucination guardrails implemented
- [x] token and cost budgets defined

Quality bar:

- [x] representative evaluation dataset exists
- [x] regression tests for classification exist
- [x] false positive and false negative cases are tracked
- [x] model output is never trusted without schema validation
- [x] AI does not directly write final scores without deterministic scoring logic

## 9. Scoring Engine Checklist

Target directory:

- `gitrank/services/scoring-engine`

The scoring engine is the core product asset. It must be auditable.

Must be implemented:

- [x] deterministic scoring pipeline
- [x] versioned scoring formula
- [x] weighted factors defined in code and docs
- [x] explainability output for each scored contribution
- [x] user-level aggregate score computation
- [x] skill dimension computation
- [x] badge issuance logic
- [x] level progression logic
- [x] anti-spam penalties
- [x] diminishing returns rules
- [x] consistency multiplier rules
- [x] repository weighting rules
- [x] merge outcome weighting rules
- [x] re-score and replay jobs
- [x] score event ledger
- [x] historical score snapshots

Credibility requirements:

- [x] a user can see why a contribution was scored the way it was
- [x] formula changes are versioned
- [x] scores can be recomputed from stored evidence
- [x] hidden manual overrides are prohibited or tightly audited
- [x] score disputes have an operational path

## 10. Profile Service Checklist

Target directory:

- `gitrank/services/profile-service`

Must be implemented:

- [x] public profile read model
- [x] authenticated profile read model
- [x] contribution timeline
- [x] top repositories view
- [x] top skill areas view
- [x] level and XP view
- [x] badge listing
- [x] score history view
- [x] profile summary caching
- [x] privacy or visibility controls
- [x] shareable profile card data

Product requirements:

- [x] profile explains strengths without overstating certainty
- [x] trend lines clearly reflect time windows
- [x] profile data is refreshed predictably
- [x] stale profile states are visible or handled

## 11. Scheduler and Async Job System Checklist

Target directory:

- `gitrank/services/scheduler-worker`

Must be implemented:

- [x] job queue selection
- [x] cron scheduling
- [x] retry policy
- [x] exponential backoff
- [x] dead-letter queue
- [x] idempotent job handling
- [x] concurrency controls
- [x] per-user and per-installation rate controls
- [x] job cancellation or pausing support
- [x] manual replay support
- [x] backfill orchestration
- [x] observability for queue depth and failures

Current preview state:

- recurring backfill plans can be created, paused, resumed, canceled for their latest queued run, manually ticked, and deleted through `scheduler-worker`
- queue inspection supports filters for user, repository, installation, status, type, subject, and correlation ID
- the in-process worker can execute bounded `sync.installation`, `sync.repository`, `sync.user_history`, `sync.pull_request`, `sync.review`, `sync.issue`, and `sync.commit` jobs through `github-ingestor`, with completion, retry, and dead-letter behavior surfaced on the scheduler queue
- bounded installation execution currently means replaying repositories already associated with a persisted installation record, not discovering repositories from live GitHub App installation APIs
- bounded user execution currently means recent public repositories owned by the requested GitHub login, not a full cross-repository authored-PR search
- bounded review execution currently means "refresh the reviews and review comments for one PR number", not a review-id-specific sync
- manual worker execution is exposed through `POST /v1/jobs/run-once`
- queue, dead-letter, rate-limit window, and recurring plan state checkpoint to PostgreSQL when `DATABASE_URL` is configured, and persistent mode now serializes multi-instance leases, ticks, and control-plane mutations through the shared runtime-state row
- scheduler runtime state is still stored as a single JSONB snapshot row, not dedicated normalized queue tables

## 12. Shared Packages Checklist

### `gitrank/packages/contracts`

- [x] define request and response DTOs
- [x] define event payloads
- [x] define versioning policy
- [x] avoid circular dependency traps

### `gitrank/packages/logger`

- [x] structured logger
- [x] log levels
- [x] correlation ID helpers
- [x] PII redaction helpers

### `gitrank/packages/config`

- [x] typed config structs
- [x] env parsing
- [x] config validation
- [x] sane defaults
- [x] fail-fast on invalid config

### `gitrank/packages/errors`

- [x] typed domain errors
- [x] transport-safe mapping
- [x] internal versus external error distinction

### `gitrank/packages/events`

- [x] event schemas
- [x] publisher interface
- [x] subscriber interface
- [x] versioning rules

### `gitrank/packages/authkit`

- [x] auth helpers
- [x] token helpers
- [x] middleware primitives
- [x] permission checks

## 13. Frontend and User Experience Checklist

The repo now contains a Next.js frontend in a nested git repo with its own CI and secret-scanning workflows. Public profile reads plus authenticated settings, sync, disconnect, and account-deletion flows are live. Most other product surfaces still use mock data.

Must be defined or built:

- [x] frontend technology choice
- [x] dashboard information architecture
- [x] public profile page
- [x] authenticated account settings
- [x] OAuth onboarding flow
- [x] sync status UI
- [x] contribution drill-down UI
- [x] score explanation UI
- [x] badge and level UI
- [x] privacy controls UI
- [x] empty, loading, error, and stale states
- [x] mobile-responsive layout
- [x] accessibility baseline
- [x] analytics and event tracking plan

UX quality requirements:

- [x] avoid overstating score confidence
- [x] clearly distinguish inferred versus deterministic information
- [x] do not shame low-score contributors
- [x] make score explanations legible to non-experts

## 14. API and Contract Documentation Checklist

- [x] publish OpenAPI specs or equivalent
- [x] define JSON error format
- [x] define pagination format
- [x] define filtering and sorting conventions
- [x] define auth scheme
- [x] define idempotency expectations
- [x] define rate-limit headers if exposed
- [x] define webhook receiver contract if externalized
- [x] publish examples for main endpoints

## 15. Testing Strategy Checklist

Testing cannot be an afterthought in a scoring product.

Unit tests:

- [x] scoring helpers
- [x] config validation
- [x] auth flows
- [x] GitHub signature verification
- [x] parsing and normalization
- [x] AI output validation

Integration tests:

- [x] DB repositories
- [x] service HTTP handlers
- [x] queue workers
- [x] GitHub API client adapters
- [x] migration safety

Contract tests:

- [x] internal service contracts
- [x] API response compatibility
- [x] event schema compatibility

End-to-end tests:

- [ ] GitHub sign-in
- [ ] initial sync
- [ ] PR ingestion
- [ ] analysis
- [ ] score generation
- [ ] profile rendering

Specialized tests:

- [x] fuzz tests for parsers and webhook validation paths
- [ ] regression tests for scoring edge cases
- [ ] load tests for sync bursts
- [x] race detection in concurrent components
- [ ] failure injection for retries and backoffs

Release gate:

- [ ] no production release without automated tests on critical paths

## 16. Security Checklist

GitRank handles auth, user profile data, API integrations, and potentially sensitive contribution metadata. Security has to be built in from the start.

Repository security:

- [ ] enable dependency graph
- [ ] enable Dependabot alerts
- [x] add `dependabot.yml`
- [x] enable dependency review in pull requests
- [x] enable CodeQL code scanning
- [x] enable secret scanning where available
- [ ] protect the default branch or apply repository rulesets
- [ ] require pull request review before merge
- [ ] require status checks before merge
- [x] keep `CODEOWNERS`, but do not require CODEOWNERS approval in v1

Application security:

- [x] threat model the full system
- [ ] validate all external input
- [ ] constrain outbound network behavior where possible
- [ ] protect against SSRF in webhook or callback flows
- [x] encrypt secrets at rest
- [ ] rotate secrets safely
- [ ] separate prod and non-prod credentials
- [x] redact secrets from logs
- [x] define incident response flow
- [x] define vulnerability disclosure flow
- [x] define abuse and fraud response flow

Go-specific security:

- [x] run `govulncheck`
- [ ] audit unsafe or reflection-heavy code paths
- [x] avoid insecure random sources for secrets or nonces
- [x] use timeouts on network clients
- [x] avoid unbounded request bodies

Container and artifact security:

- [x] minimal runtime images
- [x] non-root containers
- [x] image scanning in CI
- [x] SBOM generation
- [x] artifact signing deferred until post-v1 hardening
- [x] provenance attestations deferred until post-v1 hardening

## 17. Supply Chain and Release Integrity Checklist

- [x] define build reproducibility goals
- [x] use an unsigned v1 release flow and defer signing
- [x] generate SBOMs for release artifacts
- [x] publish artifact checksums
- [x] do not require provenance metadata in v1
- [x] document trusted builders and release workflow
- [x] tag releases consistently
- [x] avoid manual untracked release steps

Target maturity:

- [x] align production release decisions with two-person review expectations
- [x] defer Sigstore or equivalent signing workflow until post-v1 hardening
- [x] measure repo hygiene with OpenSSF Scorecard or equivalent

## 18. Observability Checklist

Observability is required for trust and operations.

Logging:

- [x] structured logs
- [x] log correlation IDs
- [x] no raw secrets or tokens
- [x] clear service and component names

Metrics:

- [x] HTTP request counts and latency
- [x] queue depth
- [x] job retries
- [x] GitHub API rate-limit usage
- [x] sync duration
- [ ] analysis cost and token usage
- [x] score computation duration
- [x] cache hit rate
- [x] error rate by service

Tracing:

- [ ] distributed traces across gateway, ingestion, analysis, scoring, and profile services
- [ ] trace async job boundaries
- [ ] trace external GitHub and AI provider calls

Dashboards and alerts:

- [x] service health dashboards
- [x] error budget or SLO dashboards
- [x] alerts for sync backlog
- [x] alerts for webhook failures
- [x] alerts for auth failures
- [ ] alerts for elevated AI cost
- [ ] alerts for scoring job failures

## 19. Reliability and SRE Checklist

- [x] define SLOs and SLIs
- [x] define RTO and RPO expectations
- [x] add graceful shutdown to all services
- [ ] ensure idempotent retries
- [x] define backpressure behavior
- [ ] add circuit breaker or equivalent protections where needed
- [x] define degraded-mode behavior if AI provider is unavailable
- [x] define degraded-mode behavior if GitHub API is rate-limited
- [x] create runbooks for common failure modes
- [ ] add chaos or fault-injection tests for critical paths

## 20. Performance and Scalability Checklist

- [ ] benchmark ingestion throughput
- [ ] benchmark scoring throughput
- [ ] benchmark profile read latency
- [ ] batch GitHub API calls where possible
- [ ] cache stable repository metadata
- [ ] avoid N+1 query patterns
- [ ] tune DB indexes against real query shapes
- [x] plan for backfills at scale
- [x] plan for horizontal worker scaling
- [x] cap AI cost per PR or per sync run

## 21. Privacy, Data Handling, and Compliance Checklist

GitRank may expose reputational data about real people. That increases the standard.

- [x] define exactly what user data is stored
- [x] define legal basis and privacy posture for public GitHub data usage
- [x] define deletion and account removal flow
- [x] define retention windows
- [x] define whether raw PR diffs are stored or re-fetched
- [x] define whether AI providers receive raw code snippets or summaries only
- [x] minimize transmitted and retained data
- [x] let users understand what data powers their score
- [x] let users request re-sync or deletion
- [x] document privacy limitations clearly
- [x] document known fairness limitations clearly

## 22. Deployment and Infrastructure Checklist

- [x] choose cloud or self-host baseline
- [x] choose runtime packaging strategy
- [ ] add IaC
- [x] define dev, staging, and prod environments
- [x] define environment promotion process
- [x] define secret management system
- [x] define database backup automation
- [x] define restore drills
- [x] define TLS termination model
- [x] define DNS and domain ownership
- [x] define rollout strategy
- [x] define rollback strategy
- [x] define zero-downtime migration strategy
- [x] define cost monitoring and budget alerts

Deployment assets to add:

- [x] `gitrank/deployments/compose/` for local stack
- [x] `gitrank/deployments/k8s/` or equivalent if Kubernetes is chosen
- [ ] CI deployment workflows
- [x] environment sample files

## 23. CI/CD Checklist

- [x] run formatting checks
- [x] run linting
- [x] run unit tests
- [x] run integration tests
- [x] run `go test -race` where feasible
- [x] run `govulncheck`
- [x] run dependency review
- [x] run CodeQL
- [x] run secret scanning or equivalent checks
- [x] run container or filesystem vulnerability scans
- [x] build artifacts in CI
- [x] use an unsigned v1 release flow and defer signing
- [ ] enforce required checks before merge
- [ ] prevent direct pushes to protected branches

## 24. Documentation Checklist

- [x] keep `README.md` current
- [x] keep this file current
- [x] add architecture docs
- [x] add data model docs
- [x] add scoring docs
- [x] add threat model docs
- [x] add runbooks
- [x] add onboarding guide
- [x] add local setup guide
- [x] add release guide
- [x] add troubleshooting guide
- [x] add glossary for product and scoring terms

## 25. Product Analytics and Feedback Checklist

- [x] define what usage analytics are collected
- [x] define opt-in or opt-out policy where needed
- [ ] track onboarding completion
- [ ] track sync success rate
- [ ] track profile view behavior
- [ ] track score explanation usage
- [ ] track badge engagement carefully
- [x] avoid collecting more analytics than needed
- [x] define feedback loop for incorrect scores or classifications

## 26. Abuse Prevention Checklist

GitRank must assume users will try to optimize for score.

- [x] define anti-spam detection rules
- [x] detect micro-PR farming
- [x] detect cosmetic change inflation
- [x] detect mass low-value repository targeting
- [x] discount repetitive low-signal contribution patterns
- [ ] monitor suspicious self-merge patterns
- [x] decide how to treat bot-generated contributions
- [x] decide how to treat organization-internal review loops
- [x] decide how to treat repository ownership conflicts of interest
- [x] create moderation paths for abuse cases

## 27. Open Questions That Must Be Settled Before Production

- [x] Should GitRank use GitHub App installation auth, OAuth, or both?
- [x] Are private repositories supported, and if so under what privacy guarantees?
- [x] Will the product store diff hunks, file contents, summaries, or only derived features?
- [x] How much raw code is allowed to be sent to AI providers?
- [x] Are scores public by default or opt-in?
- [x] How are score corrections communicated after formula changes?
- [x] How are contributors protected from misleading over-interpretation of scores?
- [x] What is the minimum confidence threshold before GitRank makes a skill claim?
- [x] Does GitRank rank people globally, by language, by domain, or not at all?
- [x] How will the system avoid favoring contributors who target only high-star repositories?

Answered scope decisions:

- GitRank uses GitHub OAuth only in v1, with GitHub App support deferred to a future upgrade.
- Private repositories are not supported for scoring in v1.
- Public organization-owned repositories are supported and treated normally.
- GitRank stores derived features by default, may use bounded public diff excerpts when needed, and does not store full repository file contents in v1.
- GitRank may send only bounded public PR diff hunks and related metadata to AI providers; private code is out of scope.
- Public scores and global leaderboard participation are enabled by default for signed-in users.
- Formula-version changes should be communicated through visible score/version context and normal recomputation, not hidden manual edits.
- Contributors are protected through visible explanations, conservative wording, stale indicators, and no hidden score overrides.
- Strong skill claims require deterministic corroboration, and AI-assisted claim wording should stay at or above the documented confidence threshold.
- GitRank uses a public global leaderboard in v1.
- Repository bonus is capped so high-star repositories do not dominate scoring.
- Self-merged pull requests are excluded from scoring.
- Bot-authored and bot-assisted pull requests are excluded from scoring.

## Recommended Build Order

The safest order for production work is:

1. Repository governance and security baseline
2. Config, logging, errors, and contracts
3. DB schema and migration tooling
4. Auth and GitHub integration skeleton
5. Ingestion pipeline
6. Deterministic PR feature extraction
7. Scoring engine v1
8. Profile read models
9. Dashboard and public profile UI
10. AI enrichment, fairness tuning, and scale hardening

## Minimum Definition of "Public Alpha"

Do not call the project public alpha until these are done:

- [x] users can sign in with GitHub
- [ ] at least one full sync path works end to end
- [x] webhook validation is implemented
- [x] PR data is persisted with migrations
- [x] one deterministic scoring path works
- [x] profile pages render real data
- [x] CI runs tests and security checks
- [x] `SECURITY.md`, issue templates, PR template, and CODEOWNERS exist
- [x] basic observability exists
- [x] the README and this file match reality

## Minimum Definition of "Production Ready"

Do not call the project production ready until:

- [ ] critical paths are covered by automated tests
- [ ] default branch protections or rulesets are enforced
- [x] security scanning is active
- [x] dependency review is enforced on PRs
- [ ] webhook ingestion is reliable and idempotent
- [ ] GitHub rate-limit handling is proven
- [x] AI outputs are validated and bounded
- [x] score explanations are user-visible
- [x] deletion and retention policies exist
- [x] dashboards, alerts, and runbooks exist
- [x] the unsigned v1 release flow is traceable
- [ ] rollback procedures are documented and tested
- [x] at least two-person review is required for production release decisions

## Suggested Early Issues

High-value issues to open next:

- [x] Add `LICENSE`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, issue templates, PR template, and `CODEOWNERS`
- [x] Add shared config and logging packages
- [x] Add API error envelope contract
- [x] Add database migration framework
- [x] Add GitHub webhook signature verification middleware
- [x] Add GitHub client package with retry and rate-limit helpers
- [x] Add first schema for users, GitHub accounts, repositories, and pull requests
- [x] Add queue abstraction and worker bootstrap
- [x] Add CI for tests, `govulncheck`, CodeQL, dependency review, and secret scanning
- [x] Add `docs/scoring-model.md`

## Maintainer Rule

If reality changes, update this file in the same PR.

That includes:

- architecture changes
- production readiness changes
- new shortcuts or temporary compromises
- new required contributor workflows

## External References

These official references were checked while preparing this document on May 5, 2026:

- GitHub contributor guidelines: https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/setting-guidelines-for-repository-contributors
- GitHub issue and PR templates: https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/about-issue-and-pull-request-templates
- GitHub CODEOWNERS: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners
- GitHub security policy: https://docs.github.com/en/enterprise-cloud@latest/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/adding-a-security-policy-to-your-repository
- GitHub dependency review: https://docs.github.com/en/code-security/concepts/supply-chain-security/about-dependency-review
- GitHub CodeQL default setup: https://docs.github.com/en/code-security/how-tos/find-and-fix-code-vulnerabilities/configure-code-scanning/configuring-default-setup-for-code-scanning
- GitHub secret scanning: https://docs.github.com/en/code-security/secret-scanning/introduction/about-secret-scanning
- GitHub webhook validation: https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
- GitHub GraphQL rate limits: https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api
- Go workspaces and modules: https://go.dev/ref/mod
- Go `govulncheck`: https://go.dev/doc/tutorial/govulncheck
- Go fuzzing: https://go.dev/doc/security/fuzz/
- OpenTelemetry Go instrumentation: https://opentelemetry.io/docs/languages/go/instrumentation/
- Sigstore: https://docs.sigstore.dev/
- SLSA source requirements: https://slsa.dev/spec/v1.2/source-requirements
- OpenSSF Scorecard: https://github.com/ossf/scorecard
