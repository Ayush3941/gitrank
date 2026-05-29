# Roadmap

This roadmap is ordered by dependency, not hype.

## Phase 0: Production Bootstrap

Goal: make the repository safe to collaborate on.

- repository health files
- issue and PR templates
- CODEOWNERS
- CI and security workflows
- shared config, logging, and error packages
- local deployment assets
- `.env.example`

## Phase 1: Identity and Core Persistence

Goal: make users and GitHub identities real objects in the system.

- database schema and migrations
- auth-service GitHub OAuth flow
- user and GitHub account persistence
- session or JWT issuance
- profile bootstrap records

Exit criteria:

- a user can sign in with GitHub
- user and GitHub identity rows exist in PostgreSQL
- sessions are issued securely

## Phase 2: GitHub Ingestion

Goal: ingest reliable contribution data.

- GitHub App installation-token sync for public GitHub data extraction
- webhook endpoint and signature validation
- repository sync
- PR sync
- review sync
- issue and label sync
- retry-safe backfills

Exit criteria:

- one repository can be synced end to end
- webhook deliveries are idempotent
- missed events can be recovered by backfill

## Phase 3: Deterministic Contribution Analysis

Goal: derive structured contribution facts without AI dependency.

- changed file classification
- docs and test heuristics
- review iteration counting
- merge outcome handling
- repository metadata weighting inputs

Exit criteria:

- PRs produce stable structured analysis artifacts
- analysis is reproducible from persisted evidence

## Phase 4: Scoring Engine v1

Goal: produce explainable contribution scores and profile aggregates.

- score formula versioning
- contribution score events
- skill dimension aggregation
- badges and levels
- history snapshots

Exit criteria:

- at least one user can view real contribution scores
- score explanations are visible and auditable

## Phase 5: AI Enrichment

Goal: improve classification quality without sacrificing control.

- prompt versioning
- constrained JSON outputs
- uncertainty handling
- evaluation set
- cost controls

Exit criteria:

- AI improves classification accuracy measurably
- deterministic safeguards still own the final score

## Phase 6: Public Profiles and Product UX

Goal: make GitRank useful to contributors and reviewers.

- public profile pages
- authenticated dashboard
- contribution drill-down
- score explanations
- privacy controls

Exit criteria:

- public alpha users can sign in, sync, and inspect their profile

## Phase 7: Hardening and Scale

Goal: support ongoing production usage.

- SLOs and alerts
- GitHub Releases and OCI image publication
- SBOMs
- queue scaling
- rate-limit tuning
- fairness review loops

Future upgrade after v1:

- signed releases
- provenance attestations

Exit criteria:

- platform is operationally boring
- deployment, rollback, and incident procedures are documented
