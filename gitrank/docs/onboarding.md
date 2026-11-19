# Contributor Onboarding

## Product Aim

GitRank turns public GitHub contribution evidence into an explainable reputation
profile. Its central question is how meaningful a contribution was: what changed,
which engineering skills it exercised, how it was reviewed, and what outcome it
reached. XP, ranks, badges, and quests make that evidence easier to follow and give
contributors a reason to return.

The intended audiences have different needs:

| Audience | Product value |
| --- | --- |
| Contributors and students | Understand past work, see progress, and find a useful next contribution goal. |
| Maintainers | Inspect contribution and review evidence behind a contributor's reputation. |
| Recruiters and mentors | Follow public proof of work and understand the scope and uncertainty of skill signals. |

The product loop is connect GitHub, sync evidence, inspect PR reports, reveal
progress, pursue quests, and share a public profile. Scores describe the evidence
GitRank has observed; they cannot establish absolute engineering ability. See
[fairness and limitations](./fairness-and-limitations.md) for claim boundaries.

## Read First

1. [Root README](../../README.md) for the local MVP and startup path.
2. [CONTRIBUTING](../../CONTRIBUTING.md) for product rules and readiness tracking.
3. [Production decisions](./production-decision-register.md) for frozen policy.
4. [Architecture](./architecture.md) for service and persistence boundaries.
5. [Scoring model](./scoring-model.md) for scoring intent and explainability.

## Runtime Ownership

The frontend is a Next.js App Router application. The backend is a Go workspace
with seven services sharing PostgreSQL evidence and read models. Redis supports
profile caching; scheduler execution uses its own PostgreSQL-backed state.

| Area | Responsibility | Implementation entry |
| --- | --- | --- |
| Frontend | Marketing, onboarding, dashboard, contributions, badges, quests, leaderboard, public profiles, and PR reports | [Routes](../../frontend/app), [features](../../frontend/features), and [API adapters](../../frontend/lib/api) |
| API gateway | Authenticated API edge, proxying, sync ownership, and post-sync refresh orchestration | [Router](../services/api-gateway/internal/httpapi/router.go) and [sync flow](../services/api-gateway/internal/httpapi/sync.go) |
| Auth service | OAuth identity linking, session lifecycle, CSRF validation, unlinking, and deletion | [Service](../services/auth-service/internal/service/service.go) |
| GitHub ingestor | App-authenticated extraction, webhook intake, bounded discovery, entity persistence, and sync diagnostics | [Executor](../services/github-ingestor/internal/service/executor.go) and [store](../services/github-ingestor/internal/service/store.go) |
| PR analyzer | Deterministic classification and feature extraction, optional AI summary, and analysis persistence | [Analyzer](../services/pr-analyzer/internal/analyzer/analyzer.go) and [store](../services/pr-analyzer/internal/analyzer/store.go) |
| Scoring engine | Versioned formula, historical replay, skill XP, and evidence-linked badge awards | [Formula](../services/scoring-engine/internal/scoring/engine.go) and [replay](../services/scoring-engine/internal/service/service.go) |
| Profile service | Profile snapshots, public/private projections, reports, quests, and leaderboard seasons | [Service](../services/profile-service/internal/service/service.go), [reports](../services/profile-service/internal/service/reports.go), and [quests](../services/profile-service/internal/service/quests.go) |
| Scheduler worker | Explicit jobs, leases, retries, dead letters, repair, and grading orchestration | [Runner](../services/scheduler-worker/internal/service/runner.go) and [durable state](../services/scheduler-worker/internal/service/state_store.go) |

Shared request and response shapes live in [contracts](../packages/contracts).
Runtime policy lives in [config](../packages/config). Database changes live in
[migrations](../deployments/migrations).

## Trace These Flows

### Identity and Browser Requests

Browser auth routes proxy to the auth service. Product API routes proxy through
the gateway, forwarding session cookies and CSRF headers. The frontend route
proxy checks cookie presence for navigation; backend session validation remains
the authorization boundary. Start at [auth proxy](../../frontend/lib/api/auth-server.ts),
[gateway proxy](../../frontend/lib/api/gateway-server.ts), and
[gateway auth](../services/api-gateway/internal/httpapi/auth.go).

OAuth supplies identity and account linking. PR and repository extraction
requires GitHub App installation tokens and fails closed without them. App
installation visibility also bounds the evidence available to a sync.

### Dashboard User Sync

The dashboard auto-sync coordinator and account refresh action call
`/api/sync/user`, which forwards to `/v1/sync/user/execute`.

1. The gateway replaces the requested user with the authenticated GitHub login.
2. The ingestor resolves App credentials, acquires a user sync lease, discovers a
   bounded authored-PR window, and persists PR and file evidence.
3. The gateway requests score replay, profile refresh, PR report backfill, and
   quest backfill, recording diagnostics for each step.
4. Frontend query invalidation and polling refresh the visible evidence state.

This path does not invoke the PR analyzer. Its PR hydration explicitly skips
reviews and review comments. Replay can use existing analysis and review rows;
when analysis is absent, it derives score inputs from stored PR/file evidence
and defaults the category to `feature`. A completed extraction is therefore not
proof that full analysis and review evidence exist.

### Full PR Grading

The scheduler's `pipeline.grade_pull_request` job takes a known user and PR
through PR sync, persisted analysis, user score replay, profile refresh, report
materialization, and report readback. Follow `executePullRequestGradeJob` in the
[runner](../services/scheduler-worker/internal/service/runner.go).

Queued admission is a separate boundary. The ingestor's webhook and queued-sync
routes currently enqueue into an ingestor-owned in-memory queue. The scheduler
has its own durable queue and explicit admission routes. These are separate
objects in separate processes; the current ingestor route does not forward its
queue to the scheduler. Trace [ingestor admission](../services/github-ingestor/internal/httpapi/router.go)
before claiming an accepted queued request will execute through the durable
scheduler. Domain event contracts alone do not provide that connection.

## Evidence Authority

| Stored layer | Meaning |
| --- | --- |
| GitHub entities, PR files, reviews, and comments | Normalized source evidence used for replay and inspection. |
| Contribution analyses | Persisted classification, confidence, narrative, and analyzer provenance. |
| Score events and replay runs | Versioned contribution decisions, formula components, and replay history. |
| Profile snapshots | Rebuildable aggregates served by profile reads. |
| Quest assignments, completions, and reward grants | Evidence-linked progression; XP grants become separate `quest.reward` score events. |
| Leaderboard season snapshots and movement events | Persisted ranking observations with version and freshness metadata. |

The scoring engine owns final contribution XP. The analyzer's optional AI path
changes summary text; deterministic code chooses category, depth, review strength,
and skills. The frontend also has a separate server-side
[ABRA narrative path](../../frontend/lib/ai/abra-insights.ts) for identity summaries,
contribution narratives, badge stories, and skill explanations. Neither AI path
persists final XP.

Profile totals include the selected replay plus quest rewards. A PR contribution
card must retain its canonical PR award instead of absorbing a linked quest
reward. Missing, partial, stale, and deterministic-only evidence states are part
of the product contract and must remain visible.

## Current Boundaries To Check

These observations describe the reviewed implementation, not additional policy:

- Discovery is bounded and incremental. A sync is not an exhaustive audit of a
  person's public GitHub history.
- The replay query filters public repositories and linked authors. It does not
  itself require merged PRs or exclude bot-assisted work. Replay separately
  assigns zero XP to detected self-merges. Verify policy enforcement end to end
  before treating every documented eligibility gate as implemented.
- Report test-signal, difficulty, and impact meters use deterministic heuristics.
  Changed test-file counts and text signals do not establish measured test
  coverage or proven production impact.
- Leaderboard seasons use weekly windows, while candidate ordering uses total
  profile XP. A weekly season does not imply weekly-only XP scoring or automated
  promotion and demotion.
- Public profile and repository visibility settings, public PR reports, and
  leaderboard visibility have separate read paths. Check each affected reader
  when changing privacy behavior.
- Local tests and committed Kubernetes/observability assets do not establish
  live production readiness. Remaining operational evidence is tracked in the
  [live gates](./releases/v2-remaining-live-gates.md); older status snapshots there
  require fresh verification before being treated as current.

## Setup

Follow the [root local run guide](../../README.md#local-run-recommended) for the
complete stack. It uses one backend env file for backend and frontend runtime.
The local startup script manages processes and containers, so read it before
running it against an existing stack.

Backend-only commands run from the `gitrank/` workspace. Use `make test` for the
module tests and `make test-critical-path-flows` for the database-backed flow
suite. Individual integration tests skip when their service-specific test
database URL is absent; a passing unit run alone does not verify persistence.

## Where To Start

- UI behavior: follow route, query hook, API adapter, BFF route, and gateway.
- Scoring: follow persisted PR evidence, analysis, replay candidates, formula,
  score-event writes, profile projection, and report rendering.
- Async behavior: follow admission, queue ownership, durable state, lease,
  execution, retry classification, and terminal diagnostics.
- Privacy or persistence: inspect every writer and public/private reader before
  changing the schema or visibility rules.

## First Contribution Advice

- prefer bounded changes
- avoid changing scoring and storage in the same PR unless necessary
- update docs whenever behavior changes
