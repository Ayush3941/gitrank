# GitRank Production Decision Register

Last reviewed: May 5, 2026

This register freezes the non-autonomous production decisions that unblock the next implementation wave.

## Summary

| # | Status | Decision Package | Frozen Decision |
| --- | --- | --- | --- |
| 1 | 🔒 Frozen | Contributor governance | DCO, no CLA, maintainer guide required |
| 2 | 🔒 Frozen | Repository admin controls | Protect `main`, require PRs and CI, no mandatory CODEOWNERS approval in v1 |
| 3 | 🔒 Frozen | Admin surface policy | No generic admin API or dashboard in v1 |
| 4 | 🔒 Frozen | GitHub auth model | GitHub OAuth only in v1; GitHub App remains a future upgrade |
| 5 | 🔒 Frozen | Persistence semantics | Evidence-first storage, recomputed aggregates, GitHub-ID idempotent upserts, no manual score overrides |
| 6 | 🔒 Frozen | Database operations | Daily backups, PITR where supported, quarterly restore drills, no v1 partitioning |
| 7 | 🔒 Frozen | Privacy and legal posture | Public profiles and leaderboard participation enabled by default for signed-in users, with deletion and visibility controls |
| 8 | 🔒 Frozen | AI data exposure policy | Bounded public PR diffs only, no full file contents, no private code |
| 9 | 🔒 Frozen | AI model governance | Versioned JSON schema, validation, deterministic fallback, cost caps, AI never scores directly |
| 10 | 🔒 Frozen | Contributor-facing score policy | Public scoring and global leaderboard enabled in v1 with visible formula/version context |
| 11 | 🔒 Frozen | Scoring governance extras | Medium anti-gaming in v1 with basic diminishing returns and capped repository bonus |
| 12 | 🔒 Frozen | Analytics policy | Broad product analytics in v1 without private code or secret capture |
| 13 | 🔒 Frozen | Observability policy | Structured logs, metrics, tracing, dashboards, and alerts are required operational targets |
| 14 | 🔒 Frozen | Reliability policy | SLO/SLI, RTO/RPO, idempotent retries, backpressure, degraded modes, and stale indicators |
| 15 | 🔒 Frozen | Infrastructure baseline | Kubernetes from v1, OCI containers, managed Postgres and Redis preferred |
| 16 | 🔒 Frozen | Release integrity | Git tags, GitHub Releases, and OCI image publication in v1 without signing or provenance requirements |
| 17 | 🔒 Frozen | Abuse and moderation policy | Light manual abuse review and dispute path in v1 |
| 18 | 🔒 Frozen | Acceptance policy | Strict alpha and production gates for public reputation data |

## Frozen Decisions

### 1. Contributor Governance

- GitRank uses DCO, not CLA.
- Contributors should sign commits with `git commit -s`.
- Maintainer operations live in [MAINTAINER_GUIDE.md](./MAINTAINER_GUIDE.md).

### 2. Repository Admin Controls

Required repository settings:

- protect `main`
- require pull requests before merge
- require CI and security checks before merge
- block casual direct pushes to `main`
- keep `CODEOWNERS`, but do not require CODEOWNERS approval yet

### 3. Admin Surface Policy

- no generic admin API in v1
- no full admin dashboard in v1
- no manual score-management UI in v1

### 4. GitHub Auth Model

- GitHub OAuth is the v1 auth model
- sign-in and account linking use OAuth
- GitHub App installation is not required for v1
- GitHub App support may return later for deeper org-scale ingestion

### 5. Persistence Semantics

- GitHub entities upsert by stable GitHub IDs
- evidence tables remain explainable and replayable
- scores, badges, ranks, and public profile views are recomputed aggregates
- no manual score overrides in v1
- soft deletion or hidden-state transitions are preferred until explicit account deletion is requested

### 6. Database Operations

- daily automated backups
- point-in-time recovery where the provider supports it
- quarterly restore drills
- no table partitioning in v1

### 7. Privacy and Legal Posture

- public profile and leaderboard participation are enabled by default after sign-in
- users can hide profiles, hide repositories, request re-sync, and request deletion
- only data needed for scoring, explanation, sync, and abuse review should be retained

### 8. AI Data Exposure Policy

- AI may receive bounded public PR diff hunks, PR metadata, review metadata, file names, and derived features
- AI may not receive full repository files in v1
- AI may not receive private repository code in v1
- large diffs should be summarized or reduced before AI submission

### 9. AI Model Governance

- prompts are versioned
- outputs must follow a versioned JSON schema
- deterministic validation is required before AI output is trusted
- invalid output is rejected or retried safely
- deterministic-only fallback is required
- AI never writes final scores directly
- hard per-PR and per-day cost caps are part of the baseline

### 10. Contributor-Facing Score Policy

- public scores are enabled by default
- global leaderboard is enabled in v1
- formula version and score explanations must remain visible
- evidence-backed wording is still required for skill claims

### 11. Scoring Governance Extras

- add basic diminishing returns for repeated similar PRs
- cap repository bonus so famous repositories do not dominate scoring
- keep a basic dispute path
- defer heavy conflict-of-interest modeling until post-v1

### 12. Analytics Policy

- track detailed product behavior across onboarding, dashboard, sync, profile, leaderboard, badges, quests, drill-down, score explanation, and disputes
- do not capture private code, secrets, or unnecessary sensitive data in analytics events
- keep event naming and versioning documented

### 13. Observability Policy

- structured logs
- metrics for API, ingestion, scoring, AI, queues, and database paths
- distributed tracing across request and async-job flows
- dashboards for sync, scoring, auth, AI, backlog, and service health
- alerts for critical failures

### 14. Reliability Policy

- define SLOs and SLIs for API, sync, scoring, and profile freshness
- define RTO and RPO expectations
- use idempotent retries for ingestion, analysis, and scoring paths
- apply backpressure when queues or upstream APIs overload
- degrade to deterministic-only behavior when AI is unavailable
- visibly mark stale or partial profile states

### 15. Infrastructure Baseline

- package services as OCI containers
- deploy on Kubernetes in v1
- prefer managed Postgres and managed Redis
- separate dev, staging, and prod where practical
- use container hygiene, TLS, owned DNS, rollout, rollback, and migration safety rules

### 16. Release Integrity

- release from Git tags
- publish GitHub Releases
- publish OCI images
- use checksums and SBOMs
- do not require signing or provenance in v1

### 17. Abuse and Moderation

- basic report and dispute path
- obvious abuse can be reviewed manually
- no automatic abuse penalties in v1
- no moderation dashboard in v1

### 18. Acceptance Policy

Alpha readiness requires:

- GitHub OAuth works
- at least one real sync path works
- PR persistence works
- idempotent ingestion is proven on critical paths
- scoring and profile generation work on real data
- AI schema validation exists if AI is enabled
- critical automated tests pass

Production readiness requires:

- critical-path coverage is enforced
- required CI checks pass before merge
- AI outputs are validated and bounded
- deletion and retention policies exist
- backups and restore process are documented
- dashboards and alerts exist
- rollback is tested
- stale and partial indicators are visible
- SLO and SLI expectations are documented
- two-person review is required for production release decisions
