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
  with built-in fallback to `WORKFLOW_EVENT=any` when latest
  `workflow_dispatch` lookup misses
  (`WORKFLOW_EVENT_FALLBACK_ANY=true` by default)
  - `.github/workflows/verify-live-v2-gates.yml` now also supports a scoped
    `push` trigger on `main` when that workflow file itself changes, so you can
    exercise the live-gates workflow without a dispatch token by merging a
    workflow update; use `WORKFLOW_EVENT=any` in verification when relying on
    this path
- `make verify-remote-live-v2-workflow-sync` to verify the remote default
  branch contains `.github/workflows/verify-live-v2-gates.yml` and that its
  content matches the local file before dispatch/evidence probes
- `make verify-github-repository-controls-public` as a no-token precheck for
  default-branch protection and required status-check visibility
- `make generate-observability-evidence-from-workflow-run` to create
  `docs/evidence/observability-live-*.txt` from a verified workflow run. Latest
  `workflow_dispatch` lookup misses now retry with `WORKFLOW_EVENT=any` by
  default (`WORKFLOW_EVENT_FALLBACK_ANY=true`).
- `make generate-rollback-drill-evidence` and
  `make generate-database-restore-drill-evidence` to generate validated drill
  evidence records from captured rollback/restore metadata
- `make generate-v2-live-closeout-status` to generate one artifact with local
  readiness, unresolved checklist audit, env presence, public controls precheck,
  and workflow-evidence probe results
  - `CHECK_PUBLIC_WORKFLOW_HEALTH` supports `auto|true|false` (default `auto`,
    which enables the public workflow-health probe when token/App credentials
    are present or when the repository is publicly accessible for no-token probe
    fallback)
  - set `CHECK_PUBLIC_WORKFLOW_HEALTH=false` to force offline snapshots without
    attempting `make verify-public-workflow-health`
  - `CHECKLIST_AUDIT_RUN_PUBLIC_PROBE` supports `auto|true|false` (default
    `auto`, which enables probe calls when token/App credentials are present or
    when the repository is publicly accessible for no-token probe fallback)
  - set `CHECKLIST_AUDIT_RUN_PUBLIC_PROBE=false` to run the embedded checklist
    audit without live GitHub probe calls (useful for offline/rate-limited local
    snapshots)
  - set `CHECK_LOCAL_READINESS=false` when this report is called from other
    local verification scripts to avoid nested readiness recursion
  - report output uses `OWNER/REPO` by default for repository display labels;
    set `GITHUB_REPOSITORY_DISPLAY=owner/repo` when you explicitly want the
    concrete repository identifier in generated artifacts
- `make report-live-v2-env-presence` for a quick set/unset snapshot of live-gate
  environment inputs (without printing secret values)
- `make generate-v2-completion-audit` to generate a prompt-to-artifact matrix
  from `CONTRIBUTING.md` (checklist counts, unresolved requirements,
  file-reference existence, `make` target mapping, and gate outputs)
  - `CHECK_PUBLIC_WORKFLOW_HEALTH` supports `auto|true|false` (default `auto`,
    which enables the public workflow-health probe when token/App credentials
    are present or when the repository is publicly accessible for no-token probe
    fallback)
  - in `auto`, missing token/App credentials emit
    `auto-disabled: no GitHub token/App credentials` only when public no-token
    fallback is unavailable
  - `CHECKLIST_AUDIT_RUN_PUBLIC_PROBE` supports `auto|true|false` (default
    `auto`, which enables probe calls when token/App credentials are present or
    when the repository is publicly accessible for no-token probe fallback)
  - set `CHECKLIST_AUDIT_RUN_PUBLIC_PROBE=false` to keep the embedded checklist
    audit deterministic in offline/rate-limited local runs
  - if you intentionally skip probe execution (for example, `RUN_CHECKS=false`
    or probe-specific `CHECK_*` toggles), provide explicit waiver reasons via:
    `WAIVE_RUN_CHECKS`, `WAIVE_PUBLIC_WORKFLOW_HEALTH`,
    `WAIVE_REMOTE_LIVE_WORKFLOW_SYNC`,
    `WAIVE_LIVE_GITHUB_ACCESS_PREFLIGHT`,
    `WAIVE_PUBLIC_GITHUB_CONTROLS_PRECHECK`,
    `WAIVE_WORKFLOW_EVIDENCE_PROBE`.
- `make verify-v2-completion-audit-behavior` to regression-test completion
  audit defaults (repository display redaction, waiver reporting, and skip
  behavior) without requiring live credentials
- `make verify-v2-artifact-redaction` to regression-test default repository
  redaction across generated V2 artifacts (`audit`, `closeout`, and
  `completion` reports), with optional `GITHUB_REPOSITORY_DISPLAY` override
- `make run-live-v2-workflow-evidence-pipeline` to dispatch live gates, verify
  workflow-run evidence, and generate observability evidence in one sequence
  (auto-syncs `.github/workflows/verify-live-v2-gates.yml` before dispatch by
  default; set `AUTO_SYNC_REMOTE_WORKFLOW=false` to skip). Workflow-event
  fallback behavior is delegated to `make verify-live-v2-workflow-run`.
- `CONFIRM_FINALIZE_V2=yes make finalize-v2-live-closeout` for one-command
  preflight + gate verification + checklist marking + audit
  - finalizer now includes remote workflow sync verification by default and
    can auto-sync `.github/workflows/verify-live-v2-gates.yml` when drift is
    detected (`RUN_REMOTE_WORKFLOW_SYNC=true`,
    `AUTO_SYNC_REMOTE_WORKFLOW=true`)
  - workflow evidence verification in finalizer mode now uses
    `make verify-live-v2-workflow-run` directly, including its event fallback.
- `make run-live-v2-gates-workflow` (requires token and live environment vars)
  and now consumes workflow-dispatch run details when the API provides them
  (`RETURN_RUN_DETAILS=true` by default, with legacy fallback on validation errors)
- `make audit-v2-contributing-checklist` for pass/fail against unchecked lines
  - public probe snapshot uses `OWNER/REPO` display by default; set
    `GITHUB_REPOSITORY_DISPLAY=owner/repo` to show a concrete repository label
  - when `GITHUB_TOKEN`/`GH_TOKEN`/`GITRANK_REPO_ADMIN_TOKEN` (or GitHub App
    credentials) are available, the public probe snapshot now uses
    authenticated API calls to reduce rate-limit noise
  - set `RUN_PUBLIC_PROBE=false` to skip live GitHub probe calls during
    local/offline runs while still emitting a structured skipped-probe note
- `make mark-v2-contributing-live-gates` to flip live-gate checkboxes only after
  successful verifier runs. In workflow-evidence mode it now delegates
  workflow-run lookup behavior to `make verify-live-v2-workflow-run`.
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
prechecks now report this explicitly; `make verify-github-repository-controls-public`
also falls back to public `rules` and `branches` page embedded data so it can
still report concrete missing controls for public repositories. Switch to
token/App-authenticated mode for full verification.
If GitHub App credentials are present, the public prechecks can auto-bootstrap
short-lived installation tokens.

## Current Snapshot (2026-05-15 UTC)

- `make verify-v2-live-readiness`: pass
- `make verify-public-workflow-health`: pass on the current default repository
- `make verify-remote-live-v2-workflow-sync`: fail; remote
  `.github/workflows/verify-live-v2-gates.yml` still drifts from local content
- `make verify-live-github-access`: fail without
  `GITHUB_TOKEN`/`GH_TOKEN`/`GITRANK_REPO_ADMIN_TOKEN` (or GitHub App creds)
- `make verify-github-repository-controls-public`: fail; `main` is unprotected,
  no effective branch rulesets are visible, and dependency graph appears
  disabled in public UI probes
- `make verify-live-v2-workflow-run`: fail; no successful
  `Verify Live V2 Gates` run was found and the workflow badge reports
  `no status` for `workflow_dispatch`
- Direct GitHub connector mutation attempts against
  `Ayush3941/gitrank` still fail with
  `HTTP 403 Resource not accessible by integration` on
  `repos/contents` writes, so remote workflow sync and repository-controls
  apply/verify remain blocked without usable PAT/App credentials in the runtime
  environment.
- `make audit-v2-contributing-checklist`: fail with `unchecked items: 11`
- Public workflow probe for `.github/workflows/verify-live-v2-gates.yml`:
  `total runs: 0` (no successful workflow-run evidence exists yet)
- Public branch-policy probe:
  `main` is currently unprotected and branch-rules endpoint returns no effective
  rules, so repository-controls gates cannot be marked complete yet
- Remaining unchecked items are now limited to live-only gates for production
  observability and GitHub repository controls.

## 1) Production Observability On Live Traffic

Checklist refs:

- `Production observability exists`
- `Deploy and verify production observability against real traffic ...`

Current local evidence:

- `make verify-observability-manifests` passes.
- Local production-like drill now passes:
  - `make verify-live-observability`
  - `make verify-observability-evidence EVIDENCE_FILE=docs/evidence/observability-live-2026-05-15-local.txt`
- Evidence file:
  - `docs/evidence/observability-live-2026-05-15-local.txt`

How to complete:

1. Configure hosted staging/production Prometheus and Grafana endpoints plus
   Grafana API token.
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
- Required-check discovery now prefers default-branch head contexts and falls
  back to recent successful default-branch workflow runs when head contexts are
  temporarily empty.
- Auto-apply now uses the same fallback path when deriving
  `GITRANK_REQUIRED_STATUS_CHECKS` automatically.
- Verification fails closed without admin token.
- App integrations without repository `contents:write` and `administration`
  privileges fail with `HTTP 403 Resource not accessible by integration` for
  live controls mutation calls.
  Use `make inspect-github-app-installation-permissions` to capture the
  installation permission map and repository scope before retrying.
- Current connector snapshot (2026-05-15): available installed accounts are
  `DinasPratap` and `Reputation-DAO`, while this repository resolves to
  `Ayush3941/gitrank`; connector writes to that repository currently fail with
  `HTTP 403 Resource not accessible by integration`.
- A direct connector file-update probe on
  `.github/workflows/verify-live-v2-gates.yml` also failed with
  `HTTP 403 Resource not accessible by integration`
  (`create-or-update-file-contents`), confirming workflow sync cannot be
  completed via the current integration scope.

How to complete:

1. Provide either:
   - `GITRANK_REPO_ADMIN_TOKEN` (or `GITHUB_TOKEN`) with repository admin scope, or
   - GitHub App credentials (`GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, and
     private-key input) so scripts can bootstrap short-lived installation tokens.
   - or OAuth web-flow bootstrap inputs (`GITHUB_CLIENT_ID`,
     `GITHUB_CLIENT_SECRET`) and run with
     `GITRANK_ALLOW_OAUTH_WEB_TOKEN_BOOTSTRAP=yes` (apply/verify scripts) or
     `AUTO_CREATE_GITHUB_OAUTH_WEB_TOKEN=true` (finalizer).
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
   - `make finalize-v2-live-closeout-via-oauth-web-flow` can run the same
     closeout path using OAuth web-flow token bootstrap.
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
  Use `WORKFLOW_EVENT=any` to search successful runs across all events.
7. If workflow dispatch/evidence fails because the workflow file is absent on
   remote default branch:
   - `make sync-remote-live-v2-workflow`

## 3) Rollback And Restore Drills Executed And Recorded

Checklist refs:

- `rollback procedures are documented and tested` (`checked`)
- `Run and record staging rollback and restore drills` (`checked`)

Current local evidence:

- `make verify-rollback-procedure` passes.
- `make verify-rollback-drill-evidence EVIDENCE_FILE=docs/evidence/rollback-drill-2026-05-15-local.txt` passes.
- `make verify-database-restore-drill-evidence EVIDENCE_FILE=docs/evidence/database-restore-drill-2026-05-15-local.txt` passes.

## 4) Environment-Specific Kubernetes Runtime Proof

Checklist ref:

- `Replace provider-neutral Kubernetes placeholders with environment-specific secrets, TLS, ingress, managed PostgreSQL, managed Redis, registry, and environment-tuned autoscaling thresholds` (`checked`)

Current local evidence:

- `make render-k8s-release-manifests` passes with environment-specific staging
  and production runtime values.
- Rendered evidence artifacts:
  - `docs/evidence/rendered-k8s-staging-2026-05-15.yaml`
  - `docs/evidence/rendered-k8s-production-2026-05-15.yaml`
