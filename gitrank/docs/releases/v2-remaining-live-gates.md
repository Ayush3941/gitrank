# V2 Remaining Live Gates

This document tracks the V2 checklist items that cannot be completed from local
code changes alone.

All items here map to unchecked boxes in `CONTRIBUTING.md`.

For consolidated execution, use:

- `make verify-v2-live-readiness`

## 1) Production Observability On Live Traffic

Checklist refs:

- `Production observability exists`
- `Deploy and verify production observability against real traffic ...`

Current local evidence:

- `make verify-observability-manifests` passes.
- `make verify-live-observability` fails closed without live endpoint
  configuration.

How to complete:

1. Configure live Prometheus and Grafana endpoints plus Grafana API token.
2. Run:
   - `make verify-live-observability`
3. Record evidence:
   - `docs/evidence/observability-live-YYYY-MM-DD.txt`
   - `make verify-observability-evidence EVIDENCE_FILE=...`

## 2) GitHub Repository Controls Applied And Verified

Checklist refs:

- `enable dependency graph`
- `enable Dependabot alerts`
- `protect the default branch or apply repository rulesets`
- `require pull request review before merge`
- `require status checks before merge`
- `enforce required checks before merge`
- `prevent direct pushes to protected branches`
- `default branch protections or rulesets are enforced`
- `Apply and verify live GitHub repository controls ...`

Current local evidence:

- Auto-discovery and apply scripts exist:
  - `make discover-github-required-status-checks`
  - `make apply-github-repository-controls-auto`
  - `make verify-github-repository-controls`
- Verification fails closed without admin token.

How to complete:

1. Provide `GITRANK_REPO_ADMIN_TOKEN` (or `GITHUB_TOKEN`) with repository admin
   scope.
2. Apply:
   - `GITRANK_APPLY_REPOSITORY_CONTROLS=yes make apply-github-repository-controls-auto`
3. Verify:
   - `make verify-github-repository-controls`

## 3) Rollback And Restore Drills Executed And Recorded

Checklist refs:

- `rollback procedures are documented and tested`
- `Run and record staging rollback and restore drills`

Current local evidence:

- Workflow and static rollback wiring are verified by
  `make verify-rollback-procedure`.
- Evidence templates and verifiers exist:
  - rollback: `make verify-rollback-drill-evidence`
  - restore: `make verify-database-restore-drill-evidence`

How to complete:

1. Execute staging/prod-like rollback drill.
2. Execute managed PostgreSQL restore drill.
3. Record and verify evidence files:
   - `docs/evidence/rollback-drill-YYYY-MM-DD.txt`
   - `docs/evidence/database-restore-drill-YYYY-MM-DD.txt`
   - corresponding `make verify-*evidence` commands.

## 4) Environment-Specific Kubernetes Runtime Proof

Checklist ref:

- `Replace provider-neutral Kubernetes placeholders with environment-specific secrets, TLS, ingress, managed PostgreSQL, managed Redis, registry, and environment-tuned autoscaling thresholds`

Current local evidence:

- Release render gate exists and rejects placeholders:
  - `make render-k8s-release-manifests`
- GitHub workflow gate exists:
  - `.github/workflows/verify-live-v2-gates.yml`

How to complete:

1. Configure real `K8S_*` values and secret bindings for each environment.
2. Run release render gate for staging and production.
3. Attach rendered artifact + deployment/rollout proof to release evidence.
