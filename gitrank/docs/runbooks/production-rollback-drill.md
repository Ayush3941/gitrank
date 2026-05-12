# Production Rollback Drill Runbook

This runbook defines how GitRank proves the production-readiness rollback gate.
The committed Kubernetes workflow already supports render, apply, and rollback
modes, and `make verify-rollback-procedure` verifies that local wiring. The
final production-readiness checkbox remains unchecked until a real staging or
production-like cluster drill is executed and recorded.

Official reference:

- Kubernetes rollout commands: https://kubernetes.io/docs/reference/kubectl/generated/kubectl_rollout/

## Scope

The v1 rollback procedure covers application Deployment rollback for all Go
services:

- `api-gateway`
- `auth-service`
- `github-ingestor`
- `pr-analyzer`
- `profile-service`
- `scheduler-worker`
- `scheduler-job-worker`
- `scoring-engine`

Database migrations are forward-only in v1. Data rollback means managed
PostgreSQL restore or PITR, not reverse SQL migrations.

## Drill Preconditions

- A staging or production-like Kubernetes cluster exists.
- `KUBE_CONFIG_B64` is configured for the manual deployment workflow.
- `gitrank-runtime-secrets` exists in the target namespace.
- Managed PostgreSQL has a recent backup or PITR window.
- Managed Redis is reachable if the target environment enables cache/queue
  features.
- The current deployed image tags and target rollback image tags are known.
- Dashboards and alerts are reachable for the target environment, if deployed.
- For candidate-release apply runs, the deploy workflow runtime override values are configured (`K8S_PUBLIC_BASE_URL`, `K8S_API_BASE_URL`, `K8S_AUTH_COOKIE_DOMAIN`, `K8S_GITHUB_OAUTH_REDIRECT_URL`, `K8S_API_HOST`, `K8S_AUTH_HOST`, `K8S_TLS_SECRET_NAME`) through repository or environment variables/secrets.

## Drill Procedure

1. Record the environment, namespace, cluster, commit SHA, image tags, migration
   version, backup identifier, and operator.
2. Confirm current rollout history:

   ```bash
   kubectl -n gitrank-staging rollout history deployment/api-gateway
   kubectl -n gitrank-staging rollout history deployment/auth-service
   kubectl -n gitrank-staging rollout history deployment/github-ingestor
   kubectl -n gitrank-staging rollout history deployment/pr-analyzer
   kubectl -n gitrank-staging rollout history deployment/profile-service
   kubectl -n gitrank-staging rollout history deployment/scheduler-worker
   kubectl -n gitrank-staging rollout history deployment/scheduler-job-worker
   kubectl -n gitrank-staging rollout history deployment/scoring-engine
   ```

3. Deploy a reversible candidate release to staging. Prefer a change that only
   updates application images and does not require a schema migration.
4. Verify the candidate reaches a healthy state:

   ```bash
   kubectl -n gitrank-staging rollout status deployment/api-gateway --timeout=180s
   kubectl -n gitrank-staging rollout status deployment/auth-service --timeout=180s
   kubectl -n gitrank-staging rollout status deployment/github-ingestor --timeout=180s
   kubectl -n gitrank-staging rollout status deployment/pr-analyzer --timeout=180s
   kubectl -n gitrank-staging rollout status deployment/profile-service --timeout=180s
   kubectl -n gitrank-staging rollout status deployment/scheduler-worker --timeout=180s
   kubectl -n gitrank-staging rollout status deployment/scheduler-job-worker --timeout=180s
   kubectl -n gitrank-staging rollout status deployment/scoring-engine --timeout=180s
   ```

5. Trigger rollback through the manual `Deploy Kubernetes` workflow with
   `rollback=true`. Leave `rollback_revision` empty to use the previous
   revision, or set it to the known good revision recorded in step 2.
6. Confirm every deployment returns to a healthy state with `kubectl rollout
   status`.
7. Run the critical product checks against the rolled-back environment:

   - GitHub OAuth callback path returns a controlled response.
   - Authenticated profile read returns expected shape.
   - Sync trigger returns accepted or rate-limited, not a server error.
   - Public profile read shows stale/partial state if data is not fresh.
   - Prometheus/Grafana health checks remain reachable when observability is
     deployed.

8. Confirm no unexpected database migration rollback was attempted.
9. Record evidence and any follow-up actions.

## Emergency Manual Rollback

If the GitHub Actions workflow is unavailable but cluster access is available,
rollback can be performed directly:

```bash
kubectl -n gitrank-production rollout undo deployment/api-gateway
kubectl -n gitrank-production rollout undo deployment/auth-service
kubectl -n gitrank-production rollout undo deployment/github-ingestor
kubectl -n gitrank-production rollout undo deployment/pr-analyzer
kubectl -n gitrank-production rollout undo deployment/profile-service
kubectl -n gitrank-production rollout undo deployment/scheduler-worker
kubectl -n gitrank-production rollout undo deployment/scheduler-job-worker
kubectl -n gitrank-production rollout undo deployment/scoring-engine
```

Then verify:

```bash
kubectl -n gitrank-production rollout status deployment/api-gateway --timeout=180s
kubectl -n gitrank-production rollout status deployment/auth-service --timeout=180s
kubectl -n gitrank-production rollout status deployment/github-ingestor --timeout=180s
kubectl -n gitrank-production rollout status deployment/pr-analyzer --timeout=180s
kubectl -n gitrank-production rollout status deployment/profile-service --timeout=180s
kubectl -n gitrank-production rollout status deployment/scheduler-worker --timeout=180s
kubectl -n gitrank-production rollout status deployment/scheduler-job-worker --timeout=180s
kubectl -n gitrank-production rollout status deployment/scoring-engine --timeout=180s
```

## Evidence Record

Start from:

```bash
cp docs/evidence/rollback-drill-template.txt docs/evidence/rollback-drill-YYYY-MM-DD.txt
```

Validate before marking the gate complete:

```bash
make verify-rollback-drill-evidence EVIDENCE_FILE=docs/evidence/rollback-drill-YYYY-MM-DD.txt
```

Attach the completed evidence to the release issue or maintainer operations
notes. Only then may the production-readiness rollback checkbox in
`CONTRIBUTING.md` be checked.
