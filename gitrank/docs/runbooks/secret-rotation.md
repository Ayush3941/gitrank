# Secret Rotation Runbook

Use this runbook for planned rotation of GitRank runtime secrets. Do not rotate production and non-production credentials from the same remote secret path.

## Environment Separation

Runtime secrets must use environment-specific remote paths:

- staging: `gitrank/staging/<secret-name>`
- production: `gitrank/production/<secret-name>`

The Kubernetes examples under `deployments/k8s/examples/` include separate ExternalSecret manifests for staging and production. Keep the target Kubernetes Secret name as `gitrank-runtime-secrets`; keep the remote secret-manager paths environment-specific.

## Standard Rotation

1. Move the current value into the matching `PREVIOUS_*` key when the service supports key-ring rotation.
2. Create the replacement primary secret in the secret manager under the same environment path.
3. Confirm the External Secrets controller has reconciled the Kubernetes Secret.
4. Restart only the workloads that consume the rotated secret.
5. Verify `/readyz`, `/healthz`, auth/session behavior, sync execution, and dashboard health.
6. Revoke or delete the old upstream credential after the overlap window is verified complete.
7. Record the rotation time, rotated keys, verifier, and rollback notes in maintainer operations notes.

## Key-Ring Rotation

`auth-service`, `api-gateway`, and GitHub ingestion support a current-plus-previous key ring for auth-sensitive material. Primary keys are always used for new state, sessions, CSRF values, and encrypted GitHub token writes. Previous keys are accepted only to keep existing sessions, OAuth browser-state records, and encrypted OAuth tokens usable during a planned rotation window.

- `GITRANK_PREVIOUS_SESSION_SECRETS`: comma-separated previous session secrets. Keep the old secret here until the maximum of `AUTH_SESSION_TTL`, `AUTH_SESSION_IDLE_TTL`, and `AUTH_OAUTH_STATE_TTL` has elapsed, then remove it and roll the services again.
- `GITHUB_PREVIOUS_TOKEN_ENCRYPTION_KEYS`: comma-separated previous base64-encoded 32-byte AES keys. Keep old keys here until linked GitHub tokens have been refreshed/re-encrypted or affected users have relinked accounts.
- Do not put future keys into `PREVIOUS_*`; the first key remains the only write key.
- Keep staging and production rotation windows separate. Never copy previous production secrets into staging or local `.env` files.

## Secret-Specific Notes

- `DATABASE_URL`: create a new database user or password first, grant the required permissions, roll services, then revoke the old credential.
- `REDIS_URL`: rotate during a low-traffic window; verify scheduler leases and queue metrics after rollout.
- `GITHUB_CLIENT_SECRET`: update the OAuth app secret, then roll `auth-service` and `api-gateway`.
- `GITHUB_WEBHOOK_SECRET`: GitHub sends signatures with one configured secret at a time. Rotate by updating GitHub webhook configuration and `github-ingestor` close together.
- `GEMINI_API_KEY`: roll `pr-analyzer` after the ExternalSecret refresh.
- `GRAFANA_ADMIN_PASSWORD`: roll `gitrank-grafana` after the ExternalSecret refresh.
- `GITRANK_SESSION_SECRET`: move the previous value into `GITRANK_PREVIOUS_SESSION_SECRETS`, deploy the new primary value, then rely on normal session rotation to reissue primary-key material.
- `GITRANK_JWT_SIGNING_KEY`: no current JWT issuer depends on this key for browser sessions. If JWT issuance is added later, add a `kid`-based signing-key ring before rotating without invalidation.
- `GITHUB_TOKEN_ENCRYPTION_KEY`: move the previous base64 key into `GITHUB_PREVIOUS_TOKEN_ENCRYPTION_KEYS`, deploy the new primary key, then let token refresh/re-encryption migrate active linked accounts. Force relink only if decrypt fails after the overlap window.

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
