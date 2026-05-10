# Secret Rotation Runbook

Use this runbook for planned rotation of GitRank runtime secrets. Do not rotate production and non-production credentials from the same remote secret path.

## Environment Separation

Runtime secrets must use environment-specific remote paths:

- staging: `gitrank/staging/<secret-name>`
- production: `gitrank/production/<secret-name>`

The Kubernetes examples under `deployments/k8s/examples/` include separate ExternalSecret manifests for staging and production. Keep the target Kubernetes Secret name as `gitrank-runtime-secrets`; keep the remote secret-manager paths environment-specific.

## Standard Rotation

1. Create the replacement secret in the secret manager under the same environment path.
2. Confirm the External Secrets controller has reconciled the Kubernetes Secret.
3. Restart only the workloads that consume the rotated secret.
4. Verify `/readyz`, `/healthz`, auth/session behavior, sync execution, and dashboard health.
5. Revoke or delete the old upstream credential after the replacement is verified.
6. Record the rotation time, rotated keys, verifier, and rollback notes in maintainer operations notes.

## Secret-Specific Notes

- `DATABASE_URL`: create a new database user or password first, grant the required permissions, roll services, then revoke the old credential.
- `REDIS_URL`: rotate during a low-traffic window; verify scheduler leases and queue metrics after rollout.
- `GITHUB_CLIENT_SECRET`: update the OAuth app secret, then roll `auth-service` and `api-gateway`.
- `GITHUB_WEBHOOK_SECRET`: GitHub sends signatures with one configured secret at a time. Rotate by updating GitHub webhook configuration and `github-ingestor` close together.
- `OPENAI_API_KEY`: roll `pr-analyzer` after the ExternalSecret refresh.
- `GRAFANA_ADMIN_PASSWORD`: roll `gitrank-grafana` after the ExternalSecret refresh.
- `GITRANK_SESSION_SECRET` and `GITRANK_JWT_SIGNING_KEY`: current v1 rotation invalidates existing browser/session material. Use a maintenance window unless dual-key validation is added later.
- `GITHUB_TOKEN_ENCRYPTION_KEY`: do not rotate blindly. Current v1 requires either a token re-encryption migration or revoking linked GitHub tokens and forcing users to relink accounts.

## Emergency Rotation

1. Treat the old value as compromised.
2. Rotate the upstream provider credential first.
3. Update the environment-specific secret-manager path.
4. Force a workload restart.
5. Invalidate sessions or linked tokens if the compromised secret could protect auth state.
6. Open an incident record and preserve audit logs.

## Verification

Run:

```bash
make verify-secret-policy
```

This static verifier checks that staging and production ExternalSecret examples use separate remote paths and include the required runtime keys. It does not prove a live secret-manager rotation has been executed.
