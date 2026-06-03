# GitRank Backend Workspace

This directory contains the production backend workspace for GitRank.

## What Lives Here

- `services/`: deployable backend services
- `packages/`: shared Go packages and service contracts
- `deployments/`: Docker, Kubernetes, and migration assets
- `scripts/`: CI and release gate automation
- `docs/`: architecture, policy, runbooks, and release docs
- `go.work`: Go workspace definition for all backend modules

## Service Modules

- `api-gateway`: frontend-facing API and BFF routes
- `auth-service`: GitHub OAuth/session flows and account linking
- `github-ingestor`: webhook + API ingestion and persistence
- `pr-analyzer`: bounded deterministic/AI-assisted PR analysis
- `scoring-engine`: deterministic scoring and replay
- `profile-service`: profile, leaderboard, quest, and report read models
- `scheduler-worker`: durable background job execution and orchestration

## Local Verification

Run from `gitrank/`:

```bash
make test
make test-migrations
make test-critical-path-flows
make verify-v2-live-readiness
make audit-v2-contributing-checklist
```

## V2 Closeout Gates

The remaining V2 closeout status and runbooks are documented in:

- `docs/releases/v2-remaining-live-gates.md`
- `docs/runbooks/live-v2-gates.md`

Use these helpers:

```bash
make generate-v2-live-closeout-status
make generate-v2-completion-audit
```

`make generate-v2-live-closeout-status` includes a live input matrix showing
`set|placeholder|unset` states for credentials/endpoints required by external
V2 gates.

Generated closeout reports, drill evidence, observability snapshots, and
rendered Kubernetes evidence files are ignored by default. Keep durable
templates in `docs/evidence/`; force-add generated artifacts only for an
explicit release handoff.
