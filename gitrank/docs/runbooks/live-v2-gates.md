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

- `GITRANK_REPO_ADMIN_TOKEN`
- `GRAFANA_API_TOKEN`

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
GITHUB_TOKEN=... \
TARGET_ENVIRONMENT=staging \
RUN_OBSERVABILITY=true \
RUN_GITHUB_CONTROLS=true \
APPLY_GITHUB_CONTROLS=false \
RUN_RELEASE_RENDER=true \
make run-live-v2-gates-workflow
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
