# Contributing to GitRank

Last reviewed: May 23, 2026

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

## Research Baseline (GitRanking Paper)

Source reviewed: `gitrank_research .pdf` (local paper copy), reviewed on May 24, 2026.

The paper this project name is inspired by is:

- `GitRanking: A Ranking of GitHub Topics for Software Classification using Active Sampling`

Paper scope (what it actually does):

- ranks GitHub topic terms by general-to-specific meaning (topic taxonomy), not developers
- starts from ~121K scraped GitHub topics and filters/ranks into 301 application-domain topics
- applies active pairwise sampling (ASAP) + TrueSkill ranking with Wikidata linking to reduce ambiguity
- converges ranking with ~5,281 annotated pairs from 8 annotators (instead of exhaustive full-pair comparisons)
- clusters ranked terms into 8 discrete levels
- finds developers overuse broad/high-level labels, reducing project discoverability
- targets project discoverability/label quality, not human contributor competency ranking

What this means for GitRank product work in this repo:

- GitRank is an extension, not a copy: we score contributor evidence (PR/review/repo signals), not topic labels alone
- keep skill/category signals explicit and bounded; never collapse unrelated dimensions into one opaque number
- keep claims calibrated: profile language must communicate uncertainty and evidence scope
- deterministic scoring and provenance remain the trust anchor; AI is enrichment, never score authority

Research-derived engineering guardrails (treat as policy memory):

- avoid fake certainty from sparse data (`low evidence` must stay visible in UI and report payloads)
- preserve extensibility: new skill lanes/categories must be schema-versioned and validation-backed
- keep classification explainable: each score change should map to inspectable evidence and rule version
- treat ambiguity as first-class: normalize labels/signals before aggregation; do not silently merge near-duplicates

Research memory lock (do not regress this interpretation):

- GitRanking paper validates topic-taxonomy ranking quality, not contributor skill scoring quality.
- Paper dataset/ranking constants to preserve in project memory:
  - initial scrape: ~121K GitHub topics (paper figure references ~130K raw before filtering)
  - frequent-topic seed: top 60% by frequency
  - post-linking taxonomy size: 301 topics (after dedupe/reconciliation)
  - annotation scale: 5,281 pairwise comparisons from 8 annotators
  - hierarchy output: 8 discrete general-to-specific levels
- Product implication: do not over-claim "research-proven developer ranking" in UI or docs.
  Keep wording constrained to evidence-backed PR scoring in this repo’s own deterministic model.

Contributor memory checkpoint:

- Before changing ranking language, scoring explanation copy, or claim wording,
  re-check this section first and keep product claims bounded to persisted
  evidence in this codebase.

## Current Repository Status

The repository is past the pure scaffold stage, but it is not production-ready.

Current state:

- [x] Top-level repository README exists.
- [x] Detailed project README exists at `gitrank/README.md`.
- [x] Go workspace exists at `gitrank/go.work`.
- [x] Core service modules are scaffolded.
- [x] Shared package modules are scaffolded.
- [x] Business logic exists for auth, webhook intake, deterministic PR analysis, scoring, and live frontend product flows.
- [x] API contracts are implemented.
- [x] Database schema exists.
- [x] Migrations exist.
- [x] Tests exist.
- [x] CI exists.
- [x] Security policy exists.
- [x] Code ownership rules exist.
- [x] Issue or PR templates exist.
- [x] Deployment manifests exist.
- [x] Production observability exists.
- [x] Release process exists.
- [x] Frozen v1 production decision register exists.
- [x] Maintainer guide exists.
- [x] DCO enforcement workflow exists.

Production observability assets are committed and locally verifiable (`make verify-observability-manifests`), while live deployment and traffic validation remain required in the V2 operational checklist (`Deploy and verify production observability against real traffic ...`).

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

## Frontend No-Slowdown Rules (Required)

Any UI change must preserve responsiveness on low-end laptops and avoid adding
runtime-heavy effects.

Required guardrails:

- Keep animation minimal on product routes (`/dashboard`, `/contributions`, `/badges`, `/quests`, `/settings`, `/leaderboard`).
- Avoid continuous/repeating motion loops in core layouts, cards, tables, and nav surfaces.
- Prefer static visuals over runtime visual effects (for example heavy blur stacks, multi-layer glow animations, and JS-driven parallax).
- Use transitions only for state clarity; keep them short and limited to `opacity` and `transform` when possible.
- Do not block first meaningful render on optional data. Non-critical enrichments (AI summaries, secondary panels, decorative stats) must degrade gracefully.
- Keep contribution/profile payloads bounded; do not remove the recent-history cap without performance evidence and a fallback strategy.
- Avoid production polling loops that can amplify CPU/network load. Use event-driven updates or conservative intervals when background refresh is required.
- Never re-introduce mock adapters into production frontend data paths.
- Use manual keyboard activation for rendering-heavy segmented filters (`Arrow` keys move focus; `Enter`/`Space` applies) to prevent accidental high-cost rerenders while preserving ARIA tab accessibility.

Frontend PR verification (required before merge):

```bash
cd frontend
npm run lint
npm run build
npm run check:no-production-mocks
npm run test:smoke
```

If a PR touches rendering-heavy components, include a short before/after note in
the PR description describing expected UX/performance impact.

Recent no-slowdown refinement (May 22, 2026):

- Dashboard top chrome was simplified to remove always-on display quick-switch controls from the primary nav surface.
- Theme/text/effect toggles remain available in Settings and onboarding, reducing routine dashboard UI noise and interaction cost.

Recent no-slowdown refinement (May 24, 2026):

- Dashboard route pages now share `stable-scroll-scope` so segmented filters do not yank viewport position when tabs/filters update.
- `SegmentedTablist` restores viewport using microtask + bounded timeout replay (no `requestAnimationFrame`), satisfying `npm run check:main-thread`.
- Header meta chips on small screens are now horizontal rails instead of multi-line wraps, reducing header bloat and preserving actionable content density.
- Dashboard nav rails use thin visible scrollbars (instead of hidden scrollbars) to improve discoverability of horizontal navigation overflow.
- Background image visibility was increased with softer dark overlays and lower shell-glow opacity to keep text readable while preserving the cyberpunk visual layer.

## Frontend Excellence Checklist (No-Slowdown Backlog)

Use this as the master frontend refinement backlog. Keep improvements aligned
with the no-slowdown rules above.

ABRA checklist intake note (May 17, 2026):

- This section is checklist-first by default.
- Treat unchecked items as planning gates until explicitly promoted into implementation.
- Checked items require file-level evidence plus verification commands.
- Do not mark items complete without file-level evidence and verification steps.

Baseline references for this section:

- `frontend/docs/frontend-excellence.md`
- `frontend/docs/ux-changelog.md`
- `frontend/docs/performance-and-observability.md`
- https://nextjs.org/docs/app/guides/production-checklist
- https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
- https://web.dev/articles/defining-core-web-vitals-thresholds
- https://web.dev/articles/vitals
- https://web.dev/articles/optimize-cls
- https://owasp.org/www-project-secure-headers/
- https://almanac.httparchive.org/en/2025/performance

Cyberpunk inspiration references (style direction only, no copy-paste):

- https://github.com/cyberpunk-ui
- https://gist.github.com/bo0ts/3723433

Inspiration usage rule:

- Extract palette/mood/layout language only (contrast, hierarchy, accent strategy, typography vibe).
- Re-implement with GitRank tokens/components and accessibility/performance rules.
- Do not copy source CSS/theme files or component markup verbatim.

### A. Product Direction and UX

- [x] Define 3 primary user journeys (new user onboarding, returning contributor, profile sharing).
- [x] For each journey, define one clear success moment (for example: first synced PR shown, first badge earned, public profile shared).
- [x] Remove dead-end screens; every page should have a clear next action.
- [x] Ensure empty states always show recovery paths (sync, retry, navigate, docs).
- [x] Ensure stale states are visible and understandable (last refresh time + what to do next).
- [x] Use bounded automatic authenticated-route sync instead of a manual "Sync now" button dependency; surface stale/partial states while auto-refresh runs.

### B. Design System and Visual Consistency

- [x] Create a single design token layer (color, spacing, radius, shadow, motion, z-index).
- [x] Standardize typography scale (display, heading, body, caption) and line-height rules.
- [x] Standardize corner radius scale across all surfaces (cards, buttons, modals, inputs).
- [x] Standardize glow/neon intensity levels (subtle, medium, hero) to avoid visual noise.
- [x] Standardize icon sizes and stroke weight.
- [x] Ensure all components support light-content-on-dark contrast without readability loss.
- [x] Create component-state spec: default, hover, focus, active, disabled, loading, error.

### C. Information Architecture and Navigation

- [x] Validate sidebar and mobile nav use identical route semantics.
- [x] Ensure route naming is user-language, not backend-language.
- [x] Add consistent page header structure: title, purpose sentence, key action(s).
- [x] Ensure deep links work for shareable views (profile, PR report, leaderboard states).
- [x] Add route-level 404 and global not-found UX consistency.

### D. Accessibility (WCAG 2.2 aligned)

- [x] Ensure keyboard focus is always visible on interactive elements.
- [x] Ensure pointer targets are at least 24x24 CSS px where required.
- [x] Validate color contrast for text and non-text UI indicators.
- [x] Ensure meaningful accessible names/labels on all controls.
- [x] Ensure form errors are announced clearly and linked to specific inputs.
- [x] Ensure auth flows avoid cognitive-only challenges where possible.
- [x] Respect reduced-motion preferences (`prefers-reduced-motion`) globally.
- [x] Use ARIA APG patterns for tabs, dialogs, menus, and custom widgets.

### E. Motion, Interactions, and Gamification Polish

- [x] Keep motion purposeful: state change, hierarchy reveal, feedback.
- [x] Remove decorative motion that does not communicate state.
- [x] Cap animation duration and easing consistency across the app.
- [x] Ensure animated progress (XP bars, streaks) has static text equivalent.
- [x] Ensure leaderboard/badge effects degrade cleanly when reduced motion is on.
- [x] Add micro-feedback on meaningful actions (sync complete, badge unlocked, share copied).

### F. Performance and Core Web Vitals

- [x] Set CWV budgets: p75 LCP <= 2.5s, INP <= 200ms, CLS <= 0.1.
- [x] Track field CWV (not lab-only) and report by route group.
- [x] Add width/height or aspect-ratio for all media to prevent CLS.
- [x] Audit fonts for layout-shift risk and loading behavior.
- [x] Defer non-critical scripts and reduce third-party JS overhead.
- [x] Avoid long main-thread tasks that hurt INP.
- [x] Keep heavy interactions smooth on secondary pages, not only homepage.

### G. Next.js Production Hardening

- [x] Use `next build` + `next start` as pre-release baseline checks.
- [x] Run Lighthouse in incognito and compare with field data.
- [x] Use `next/image`, `next/font`, and `next/script` best practices consistently.
- [x] Add or maintain global error UI and global 404 UI.
- [x] Confirm caching strategy per route/data fetch (avoid accidental dynamic overuse).
- [x] Run bundle analysis and trim oversized dependencies/chunks.
- [x] Keep server-only boundaries strict for sensitive code/data.

### H. Security and Privacy UX Layer

- [x] Enforce CSP with report-only rollout first, then enforce.
- [x] Add or verify secure browser headers policy for frontend responses.
- [x] Ensure no secrets leak through client payloads or public env vars.
- [x] Ensure auth/session actions have explicit user feedback and safe failure states.
- [x] Ensure analytics payloads are bounded and exclude sensitive data.

### I. SEO, Social, and Shareability

- [x] Use Metadata API on all major routes.
- [x] Ensure OG/Twitter image coverage for profile and marketing routes.
- [x] Ensure sitemap and robots are valid and current.
- [x] Ensure share cards are visually consistent with in-app identity framing.
- [x] Validate canonical URLs for public profile and PR report pages.

### J. Quality Engineering and Regression Safety

- [x] Add route-level visual regression checks for key pages.
- [x] Add accessibility CI checks (axe/Pa11y/Lighthouse accessibility).
- [x] Expand smoke tests to include sync/stale/error state transitions.
- [x] Add contract tests for BFF route mappings to backend endpoints.
- [x] Add performance CI budgets (bundle size plus selected Lighthouse/CWV guards).

### K. Observability for Frontend UX

- [x] Instrument key product events (onboarding, sync, score explanation, badge view, share).
- [x] Add route-level error-rate dashboards.
- [x] Track stale-profile incidence and sync retry outcomes.
- [x] Track no-data or empty-state frequency per page.

### L. Delivery Discipline

- [x] Create a prioritized 30/60/90 day roadmap (critical, important, polish).
- [x] Run a weekly refinement loop with before/after screenshots and metric diffs.
- [x] Keep a changelog of UX-impacting frontend decisions.

Verification snapshot (May 17, 2026):

- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `cd frontend && npm run start -- --port 4111`
- `cd frontend && npm run test:smoke`
- `cd frontend && npm run test:visual`
- `cd frontend && npm run test:a11y`
- `cd frontend && npm run test:contracts`
- `cd frontend && npm run check:no-production-mocks`
- `cd frontend && npm run check:client-env-safety`
- `cd frontend && npm run check:server-boundaries`
- `cd frontend && npm run check:cache-strategy`
- `cd frontend && npm run check:contrast`
- `cd frontend && npm run check:media-stability`
- `cd frontend && npm run check:main-thread`
- `cd frontend && npm run check:perf-budgets`
- `cd frontend && npm run analyze:bundle`
- `cd frontend && npx lighthouse http://localhost:4113/ --chrome-flags='--headless --incognito --no-sandbox --disable-gpu --disable-software-rasterizer --disable-dev-shm-usage' --output=json --output-path=docs/evidence/weekly-2026-05-17/lighthouse-home.json`
- `cd frontend && npx playwright screenshot --full-page http://localhost:4113/dashboard docs/evidence/weekly-2026-05-17/playwright-dashboard.png`
- Weekly screenshot and metric-diff evidence is recorded in `frontend/docs/evidence/weekly-2026-05-17/README.md`.

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
make -C gitrank test
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
- [x] queue-based backfill jobs
- [x] repository sync logic
- [x] pull request sync logic
- [x] review sync logic
- [x] issue and label sync logic
- [x] commit metadata sync logic
- [x] normalized persistence layer
- [x] dead-letter handling for poison jobs

GitHub-specific requirements:

- [x] verify webhook payloads before processing
- [x] record GitHub delivery IDs for idempotency
- [x] document and request the minimum OAuth scopes needed in v1
- [x] support re-sync after missed webhooks
- [x] support historical backfill without double-counting
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
- `POST /v1/sync/user/execute` now performs a bounded live user sync by walking recent public repositories owned by the requested GitHub login, discovering recent authored public PRs through GitHub issue/PR search, and delegating concrete repositories and PRs to the existing repository and PR executors
- `POST /v1/sync/installation/execute` now prefers live GitHub App installation repository inventory plus installation-token-authenticated repository sync when App credentials are configured, and falls back to persisted installation-repository associations when App auth is unavailable
- `POST /v1/sync/pull-request/execute` now performs a bounded live pull-request sync and persists the PR, bounded changed-file metadata, public patch excerpts, reviews, and review comments directly
- `POST /v1/sync/review/execute` now performs a bounded live review sync by refreshing the review surface for one PR number and persisting bounded changed-file metadata, public patch excerpts, reviews, and review comments directly
- `POST /v1/sync/issue/execute` now performs a bounded live issue sync and persists one standalone issue plus its labels directly
- `POST /v1/sync/commit/execute` now performs a bounded live commit sync and persists one public commit directly
- manual sync requests also persist queued sync-run records and are queryable by user, repository, subject, requester, correlation ID, and delivery ID
- scheduler-worker queue jobs, dead letters, recurring backfill plans, rate-limit windows, and scheduler counters now persist in dedicated PostgreSQL tables when `DATABASE_URL` is configured, survive process restarts, and serialize leases, ticks, plan updates, and queue mutations across scheduler instances
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
- the worker-mode scheduler process can execute bounded `sync.installation`, `sync.repository`, `sync.user_history`, `sync.pull_request`, `sync.review`, `sync.issue`, and `sync.commit` jobs through `github-ingestor`, with completion, retry, and dead-letter behavior surfaced on the scheduler queue
- bounded installation execution now supports live GitHub App installation repository discovery and installation-token-authenticated repository sync when App credentials are configured, with persisted installation repositories as fallback
- bounded user execution currently means recent public owned repositories plus recent public authored PRs discoverable through GitHub issue/PR search, not a full GitHub-wide historical contribution backfill
- bounded review execution currently means "refresh the reviews and review comments for one PR number", not a review-id-specific sync
- manual worker execution is exposed through `POST /v1/jobs/run-once`
- queue jobs, dead letters, recurring plans, rate-limit windows, and scheduler counters persist in dedicated PostgreSQL tables when `DATABASE_URL` is configured, and persistent mode serializes multi-instance leases, ticks, and control-plane mutations through the shared counters row
- the legacy `scheduler_runtime_states` JSONB snapshot table is now only a compatibility import path for pre-normalized scheduler state

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

The repo now contains a tracked Next.js frontend with root-level frontend CI plus repo-wide secret and Trivy scanning. Public profile reads plus authenticated dashboard, badge, contribution, leaderboard, settings, sync, disconnect, account-deletion, quest recommendation, and PR battle-report flows are live. The frontend also has season/rank progression presentation, player-card public profiles, quest recommendation evidence, badge rarity styling, PR battle-report explanation panels, and an account-backed reduced-gamification display preference for signed-in users. Production app routes no longer include demo preview modes; remaining sample data is isolated to marketing, tests, or fixtures.

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
- [x] season leaderboard and rank-progress UI
- [x] profile player-card UI
- [x] quest panel recommendation evidence
- [x] reduced-gamification display preference
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

- [x] GitHub sign-in
- [x] initial sync
- [x] PR ingestion
- [x] analysis
- [x] score generation
- [x] profile rendering

These are covered by local critical-path flow tests, not a live browser test against GitHub production OAuth. `make test-critical-path-flows` starts a temporary PostgreSQL container, applies migrations, and runs the targeted OAuth, sync, ingestion, analysis, scoring, and profile tests used by the CI release gate.

Specialized tests:

- [x] fuzz tests for parsers and webhook validation paths
- [x] regression tests for scoring edge cases
- [x] load tests for sync bursts
- [x] race detection in concurrent components
- [x] failure injection for retries and backoffs

Release gate:

- [x] no production release without automated tests on critical paths

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

Apply live GitHub repository-admin controls with `gitrank/docs/runbooks/github-repository-controls.md`, either through GitHub settings or `make apply-github-repository-controls`, then verify them with `make verify-github-repository-controls`. Use `make discover-github-required-status-checks` to fetch current check names before applying branch rules. The verifier proves either branch-protection or branch-ruleset enforcement, and these boxes must stay unchecked until the live GitHub settings are applied and verified against the actual repository.
When no static admin token or GitHub App credentials are available, opt in to
OAuth web-flow token bootstrap by setting
`GITRANK_ALLOW_OAUTH_WEB_TOKEN_BOOTSTRAP=yes` on apply/verify commands.
Once credentials and observability endpoints are available, `make -C gitrank verify-and-mark-live-external-gates` can run both live verifiers and mark the related external-live checklist items in this file automatically.

Application security:

- [x] threat model the full system
- [x] validate all external input
- [x] constrain outbound network behavior where possible
- [x] protect against SSRF in webhook or callback flows
- [x] encrypt secrets at rest
- [x] rotate secrets safely
- [x] separate prod and non-prod credentials
- [x] redact secrets from logs
- [x] define incident response flow
- [x] define vulnerability disclosure flow
- [x] define abuse and fraud response flow

Staging and production ExternalSecret examples use distinct remote secret-manager paths and are checked by `make verify-secret-policy`. Auth/session and GitHub OAuth token-encryption material now support current-plus-previous key rings through `GITRANK_PREVIOUS_SESSION_SECRETS` and `GITHUB_PREVIOUS_TOKEN_ENCRYPTION_KEYS`; live rotation rehearsals still need to be recorded in maintainer operations notes before production launch.

Go-specific security:

- [x] run `govulncheck`
- [x] audit unsafe or reflection-heavy code paths
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
- [x] analysis cost and token usage
- [x] score computation duration
- [x] cache hit rate
- [x] error rate by service

Tracing:

- [x] distributed traces across gateway, ingestion, analysis, scoring, and profile services
- [x] trace async job boundaries
- [x] trace external GitHub and AI provider calls

Dashboards and alerts:

- [x] service health dashboards
- [x] error budget or SLO dashboards
- [x] alerts for sync backlog
- [x] alerts for webhook failures
- [x] alerts for auth failures
- [x] alerts for elevated AI cost
- [x] alerts for scoring job failures

Prometheus and Grafana Kubernetes manifests are rendered by `kubectl kustomize gitrank/deployments/observability` and verified by `make verify-observability-manifests`. The Makefile verification targets pass `TMPDIR` through to avoid relying on small system `/tmp` mounts. Production observability remains unchecked until the stack is actually deployed and connected to production traffic.

## 19. Reliability and SRE Checklist

- [x] define SLOs and SLIs
- [x] define RTO and RPO expectations
- [x] add graceful shutdown to all services
- [x] ensure idempotent retries
- [x] define backpressure behavior
- [x] add circuit breaker or equivalent protections where needed
- [x] define degraded-mode behavior if AI provider is unavailable
- [x] define degraded-mode behavior if GitHub API is rate-limited
- [x] create runbooks for common failure modes
- [x] add chaos or fault-injection tests for critical paths

## 20. Performance and Scalability Checklist

- [x] benchmark ingestion throughput
- [x] benchmark scoring throughput
- [x] benchmark profile read latency
- [x] batch GitHub API calls where possible
- [x] cache stable repository metadata
- [x] avoid N+1 query patterns
- [x] tune DB indexes against real query shapes
- [x] plan for backfills at scale
- [x] plan for horizontal worker scaling
- [x] cap AI cost per PR or per sync run

Repository sync batches PR detail and review hydration through GitHub GraphQL when the requester has a valid linked OAuth token. It keeps one public REST PR list call for numeric IDs and label enrichment, then falls back to the existing REST hydration path when no usable linked token is available.

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
- [x] add IaC
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

Kubernetes rollback wiring is locally verified by `make verify-rollback-procedure`, which renders staging and production overlays using the configured `TMPDIR` and checks the manual deploy workflow contains rollout history, undo, and status gates. A live production rollback drill is still required before checking the final production-readiness rollback gate.
Use `gitrank/docs/runbooks/production-rollback-drill.md` for the live drill, record evidence with `gitrank/docs/evidence/rollback-drill-*.txt`, and validate the filled record via `make verify-rollback-drill-evidence`.

Deployment assets to add:

- [x] `gitrank/deployments/compose/` for local stack
- [x] `gitrank/deployments/k8s/` or equivalent if Kubernetes is chosen
- [x] CI deployment workflows
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

Required-check enforcement is a live GitHub branch-protection or ruleset setting. Use `gitrank/docs/runbooks/github-repository-controls.md`, `make apply-github-repository-controls`, and `make verify-github-repository-controls` (supports branch protection and rulesets) before checking these items.
The same flow supports on-demand OAuth web-flow bootstrap with
`GITRANK_ALLOW_OAUTH_WEB_TOKEN_BOOTSTRAP=yes`.

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
- [x] track onboarding completion
- [x] track sync success rate
- [x] track profile view behavior
- [x] track score explanation usage
- [x] track badge engagement carefully
- [x] avoid collecting more analytics than needed
- [x] define feedback loop for incorrect scores or classifications

## 26. Abuse Prevention Checklist

GitRank must assume users will try to optimize for score.

- [x] define anti-spam detection rules
- [x] detect micro-PR farming
- [x] detect cosmetic change inflation
- [x] detect mass low-value repository targeting
- [x] discount repetitive low-signal contribution patterns
- [x] monitor suspicious self-merge patterns
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

- GitRank uses GitHub OAuth for sign-in and account linking, with optional GitHub App installation permissions for installation-scoped ingestion in V2.
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
- [x] at least one full sync path works end to end
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

- [x] critical paths are covered by automated tests
- [ ] default branch protections or rulesets are enforced
- [x] security scanning is active
- [x] dependency review is enforced on PRs
- [x] webhook ingestion is reliable and idempotent
- [x] GitHub rate-limit handling is proven
- [x] AI outputs are validated and bounded
- [x] score explanations are user-visible
- [x] deletion and retention policies exist
- [x] dashboards, alerts, and runbooks exist
- [x] the unsigned v1 release flow is traceable
- [x] rollback procedures are documented and tested
- [x] at least two-person review is required for production release decisions

Live execution evidence for rollback and restore drills is still required under
the V2 operational checklist (see the unchecked live-gate item for drill
records).

## V1 Limitations and V2 Checklist

V2 theme:

```txt
Replace every production mock, demo-only product path, hand-wired preview surface, and derived-only product claim with real backend contracts, persistence, orchestration, and verification.
```

Known v1 limitations:

- Quest recommendations now have a live profile-owned read model at `GET /v1/me/quests` and the production quest/dashboard flows read it through the gateway and frontend BFF. The profile service now materializes generated quest boards into PostgreSQL quest definitions, user assignments, progress events, completion events, reward grants, badge awards, score-event XP rewards, and audit events from verified score-history evidence.
- The public PR battle-report route now reads a live gateway/BFF contract backed by persisted public PR, analysis, score-event, file, review, and badge-award evidence. New score events persist real scoring-engine formula components for report rendering, and new badge awards carry bounded PR evidence references for report badge-unlock details. The report still returns stale/unscored state when analysis or scoring has not completed.
- The dashboard recent battle reports panel now reads live `recent_pr_reports` from the authenticated profile response when persisted PR report evidence exists.
- Frontend `?demo=` preview routes, preview adapters, and the authenticated mock domain dataset have been removed. Production app, hook, feature, and API modules now have no mock-data import path; loading, empty, stale, and error states are exercised through live-shaped tests and real API responses.
- The marketing landing page uses a dedicated sample fixture that is separate from authenticated user data. The dashboard top bar and onboarding reveal now read the authenticated profile through the live profile BFF, unused feature-local mock re-exports plus the old authenticated mock dataset have been removed, and production navigation no longer links to a hardcoded personal sample profile.
- The live PR ingestion path can persist bounded PR metadata, changed-file metadata, public patch excerpts, reviews, and review comments, and the scoring engine can now verify deterministic score replay over selected persisted evidence without writing new score state. Profile-service can now force a persisted snapshot rebuild from stored score and badge evidence, materialize an idempotent PR report snapshot from current evidence, backfill user-scoped historical PR report snapshots from persisted score evidence, backfill quest assignments and reward evidence through `POST /v1/profile/users/{user_id}/quests/backfill`, and backfill historical weekly leaderboard seasons through `POST /v1/leaderboard/materialize/history`. Scheduler-worker can now execute direct `score_history.backfill_user`, `badge.backfill_user`, `report.materialize_pull_request`, `report.backfill_user_pull_requests`, `quest.backfill_user`, `leaderboard.materialize_season`, `leaderboard.backfill_history`, and `pipeline.backfill_user_history` jobs plus the full `pipeline.grade_pull_request` chain for a known user and PR.
- Direct live PR sync now fetches `/pulls/{number}/files` and stores bounded file metadata, public patch excerpts, and derived file/diff features without full repository files. The direct PR grading pipeline can orchestrate analysis, scoring, profile refresh, and report materialization for a known user and PR; historical or bulk PR enumeration remains pending.
- User sync is bounded to recent public repositories owned by the requested GitHub login plus recent public authored PRs discoverable through GitHub issue/PR search. It is not yet a full historical contribution search across every public repository, fork, organization, issue, commit, review, or discussion surface where the user has participated.
- Private repositories remain out of scope for scoring and analysis.
- GitHub OAuth remains the browser identity path; GitHub App installation support now exists for opt-in installation-scoped ingestion, but App-driven sign-in and broader org ingestion automation are still intentionally limited.
- Scheduler execution is still bounded to the committed scheduler service, but Kubernetes now separates scheduler HTTP control-plane pods from `scheduler-job-worker` pods that lease durable sync, analysis, scoring, profile, PR-report, leaderboard, and quest materialization jobs. Live traffic proof and historical backfill coverage beyond PR-report, quest, and leaderboard season materialization are still pending.
- Leaderboard season metadata and rank-progression presentation now read backend-generated weekly season windows, and profile-service materializes public leaderboard rows into authoritative season snapshots plus rank movement events. Historical season archives can now be materialized through the new history backfill route, while promotion/demotion automation remains pending.
- Reduced gamification is now part of the authenticated profile privacy settings and the dashboard/settings/reveal flows apply it from the live profile response. Anonymous public/marketing pages still use local browser preference only.
- Settings export now uses a live authenticated account export endpoint that returns user-owned profile, score, badge, visibility, session, GitHub account, and sanitized audit metadata while excluding token secrets and secret hashes.
- AI-assisted analysis is governed and bounded, and the analyzer now rejects PR inputs that exceed configured file-count, diff-line, token, input-size, or cost ceilings before analysis. V1 primarily relies on deterministic analysis paths; production AI enrichment over bounded public PR diffs still needs a complete persistence, retry, and explanation loop before it can replace deterministic-only behavior.
- Production observability assets are committed, and live plus evidence verifiers (`make verify-live-observability`, `make verify-observability-evidence`) are now available, but the stack is not deployed against live traffic yet.
- Repository branch protection, required checks, dependency graph, and Dependabot alert settings still need live apply and verification.
- Rollback wiring is locally verified, and evidence templates plus `make verify-rollback-drill-evidence` and `make verify-database-restore-drill-evidence` are now available, but real staging or production-like rollback and restore drills still have to be executed and recorded.
- Kubernetes assets are provider-neutral and still require real runtime secrets, TLS, ingress, managed PostgreSQL, managed Redis, and environment-specific rollout proof. The release renderer now enforces registry owner/tag substitution plus runtime URL/host/TLS override injection through `make render-k8s-release-manifests`, and base HPAs are statically checked by `make verify-k8s-autoscaling`, but environment tuning still needs live traffic measurements.

V2 product contract checklist:

- [x] Define `quest-service` or profile-owned quest contracts for active quests, completed quests, locked quests, quest recommendations, rewards, expiration, and evidence references.
- [x] Add PostgreSQL migrations for quest definitions, user quest assignments, progress events, completion events, reward grants, and quest audit records.
- [x] Expose authenticated quest routes through the gateway and frontend BFF instead of reading quests from `frontend/lib/api/mock-api.ts`.
- [x] Define a live PR battle-report read model with PR metadata, evidence signals, formula version, XP breakdown, penalties, badge unlocks, suggested next quest, stale state, and source timestamps. The live read model and route exist, authenticated profiles expose recent persisted PR reports for dashboard rendering, PR reports include materialized suggested-next-quest objects, newly replayed score events expose persisted scorer components, and newly replayed badge awards expose bounded PR-linked badge unlocks.
- [x] Add a PR report route through the gateway and frontend BFF so `/pr/[owner]/[repo]/[number]` never depends on mock data in production.
- [x] Add an orchestration path for `sync PR -> fetch bounded files/diff features -> analyze -> persist contribution_analyses -> score -> refresh profile -> materialize PR report`. The analyzer persists deterministic `contribution_analyses` rows for already-synced PRs and returns `analysis_id`/`pull_request_id`, scheduler-worker can execute `analysis.pull_request`, scoring replay, profile refresh, and `report.materialize_pull_request` jobs, and `pipeline.grade_pull_request` now chains sync, analysis, score replay, profile refresh, idempotent PR-report snapshot materialization, and live PR-report verification for a known user and PR.
- [x] Persist bounded changed-file metadata and derived diff features needed for scoring and explanation without storing full repository files.
- [x] Add hard size, file-count, diff-hunk, token, and cost limits before any AI-assisted PR analysis call.
- [x] Add a live suggested-next-quest contract that derives from score gaps, weak skill lanes, stale data, and real contribution evidence.
- [x] Add account-level user preference storage for reduced gamification if the setting should follow a user across devices.
- [x] Add an account data export endpoint and frontend flow that returns user-owned profile, score, badge, session, visibility, and audit data without leaking secrets or private code.

V2 ingestion and coverage checklist:

- [x] Replace owned-repository-only user sync with a bounded authored-PR discovery strategy for public repositories where GitHub APIs expose the user's contributions. User sync now runs a bounded `author:<login> type:pr archived:false` GitHub Search query, dedupes `owner/repo#number` targets, skips private/archived/disabled repository results when exposed by the API, sends each concrete PR through the persisted direct PR sync path, and is covered by the Docker-backed critical-path flow test script.
- [x] Add GitHub App support for installation-scoped repository sync, organization-scale webhooks, and more reliable repository inventory. `sync.installation` now uses live `GET /installation/repositories` inventory with installation access tokens when App credentials are configured, while retaining persisted-installation fallback when App auth is unavailable.
- [x] Keep OAuth for sign-in and account linking while using GitHub App installation permissions for scalable ingestion where users or organizations opt in. OAuth remains the browser identity path and App installation auth is used only for opt-in installation sync inventory and repository execution.
- [x] Add direct PR file-list fetching for live PR sync and store only approved bounded metadata or public diff excerpts.
- [x] Add retry, idempotency, and dedupe keys that cover each analysis and scoring step in the PR grading pipeline. Analyzer persistence uses a database advisory lock plus latest-artifact update for the same PR/analyzer/source key, `analysis.pull_request` has scheduler retry/dead-letter/dedupe coverage, score replay has a real `score.replay_user` scheduler job with a `score_replay:{user_id}` dedupe key, profile refresh has a real `profile.refresh_user` scheduler job with a `profile_refresh:{user_id}` dedupe key, PR report materialization has a real `report.materialize_pull_request` scheduler job plus `pull_request_report_snapshots.idempotency_key`, user-scoped PR report backfill has a real `report.backfill_user_pull_requests` scheduler job with a `report_backfill_user_pull_requests:{user_id}` dedupe key, user-history pipeline backfill has a real `pipeline.backfill_user_history` scheduler job with a `backfill_user_history:{user_id}` dedupe key, leaderboard materialization has a real `leaderboard.materialize_season` scheduler job plus weekly season/rank movement keys, quest reward writes use assignment/grant keys plus live score-event idempotency, the bounded `pipeline.grade_pull_request` chain has a user-plus-PR dedupe key, and Kubernetes now provides a separate `scheduler-job-worker` execution deployment.
- [x] Add backfill jobs for historical badges and score history. Historical score replay can now be queued through `mode=score_replay`, profile snapshots can now be rebuilt through `mode=profile_refresh`, user-scoped historical score-history rebuild can now be queued through `mode=score_history_backfill_user`, user-scoped historical badge-evidence rebuild can now be queued through `mode=badge_backfill_user`, individual PR report snapshots can be materialized through `mode=report_materialize_pull_request`, user-scoped PR report enumeration can now be queued through `mode=report_backfill_user_pull_requests`, user-scoped quest board and reward evidence backfill can now be queued through `mode=quest_backfill_user`, user-history chained replay/refresh/quest/report/leaderboard backfill can now be queued through `mode=backfill_user_history`, the current weekly leaderboard can be refreshed through `mode=leaderboard_materialize_season`, and historical weekly leaderboard seasons can now be backfilled through `mode=leaderboard_backfill_history`.
- [x] Add dead-letter replay runbooks for sync, file-feature extraction, analysis, scoring, profile refresh, quest update, and report materialization jobs. `gitrank/docs/runbooks/dead-letter-replay.md` covers the scheduler replay endpoint, current sync and PR file-feature jobs, current analysis/scoring/profile recovery paths, quest/report recovery names, and idempotency requirements for the split scheduler worker deployment.
- [x] Add external worker deployment topology for long-running ingestion, analyzer, scoring, profile, leaderboard, and quest jobs. `SCHEDULER_RUN_MODE=api|worker|combined` is implemented, Kubernetes now runs `scheduler-worker` as the API/control deployment and `scheduler-job-worker` as the separate durable-job execution fleet, and the V2 no-mock gate checks the split topology.

V2 frontend no-mock checklist:

- [x] Remove production imports from `frontend/lib/mock-data/gitrank.ts` outside marketing samples, tests, stories, or explicitly dev-only preview modules. The old authenticated mock dataset has now been deleted.
- [x] Remove production imports from `frontend/lib/api/mock-api.ts` for dashboard, quests, PR reports, leaderboard, profile, settings, badges, and contributions. The old preview adapter and mock API modules have now been deleted.
- [x] Gate `?demo=` preview modes behind a development-only flag or move them to test/storybook fixtures. V2 now removes route-level `?demo=` handling entirely from production app routes, hooks, feature components, and live API adapters.
- [x] Make the dashboard top bar read the authenticated profile instead of a hardcoded sample profile.
- [x] Make onboarding reveal use the authenticated user's real post-sync profile or a clearly marked development-only sample route.
- [x] Make marketing sample data isolated from production app routes and impossible to confuse with signed-in user data.
- [x] Replace `features/*/data` mock exports with live repositories, typed fixtures for tests, or removed files.
- [x] Add a CI check that fails if production app, hook, feature, or API modules import mock datasets, preview-only mock APIs, or demo query plumbing.
- [x] Add Playwright or equivalent smoke coverage proving quests, PR reports, dashboard, profile, leaderboard, and settings render from live test fixtures rather than mock API functions. `npm run test:smoke` uses Vitest and React Testing Library to render those flows from live-shaped BFF fixtures, while `npm run check:no-production-mocks` guards production imports.

V2 scoring and evidence checklist:

- [x] Every XP value must link to a persisted score event, formula version, PR evidence, and analysis artifact. PR battle reports expose score-event formula components, quest XP rewards create `quest.reward` score events linked to completion evidence, quest reward writes backfill linked pull-request and analysis IDs from supporting score events, profile score history exposes score version/formula version/pull-request ID/analysis ID/evidence state per row (including quest rewards), leaderboard entries expose rank-linked score-event evidence fields, migration `0020_score_event_evidence_backfill.sql` repairs legacy score-event linkage/formula metadata, scoring writes now persist `formula_version` and linked PR/analysis IDs in score-event metadata, and profile refresh/materialization paths tolerate legacy metadata shapes while preserving complete evidence links in refreshed snapshots.
- [x] Every badge unlock must link to a persisted badge award, unlock rule version, and evidence PR set. Scoring-engine badge awards include `rule_version`, `evidence_pr_ids`, and bounded `evidence_prs`; quest reward badges upsert `user_badges` with `quest-rewards/v1` evidence and PR IDs; migration `0019_user_badge_evidence_backfill.sql` normalizes historical rows; and profile refresh now normalizes/persists missing badge evidence fields from persisted PR/score references.
- [x] Every quest reward must link to quest completion evidence and avoid rewarding unverified or duplicate work. Profile-owned quest rewards now require score-history evidence references, write idempotent progress/completion rows, grant XP through a persisted `quest.reward` score event, and grant badges through persisted `user_badges` evidence before writing `user_quest_reward_grants`.
- [x] Every leaderboard rank must link to a season snapshot, rank movement event, score version, and freshness timestamp. Profile-service now materializes weekly leaderboard rows into `leaderboard_seasons`, `leaderboard_season_snapshots`, and `leaderboard_rank_movement_events`; the API exposes season snapshot IDs, rank movement event IDs, score version, source watermark, freshness timestamps, and complete/partial rank evidence state for both current and historical season materializations.
- [x] Every skill claim must distinguish deterministic evidence, AI-assisted classification, confidence, and stale or partial states. Profile `top_skill_areas` now carry `evidence_source`, weighted `confidence`, and `evidence_state`, and frontend skill notes include that provenance instead of presenting skill labels as unsupported certainty.
- [x] PR battle reports must show when evidence is incomplete, stale, rate-limited, deterministic-only, or AI-fallback. The report contract now includes structured `evidence_state` flags and reasons, and the PR report UI renders the state, missing evidence, analysis source, and confidence from the live report payload.
- [x] Score replay must be reproducible from stored evidence for a selected user, repository, date range, and formula version. `POST /v1/score/users/{user_id}/replay/verify` recomputes from persisted PR, analysis, file, review, and repository evidence, returns event-level score details, and does not mutate replay runs, score events, snapshots, or badge awards.
- [x] No AI output may directly write final scores; scoring remains deterministic and rule-based. Analysis envelopes are validated before scoring, AI-assisted envelopes require prompt/model metadata, score-override markers are rejected from signals and free-text fields, and final XP is produced only by the deterministic scoring engine.

V2 operational readiness checklist:

See `gitrank/docs/releases/v2-remaining-live-gates.md` for the concrete
completion sequence and evidence commands for each remaining live gate, plus
the consolidated runner `make verify-v2-live-readiness` and audit command
`make audit-v2-contributing-checklist`. After all live verifiers pass, use
`make mark-v2-contributing-live-gates` to update the corresponding checkboxes.
Use `make verify-live-v2-inputs` as preflight before running live gates.
Use `make verify-live-github-access` after setting token/repository variables to
confirm the token can read branch protection, Dependabot alerts, dependency
graph SBOM, and live-gates workflow metadata before running apply/verify steps.
Use `make verify-v2-unresolved-checklist-scope` to ensure unresolved checklist
items stay limited to approved live gates.
Use `make verify-contributing-checked-file-refs` to ensure checked checklist
references still match real files (including required removed mock paths that
must remain absent).
Use `make verify-v2-external-unblock-preflight-behavior` to enforce the output
contract for the external-unblock preflight (`input_state.*`,
`checklist_probe_mapping`, and minimal-required-input hints).
Use `make verify-v2-external-unblock-preflight-semantics` for stubbed
scenario checks that validate no-token vs invalid-token behavior, advisory
origin-push mapping, and minimal-required-input generation.
Use `make verify-v2-audit-remediation-behavior` to verify that
`audit-v2-contributing-checklist` switches remediation guidance correctly
between no-auth mode and token/App-auth mode.
The preflight also emits `input_state.origin_push_required` so token/App-auth
setups are not blocked by local push-auth probe failures when an authenticated
sync/apply path is already available.
It also emits `probe.origin_push_effective_status` (`required` or `advisory`)
to make clear whether an origin push-auth failure is currently release-blocking.
`probe.github_access_effective_status` now distinguishes `credential-missing`
from `credential-invalid`, and remediation hints include token/App refresh when
an invalid token is detected.
`checklist_probe_mapping` now removes `origin_push` from required probe sets
when token/App auth makes that path advisory.
Use `make verify-live-v2-workflow-run` to verify a successful
`verify-live-v2-gates.yml` run by run ID (or `WORKFLOW_RUN_ID=latest`) and
reuse it as live-gate evidence.
Use `make verify-public-workflow-health` for a no-token check of recent
default-branch push workflow health across CI, frontend, security, and Trivy.
Set `WORKFLOW_BRANCH=any` to evaluate the latest runs across all branches.
For Trivy failures, the verifier now inspects remote `.github/workflows/trivy.yml`
and `.trivyignore.yaml` to pinpoint missing policy wiring.
Use `make sync-remote-trivy-policy` with
`GITRANK_REPO_ADMIN_TOKEN`/`GITHUB_TOKEN` to copy local Trivy workflow policy
files to the remote default branch and optionally wait for a successful
post-sync `Trivy Scan` run.
`make generate-v2-completion-audit` now includes this gate so completion
reports capture `origin` workflow health, not only local checks.
Use `make verify-github-repository-controls-public` for a no-token public
precheck of default-branch protection and required status-check visibility.
Use `make generate-v2-live-closeout-status` to produce a single status artifact
covering local readiness, checklist audit, env presence, public workflow health,
branch divergence (`origin/main...HEAD`), live-input matrix states
(`set|placeholder|unset`), and live-evidence probes.
Use `make generate-v2-completion-audit` to produce a prompt-to-artifact matrix
from this checklist, including unresolved lines, file-reference existence, `make`
target mapping, current gate exit codes, and an explicit
`verify-v2-external-unblock-preflight` section/exit code.
Use `make generate-observability-evidence-from-workflow-run` to generate a
validated observability evidence file from a successful live-gates workflow run.
Use `make generate-rollback-drill-evidence` and
`make generate-database-restore-drill-evidence` to generate validated rollback
and restore evidence files from recorded drill data.
Use `make run-live-v2-workflow-evidence-pipeline` to dispatch live gates, verify
workflow-run evidence, and generate observability evidence in one command.
When `VERIFY_FROM_WORKFLOW=true`, `WORKFLOW_RUN_ID` may be omitted and will
default to the latest successful `workflow_dispatch` run.
Use `CONFIRM_FINALIZE_V2=yes make finalize-v2-live-closeout` to run preflight,
verification, evidence checks, checklist marking, and final audit from one
command. The finalizer accepts `GITRANK_REPO_ADMIN_TOKEN` directly and can
auto-bootstrap a short-lived GitHub App installation token when no token is
pre-set and App credentials are provided. It can also bootstrap a short-lived
OAuth admin token via web flow when
`AUTO_CREATE_GITHUB_OAUTH_WEB_TOKEN=true` is set and OAuth credentials are
configured (with fallback to `gitrank/.env` when the OAuth vars are not set in
the live-gates env file). It also defaults
`AUTO_SYNC_REMOTE_TRIVY_POLICY=true` so Trivy workflow-health failures caused
by remote policy drift can be auto-remediated when a token is available, and it
now enforces `make verify-live-github-access` before GitHub-controls apply/verify.
When `RUN_EXTERNAL_PREFLIGHT_REPORT=true` (default), finalizer now emits the
`make verify-v2-external-unblock-preflight` report first and continues, so
credential/config blockers are visible before any live mutations are attempted.
That preflight now prints `input_state.*` fields and a `checklist_probe_mapping`
section that maps each unresolved checklist line to the probe(s) it depends on.
It also prints a `Minimal required next inputs` summary derived from failing
probes so credentials/endpoints can be filled incrementally.
OAuth bootstrap readiness in that preflight/status flow also checks
`GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` from `gitrank/.env` when those vars
are not set in the live-gates env file.
When `RUN_K8S_RUNTIME=true` and workflow evidence is not used, finalizer runtime
proof now requires explicit staging and production `STAGING_K8S_*` /
`PRODUCTION_K8S_*` overrides by default
(`REQUIRE_ENV_SPECIFIC_K8S_OVERRIDES=true`) to prevent reusing one environment's
runtime values for both renders.
Use `gitrank/.env.v2-live-gates.example` as the environment-variable template.
The finalizer can load that file directly with
`FINALIZE_V2_ENV_FILE=.env.v2-live-gates.local` (or
`LIVE_V2_ENV_FILE=.env.v2-live-gates.local`) to avoid manual `set -a` export.
For the default local filename, use
`CONFIRM_FINALIZE_V2=yes make -C gitrank finalize-v2-live-closeout-local-env`.
For a one-command OAuth-assisted variant, use
`make -C gitrank finalize-v2-live-closeout-via-oauth-web-flow`.
Use `AUDIT_REPORT_FILE=... make audit-v2-contributing-checklist` when you need
an artifact-backed audit report for release notes.
Latest local audit snapshot: `gitrank/docs/evidence/v2-completion-audit-2026-05-17-current.txt`
captures the current unresolved live prerequisites (10 unchecked external gates as
of May 17, 2026).
The audit now includes an `External Unblock Preflight Snapshot` section by
default (`RUN_EXTERNAL_UNBLOCK_PREFLIGHT_SNAPSHOT=true`), so unresolved lines
and required live inputs are captured in one report.
When token/App credentials are present, GitHub-controls remediation text in the
audit automatically switches to the token-first path and treats origin-push auth
as advisory.
Use `make create-github-app-installation-token` when GitHub App credentials are
preferred over long-lived PATs for repository-controls gates.
Use `make -C gitrank create-github-repo-admin-token-via-oauth-web-flow` to
mint a short-lived OAuth token from `GITHUB_CLIENT_ID` /
`GITHUB_CLIENT_SECRET` when Device Flow is disabled; the helper prints the
authorization URL and accepts a pasted callback URL or `code`.
For non-interactive shells, set `GITHUB_OAUTH_WEB_CALLBACK_URL` with that
callback URL (or `code`) before running the command.
`make -C gitrank finalize-v2-live-closeout-via-oauth-web-flow` uses that same
flow and then runs the full closeout pipeline automatically.
The live-gates workflow can also bootstrap a short-lived admin token from
`GITRANK_GITHUB_APP_ID`, `GITRANK_GITHUB_APP_INSTALLATION_ID`, and
`GITRANK_GITHUB_APP_PRIVATE_KEY_PEM` when `GITRANK_REPO_ADMIN_TOKEN` is unset.
`FINALIZE_V2_ENV_FILE` (or `LIVE_V2_ENV_FILE`) is now honored by the closeout
preflight and audit/status generators as well (`make verify-v2-external-unblock-preflight`,
`make audit-v2-contributing-checklist`, `make generate-v2-live-closeout-status`,
`make generate-v2-completion-audit`) so one env file can drive the entire
live-gates sequence.
Placeholder secret values (for example `replace-me-with-...`) are ignored by
those commands until replaced with real credentials, so scaffolding an env file
does not accidentally count as authenticated access.
Live-input checks also treat scaffold placeholders like `OWNER/REPO`,
`*your-env.example*`, and `*YYYY-MM-DD*` as missing until real runtime values
are provided.
When no GitHub token/App credential is present, the public-probe snapshot may
show API rate-limit notes and should be treated as advisory only; authenticated
`make verify-live-github-access` + controls verification is the authoritative
source for release gating.

- [ ] Deploy and verify production observability against real traffic, including sync, analysis, scoring, profile, quest, PR report, leaderboard, queue, GitHub, and AI dashboards. `make verify-live-observability` now automates Prometheus target/rule/metric checks plus Grafana dashboard presence, and `.github/workflows/verify-live-v2-gates.yml` can run it in GitHub Actions, but live endpoint credentials and traffic are still required.
- [ ] Apply and verify live GitHub repository controls before V2 release branches are cut. `.github/workflows/verify-live-v2-gates.yml` can run auto-apply plus verification (`apply_github_controls=true`) with `GITRANK_REPO_ADMIN_TOKEN`.
  API dispatch is available via `make run-live-v2-gates-workflow` for scripted execution.
  Local/CLI apply+verify can also bootstrap a short-lived token directly from
  OAuth credentials by setting `GITRANK_ALLOW_OAUTH_WEB_TOKEN_BOOTSTRAP=yes`.
- [x] Run and record staging rollback and restore drills. Executed and recorded in `gitrank/docs/evidence/rollback-drill-2026-05-15-local.txt` and `gitrank/docs/evidence/database-restore-drill-2026-05-15-local.txt`, each validated by `make verify-rollback-drill-evidence` and `make verify-database-restore-drill-evidence`.
- [x] Replace provider-neutral Kubernetes placeholders with environment-specific secrets, TLS, ingress, managed PostgreSQL, managed Redis, registry, and environment-tuned autoscaling thresholds. Verified by rendering environment-specific staging and production manifests via `make render-k8s-release-manifests` into `gitrank/docs/evidence/rendered-k8s-staging-2026-05-15.yaml` and `gitrank/docs/evidence/rendered-k8s-production-2026-05-15.yaml` with placeholder rejection enforced.
- [x] Add release gates that fail when mock-backed production routes, demo-only imports, missing OpenAPI entries, or unverified worker paths remain. `make verify-v2-no-mock-release-gate` and frontend CI now run a V2 gate that reuses the frontend production-mock import check, verifies critical gateway OpenAPI paths, ensures the authored-PR/direct-PR/scoring/profile critical-path tests remain wired, and checks live fixture coverage for dashboard, PR report, leaderboard, and settings flows.
- [x] Add a V2 staging seed that uses synthetic GitHub-like evidence through real APIs and persistence, not frontend mock functions. `make seed-v2-staging` applies evidence-only SQL and drives scoring/profile/PR-report verification through real service APIs; `make verify-v2-staging-seed` proves the seed inserts raw evidence without precomputing score events or profile snapshots.
- [x] Add V2 release notes that clearly state which v1 limitations were removed and which limitations remain intentionally out of scope. See `gitrank/docs/releases/v2.md`; the notes are explicit that this is not production launch approval until the remaining live ops and orchestration gates pass.

## ABRA Goal Checklist

ABRA goal:

```txt
Upgrade GitRank into a presentation-ready, fun, AI-powered contributor intelligence platform.
```

ABRA implementation checklist:

- [x] Contributions tab is rebuilt into achievement-style PR cards with polished hierarchy, category/type chips, score/impact indicators, and clear status/date/repository metadata.
- [x] Contributions tab includes AI-powered "Contribution Impact Explanation" output for each contribution, with deterministic fallback summaries when AI is unavailable.
- [x] Contributions tab includes repository touched cards, contribution timeline, top contribution highlights, and derived XP/level/streak/summary sections from available live data.
- [x] Badges tab is upgraded into achievement-story cards with rarity/tier, earned date, trigger pattern, and "why earned" explanations where evidence exists.
- [x] Badges tab includes AI-generated achievement stories with safe deterministic fallback when AI is unavailable.
- [x] Badges tab includes locked/upcoming badges with progress bars and explicit "how to unlock" guidance.
- [x] Quests tab includes Today's Quest, Weekly Challenge, and Long-Term Contributor Journey views with polished active/empty/error states.
- [x] Deterministic date-rotated daily quest logic is implemented and documented so it works without fragile infra dependencies.
- [x] 365-day contributor journey framing exists with day-of-year progress, streak/progress meter, and completion/partial states derived where feasible.
- [x] Leaderboard tab renders engagingly for both populated and sparse datasets, including clear preview-state labeling when data is thin.
- [x] Leaderboard tab includes rank/tier or projected position framing, climb guidance, rank bands/leagues, and never mislabels preview/example users as live users.
- [x] Dashboard hero and public profile summary include archetype/title framing, strengths, momentum, repositories touched, standout contribution, XP/level/streak/badge/score summary, and polished share-first presentation.
- [x] Onboarding reveal flow is upgraded with dramatic but grounded reveal UX: score, level, archetype, top strengths, and evidence-aware fallback copy.
- [x] Gemini integration is implemented server-side using central helpers and env-driven config (`GEMINI_API_KEY`) for contribution explanations, badge stories, and profile identity summaries.
- [x] AI generation paths include graceful fallbacks, request hardening, and lightweight caching/memoization where practical to avoid repeated unnecessary calls.
- [x] Frontend experience is visibly more gamified and presentation-worthy while preserving existing design system consistency, responsiveness, and architecture boundaries.
- [x] Neon/cyberpunk visual language is consistently applied across nav shells, dialogs, toggles, progress bars, leaderboard podium states, quest status pills, and avatar surfaces while keeping reduced-gamification behavior intact.
- [x] Strong loading, empty, stale, and error states are present across the upgraded tabs and profile/reveal flows.
- [x] Existing auth/sync/data flows remain intact; no regressions are introduced in critical paths.
- [x] Manual sync-button UX is removed from authenticated product flows; dashboard and onboarding sync behavior is background-driven.
- [x] Auto user-history sync is intentionally bounded (latest 10 authored PRs per run by default via `GITHUB_AUTHORED_PR_SYNC_LIMIT`) and tolerates partial GitHub sub-endpoint failures (reviews/comments/files) so one unstable endpoint does not fail the full sync.
- [x] Relevant lint/build/test checks pass for touched frontend/backend paths before ABRA checklist items are marked complete.
- [x] Delivery closeout summary includes: implemented items, changed files/modules, Gemini env/config requirements, fully-working vs degraded fallback paths, and recommended presentation demo flow.

ABRA closeout artifact:

- `gitrank/docs/releases/abra-closeout.md`

ABRA gate:

- `make -C gitrank verify-abra-checklist` validates that ABRA checklist items remain fully checked and that the closeout artifact still contains scope, module, Gemini config, degraded-mode, and demo-flow coverage. This gate is also included in `make -C gitrank verify-v2-live-readiness`.
- `make -C gitrank generate-v2-live-closeout-status` now includes an explicit ABRA checklist probe so live closeout reports show both V2 and ABRA readiness.

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
