# Live V2 Gates Workflow

This runbook executes the remaining live-only V2 verification steps through one
manual GitHub Actions workflow:

- `.github/workflows/verify-live-v2-gates.yml`

The workflow is a reproducible gate runner for:

- live GitHub repository-controls verification
- live observability verification
- environment-specific release render verification with placeholder rejection

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
4. Review the run logs.
5. Attach the run URL to release notes or maintainer operations notes.

## Local Static Workflow Check

Use this before merge to ensure the workflow wiring remains intact:

```bash
cd gitrank
make verify-live-v2-workflow
```
