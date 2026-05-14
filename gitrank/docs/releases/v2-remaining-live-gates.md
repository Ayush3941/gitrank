# V2 Remaining Live Gates

This document tracks the V2 checklist items that cannot be completed from local
code changes alone.

All items here map to unchecked boxes in `CONTRIBUTING.md`.

For consolidated execution, use:

- `make verify-v2-live-readiness`
- `make verify-v2-unresolved-checklist-scope` to ensure unresolved checklist
  items stay limited to approved live-only gates
- `make verify-contributing-checked-file-refs` to ensure checked checklist
  references remain truthful against the current repository
- `make verify-live-v2-workflow-run` to accept a successful
  `verify-live-v2-gates.yml` workflow run as evidence for GitHub controls,
  observability, and release-render gates (`WORKFLOW_RUN_ID=latest` supported)
- `make verify-remote-live-v2-workflow-sync` to verify the remote default
  branch contains `.github/workflows/verify-live-v2-gates.yml` and that its
  content matches the local file before dispatch/evidence probes
- `make verify-github-repository-controls-public` as a no-token precheck for
  default-branch protection and required status-check visibility
- `make generate-observability-evidence-from-workflow-run` to create
  `docs/evidence/observability-live-*.txt` from a verified workflow run
- `make generate-rollback-drill-evidence` and
  `make generate-database-restore-drill-evidence` to generate validated drill
  evidence records from captured rollback/restore metadata
- `make generate-v2-live-closeout-status` to generate one artifact with local
  readiness, unresolved checklist audit, env presence, public controls precheck,
  and workflow-evidence probe results
- `make generate-v2-completion-audit` to generate a prompt-to-artifact matrix
  from `CONTRIBUTING.md` (checklist counts, unresolved requirements,
  file-reference existence, `make` target mapping, and gate outputs)
- `make run-live-v2-workflow-evidence-pipeline` to dispatch live gates, verify
  workflow-run evidence, and generate observability evidence in one sequence
  (auto-syncs `.github/workflows/verify-live-v2-gates.yml` before dispatch by
  default; set `AUTO_SYNC_REMOTE_WORKFLOW=false` to skip)
- `CONFIRM_FINALIZE_V2=yes make finalize-v2-live-closeout` for one-command
  preflight + gate verification + checklist marking + audit
  - finalizer now includes remote workflow sync verification by default and
    can auto-sync `.github/workflows/verify-live-v2-gates.yml` when drift is
    detected (`RUN_REMOTE_WORKFLOW_SYNC=true`,
    `AUTO_SYNC_REMOTE_WORKFLOW=true`)
- `make run-live-v2-gates-workflow` (requires token and live environment vars)
  and now consumes workflow-dispatch run details when the API provides them
  (`RETURN_RUN_DETAILS=true` by default, with legacy fallback on validation errors)
- `make audit-v2-contributing-checklist` for pass/fail against unchecked lines
- `make mark-v2-contributing-live-gates` to flip live-gate checkboxes only after
  successful verifier runs
- `make verify-live-v2-inputs` as preflight for required live credentials and
  environment inputs
- `make create-github-app-installation-token` to bootstrap short-lived GitHub
  App installation tokens for repository-controls operations
- `make sync-remote-live-v2-workflow` to sync
  `.github/workflows/verify-live-v2-gates.yml` to the remote default branch
  before dispatch/evidence verification

Optional persistent audit artifact:

```bash
cd gitrank
AUDIT_REPORT_FILE=docs/releases/v2-contributing-audit-latest.md \
make audit-v2-contributing-checklist
```

Use `.env.v2-live-gates.example` as the source template for required
environment variables.

Note: unauthenticated GitHub API calls can hit low per-IP rate limits. Public
prechecks now report this explicitly; switch to token/App-authenticated mode
when that happens.
If GitHub App credentials are present, the public prechecks can auto-bootstrap
short-lived installation tokens.

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
- App integrations without repository `contents:write` and `administration`
  privileges fail with `HTTP 403 Resource not accessible by integration` for
  live controls mutation calls.
  Use `make inspect-github-app-installation-permissions` to capture the
  installation permission map and repository scope before retrying.

How to complete:

1. Provide either:
   - `GITRANK_REPO_ADMIN_TOKEN` (or `GITHUB_TOKEN`) with repository admin scope, or
   - GitHub App credentials (`GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, and
     private-key input) so scripts can bootstrap short-lived installation tokens.
   - Ensure the GitHub App installation has permission to mutate repository
     settings (branch protections/rulesets) and repository contents where
     policy-sync writes are required.
2. Apply:
   - `GITRANK_APPLY_REPOSITORY_CONTROLS=yes make apply-github-repository-controls-auto`
3. Verify:
   - `make verify-github-repository-controls`
4. Optional finalizer bootstrap:
   - `CONFIRM_FINALIZE_V2=yes RUN_GITHUB_CONTROLS=true make finalize-v2-live-closeout`
     can auto-create a short-lived token from GitHub App credentials when
     `GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, and private-key input are set.
5. Optional GitHub Actions bootstrap:
   - `.github/workflows/verify-live-v2-gates.yml` can mint a short-lived token
     from `GITRANK_GITHUB_APP_ID`, `GITRANK_GITHUB_APP_INSTALLATION_ID`, and
     `GITRANK_GITHUB_APP_PRIVATE_KEY_PEM` if `GITRANK_REPO_ADMIN_TOKEN` is unset.
6. Optional workflow-run evidence:
   - `make verify-live-v2-workflow-run` verifies a successful workflow run by
     run ID, and `VERIFY_FROM_WORKFLOW=true` can be passed to
     `make finalize-v2-live-closeout` or `make mark-v2-contributing-live-gates`
     to reuse that evidence during checklist updates. When run ID is omitted in
     workflow mode, latest successful `workflow_dispatch` run is used.
7. If workflow dispatch/evidence fails because the workflow file is absent on
   remote default branch:
   - `make sync-remote-live-v2-workflow`

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
2. Configure explicit staging and production runtime overrides for finalizer proof:
   - `STAGING_K8S_*` and `PRODUCTION_K8S_*` for public base URL, API base URL,
     auth cookie domain, GitHub OAuth redirect URL, API host, auth host, and TLS secret.
   - `REQUIRE_ENV_SPECIFIC_K8S_OVERRIDES=true` (default) enforces these values.
3. Run release render gate for staging and production.
4. Attach rendered artifact + deployment/rollout proof to release evidence.
