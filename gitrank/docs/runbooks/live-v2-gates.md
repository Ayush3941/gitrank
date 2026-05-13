# Live V2 Gates Workflow

This runbook executes the remaining live-only V2 verification steps through one
manual GitHub Actions workflow:

- `.github/workflows/verify-live-v2-gates.yml`

The workflow is a reproducible gate runner for:

- live GitHub repository-controls verification
- live observability verification
- environment-specific release render verification with placeholder rejection

It does not execute the managed PostgreSQL restore drill; use
`docs/runbooks/database-restore-drill.md` for restore evidence.

## Required Repository Or Environment Secrets

- `GITRANK_REPO_ADMIN_TOKEN` (or `GITHUB_TOKEN`)
- `GRAFANA_API_TOKEN`

Optional GitHub App bootstrap secrets (used when repo-admin token secret is not set):

- `GITRANK_GITHUB_APP_ID`
- `GITRANK_GITHUB_APP_INSTALLATION_ID`
- `GITRANK_GITHUB_APP_PRIVATE_KEY_PEM`

## Required Repository Or Environment Variables

- `PROMETHEUS_BASE_URL`
- `GRAFANA_BASE_URL`
- `K8S_IMAGE_REGISTRY_OWNER` (optional if default owner is acceptable)
- `K8S_PUBLIC_BASE_URL`
- `K8S_API_BASE_URL`
- `K8S_AUTH_COOKIE_DOMAIN`
- `K8S_GITHUB_OAUTH_REDIRECT_URL`
- `K8S_API_HOST`
- `K8S_AUTH_HOST`
- `K8S_TLS_SECRET_NAME`

Optional observability tuning variables:

- `OBS_EXPECTED_SERVICES`
- `OBS_EXPECTED_ALERT_GROUPS`
- `OBS_EXPECTED_DASHBOARD_TITLES`
- `K8S_GITHUB_USER_AGENT`

## Execute

1. Open Actions and run `Verify Live V2 Gates`.
2. Select `staging` or `production`.
3. Keep all toggles enabled unless you are intentionally isolating one gate.
4. Set `apply_github_controls=true` only when you intend to mutate branch
   protection and repository security settings in the selected environment.
5. Review the run logs.
6. Attach the run URL to release notes or maintainer operations notes.

### API Dispatch Option

You can dispatch and optionally wait for completion from CLI:

```bash
cd gitrank
GITHUB_REPOSITORY=OWNER/REPO \
GITRANK_REPO_ADMIN_TOKEN=... \
TARGET_ENVIRONMENT=staging \
RUN_OBSERVABILITY=true \
RUN_GITHUB_CONTROLS=true \
APPLY_GITHUB_CONTROLS=false \
RUN_RELEASE_RENDER=true \
make run-live-v2-gates-workflow
```

If you need a short-lived token for repository-controls operations, use:

```bash
cd gitrank
GITHUB_APP_ID=... \
GITHUB_APP_INSTALLATION_ID=... \
GITHUB_APP_PRIVATE_KEY_FILE=/path/to/app-private-key.pem \
TOKEN_OUTPUT_FILE=/tmp/gitrank-app-token.txt \
make create-github-app-installation-token
```

## Local Static Workflow Check

Use this before merge to ensure the workflow wiring remains intact:

```bash
cd gitrank
make verify-live-v2-workflow
```

## Local Orchestrated Gate Runner

Use the orchestrator to run static gates and optional live gates from one
command:

```bash
cd gitrank
make verify-v2-live-readiness
```

To verify a completed Actions run as live-gate evidence (without rerunning
those checks locally), use:

```bash
cd gitrank
GITHUB_REPOSITORY=OWNER/REPO \
GITRANK_REPO_ADMIN_TOKEN=... \
WORKFLOW_RUN_ID=12345678901 \
REQUIRE_GITHUB_CONTROLS=true \
REQUIRE_OBSERVABILITY=true \
REQUIRE_RELEASE_RENDER=true \
make verify-live-v2-workflow-run
```

For a no-token public precheck of repository-controls posture:

```bash
cd gitrank
GITHUB_REPOSITORY=OWNER/REPO \
make verify-github-repository-controls-public
```

To check recent workflow health on `origin` without a token (defaults to
default-branch `push` runs), use:

```bash
cd gitrank
make verify-public-workflow-health
```

When Trivy is unhealthy, this command also inspects remote
`.github/workflows/trivy.yml` and `.trivyignore.yaml` on the relevant branch
to report whether ignore-policy wiring is missing.

To sync local Trivy policy files to the remote default branch (token required):

```bash
cd gitrank
GITHUB_REPOSITORY=OWNER/REPO \
GITRANK_REPO_ADMIN_TOKEN=... \
make sync-remote-trivy-policy
```

Set `DRY_RUN=true` to preview updates without writing.

To evaluate recent runs across all branches (for example pull requests), set:

```bash
cd gitrank
WORKFLOW_EVENT=pull_request \
WORKFLOW_BRANCH=any \
make verify-public-workflow-health
```

`make finalize-v2-live-closeout` now runs this public workflow-health gate by
default (`RUN_PUBLIC_WORKFLOW_HEALTH=true`) so final closeout catches
`origin`-side workflow regressions.

To generate a single closeout status artifact (branch divergence + local gates +
unresolved checklist audit + live-input probes + public workflow health +
workflow-evidence probes):

```bash
cd gitrank
OUTPUT_FILE=docs/releases/v2-live-closeout-status-latest.md \
make generate-v2-live-closeout-status
```

To generate a full V2 completion matrix (checklist counts, unresolved lines,
file-reference existence, `make` target mapping, and gate outputs):

```bash
cd gitrank
OUTPUT_FILE=docs/releases/v2-completion-audit-latest.md \
make generate-v2-completion-audit
```

To generate rollback and restore evidence files from recorded drill metadata:

```bash
cd gitrank
OUTPUT_FILE=docs/evidence/rollback-drill-YYYY-MM-DD.txt \
ENVIRONMENT=staging \
CLUSTER=your-cluster \
NAMESPACE=gitrank \
OPERATOR=your-name \
STARTING_COMMIT=<sha> \
CANDIDATE_COMMIT=<sha> \
ROLLBACK_TARGET_REVISION=<revision> \
DATABASE_BACKUP_MARKER=<backup-or-pitr-id> \
WORKFLOW_RUN_URL=https://github.com/OWNER/REPO/actions/runs/<id> \
ROLLOUT_HISTORY_CAPTURED=yes \
ROLLBACK_MODE=deploy-workflow-rollback \
ROLLOUT_STATUS_RESULTS=all-rollouts-healthy \
CRITICAL_PRODUCT_CHECKS=all-pass \
make generate-rollback-drill-evidence

OUTPUT_FILE=docs/evidence/database-restore-drill-YYYY-MM-DD.txt \
ENVIRONMENT=staging \
CLUSTER=your-cluster \
NAMESPACE=gitrank \
OPERATOR=your-name \
RESTORE_SOURCE=managed-postgres-backup \
RESTORE_TARGET=staging-recovery-instance \
BACKUP_IDENTIFIER=<backup-id> \
RESTORE_START_TIMESTAMP=2026-05-12T10:00:00Z \
RESTORE_COMPLETION_TIMESTAMP=2026-05-12T10:14:00Z \
RESTORE_COMMAND_OR_WORKFLOW=cloud-provider-restore-workflow \
SCHEMA_MIGRATION_STATE=up-to-date \
CRITICAL_PRODUCT_CHECKS=all-pass \
make generate-database-restore-drill-evidence
```

Optional strict filters:

- `WORKFLOW_EVENT=workflow_dispatch` (default)
- `EXPECTED_WORKFLOW_PATH=.github/workflows/verify-live-v2-gates.yml` (default)
- `EXPECTED_HEAD_BRANCH=main` (optional)

You can also resolve the most recent successful workflow-dispatch run:

```bash
cd gitrank
GITHUB_REPOSITORY=OWNER/REPO \
WORKFLOW_RUN_ID=latest \
WORKFLOW_EVENT=workflow_dispatch \
make verify-live-v2-workflow-run
```

To generate an observability evidence record from a successful live-gates run:

```bash
cd gitrank
GITHUB_REPOSITORY=OWNER/REPO \
WORKFLOW_RUN_ID=12345678901 \
OUTPUT_FILE=docs/evidence/observability-live-YYYY-MM-DD.txt \
ENVIRONMENT=staging \
CLUSTER=your-cluster \
NAMESPACE=gitrank \
OPERATOR=your-name \
make generate-observability-evidence-from-workflow-run
```

To dispatch live gates, verify the resulting workflow run, and generate
observability evidence in one command:

```bash
cd gitrank
CONFIRM_RUN_LIVE_V2_PIPELINE=yes \
GITHUB_REPOSITORY=OWNER/REPO \
GITRANK_REPO_ADMIN_TOKEN=... \
TARGET_ENVIRONMENT=staging \
RUN_GITHUB_CONTROLS=true \
RUN_OBSERVABILITY=true \
RUN_RELEASE_RENDER=true \
ENVIRONMENT=staging \
CLUSTER=your-cluster \
NAMESPACE=gitrank \
OPERATOR=your-name \
make run-live-v2-workflow-evidence-pipeline
```

If the workflow already ran and you only want evidence generation from the
latest successful run:

```bash
cd gitrank
CONFIRM_RUN_LIVE_V2_PIPELINE=yes \
DISPATCH_WORKFLOW=false \
USE_LATEST_SUCCESSFUL_RUN=true \
VERIFY_WORKFLOW_RUN=true \
GENERATE_OBSERVABILITY_EVIDENCE=true \
GITHUB_REPOSITORY=OWNER/REPO \
ENVIRONMENT=staging \
CLUSTER=your-cluster \
NAMESPACE=gitrank \
OPERATOR=your-name \
make run-live-v2-workflow-evidence-pipeline
```

Use this check to ensure unresolved `CONTRIBUTING.md` items remain constrained
to the approved live-gate list:

```bash
cd gitrank
make verify-v2-unresolved-checklist-scope
```

Use this check to ensure checked checklist references remain truthful:

```bash
cd gitrank
make verify-contributing-checked-file-refs
```

Use input preflight before live runs:

```bash
cd gitrank
cp .env.v2-live-gates.example .env.v2-live-gates.local
# edit values, then export them
set -a
source .env.v2-live-gates.local
set +a

RUN_GITHUB_CONTROLS=true \
RUN_OBSERVABILITY=true \
RUN_RELEASE_RENDER=true \
make verify-live-v2-inputs
```

Enable live checks by setting environment flags and required credentials:

```bash
RUN_GITHUB_CONTROLS=true \
RUN_OBSERVABILITY=true \
RUN_RELEASE_RENDER=true \
K8S_ENVIRONMENT=staging \
OUTPUT_FILE=/tmp/rendered-k8s.yaml \
make verify-v2-live-readiness
```

After live verifiers pass and evidence files are available, you can mark the
corresponding `CONTRIBUTING.md` checkboxes with:

```bash
cd gitrank
CONFIRM_MARK_CONTRIBUTING=yes \
MARK_GITHUB_CONTROLS=true \
MARK_OBSERVABILITY=true \
OBS_EVIDENCE_FILE=docs/evidence/observability-live-YYYY-MM-DD.txt \
MARK_ROLLBACK_RESTORE=true \
ROLLBACK_EVIDENCE_FILE=docs/evidence/rollback-drill-YYYY-MM-DD.txt \
RESTORE_EVIDENCE_FILE=docs/evidence/database-restore-drill-YYYY-MM-DD.txt \
MARK_K8S_RUNTIME=true \
STAGING_RENDER_OUTPUT=/tmp/staging-rendered-k8s.yaml \
PRODUCTION_RENDER_OUTPUT=/tmp/production-rendered-k8s.yaml \
make mark-v2-contributing-live-gates
```

If these gates were already validated in Actions, you can verify from a
workflow run ID while still enforcing rollback and restore evidence files:

```bash
cd gitrank
CONFIRM_MARK_CONTRIBUTING=yes \
VERIFY_FROM_WORKFLOW=true \
# optional: WORKFLOW_RUN_ID=12345678901 (defaults to latest successful workflow_dispatch run)
MARK_GITHUB_CONTROLS=true \
MARK_OBSERVABILITY=true \
OBS_EVIDENCE_FILE=docs/evidence/observability-live-YYYY-MM-DD.txt \
MARK_ROLLBACK_RESTORE=true \
ROLLBACK_EVIDENCE_FILE=docs/evidence/rollback-drill-YYYY-MM-DD.txt \
RESTORE_EVIDENCE_FILE=docs/evidence/database-restore-drill-YYYY-MM-DD.txt \
MARK_K8S_RUNTIME=true \
make mark-v2-contributing-live-gates
```

## One-Command Final Closeout

Use the finalizer when you want one command to run verifier preflight, live
gate checks, rollback or restore evidence checks, checklist marking, and the
final unresolved-checklist audit.

```bash
cd gitrank
cp .env.v2-live-gates.example .env.v2-live-gates.local
# edit values, then export them
set -a
source .env.v2-live-gates.local
set +a

CONFIRM_FINALIZE_V2=yes \
make finalize-v2-live-closeout
```

If `RUN_GITHUB_CONTROLS=true` and no GitHub token is set, the finalizer can
auto-bootstrap a short-lived installation token when
`GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, and
`GITHUB_APP_PRIVATE_KEY_FILE` (or `GITHUB_APP_PRIVATE_KEY_PEM`) are provided.

If those live checks already succeeded in GitHub Actions, you can use workflow
run evidence during finalization:

```bash
cd gitrank
CONFIRM_FINALIZE_V2=yes \
VERIFY_FROM_WORKFLOW=true \
# optional: WORKFLOW_RUN_ID=12345678901 (defaults to latest successful workflow_dispatch run)
RUN_GITHUB_CONTROLS=true \
RUN_OBSERVABILITY=true \
RUN_K8S_RUNTIME=true \
make finalize-v2-live-closeout
```

When `VERIFY_FROM_WORKFLOW=true`, finalization can auto-generate
`OBS_EVIDENCE_FILE` (if unset) when these are provided:

- `ENVIRONMENT`
- `CLUSTER`
- `NAMESPACE`
- `OPERATOR`

Per-environment render overrides for finalizer runtime proof:

- `REQUIRE_ENV_SPECIFIC_K8S_OVERRIDES=true` (default)
- required when `RUN_K8S_RUNTIME=true` and `VERIFY_FROM_WORKFLOW!=true`:
- `STAGING_K8S_PUBLIC_BASE_URL`, `PRODUCTION_K8S_PUBLIC_BASE_URL`
- `STAGING_K8S_API_BASE_URL`, `PRODUCTION_K8S_API_BASE_URL`
- `STAGING_K8S_AUTH_COOKIE_DOMAIN`, `PRODUCTION_K8S_AUTH_COOKIE_DOMAIN`
- `STAGING_K8S_GITHUB_OAUTH_REDIRECT_URL`, `PRODUCTION_K8S_GITHUB_OAUTH_REDIRECT_URL`
- `STAGING_K8S_API_HOST`, `PRODUCTION_K8S_API_HOST`
- `STAGING_K8S_AUTH_HOST`, `PRODUCTION_K8S_AUTH_HOST`
- `STAGING_K8S_TLS_SECRET_NAME`, `PRODUCTION_K8S_TLS_SECRET_NAME`
- optional image overrides:
- `STAGING_IMAGE_TAG`, `PRODUCTION_IMAGE_TAG`
- `STAGING_IMAGE_REGISTRY_OWNER`, `PRODUCTION_IMAGE_REGISTRY_OWNER`
- set `REQUIRE_ENV_SPECIFIC_K8S_OVERRIDES=false` only for temporary single-environment rehearsal runs where shared runtime values are intentional.
