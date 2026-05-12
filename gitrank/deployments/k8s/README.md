# Kubernetes Baseline

GitRank uses Kubernetes as the v1 deployment baseline.

Current committed assets in this directory include:

- `base/namespace.yaml`
- `base/kustomization.yaml`
- `base/configmap.yaml`
- `base/serviceaccount.yaml`
- `base/deployments.yaml`
- `base/hpa.yaml`
- `base/services.yaml`
- `base/ingress.yaml`
- `base/migration-job.yaml`
- `overlays/staging/`
- `overlays/production/`
- `examples/runtime-secret.example.yaml`
- `examples/external-secret.example.yaml`
- `examples/external-secret.staging.example.yaml`
- `examples/external-secret.production.example.yaml`

The base deploys the seven Go service API deployments, a separate `scheduler-job-worker` execution deployment, ClusterIP Services, an ingress for `api-gateway` and `auth-service`, and a migration Job. Staging and production overlays set namespaces, public URLs, ingress hosts, and image replacement points.
The base also defines HorizontalPodAutoscaler resources for every backend deployment.

`scheduler-worker` runs with `SCHEDULER_RUN_MODE=api` and exposes scheduler HTTP operations through the `scheduler-worker` ClusterIP Service. `scheduler-job-worker` uses the same OCI image with `SCHEDULER_RUN_MODE=worker`, has no ClusterIP Service, and leases durable scheduler jobs directly from PostgreSQL for long-running sync, analysis, scoring, profile, PR-report, leaderboard, and quest materialization work.

Before applying the manifests, create or sync a `gitrank-runtime-secrets` Secret in the target namespace. The example manifests show both a direct Kubernetes Secret shape and External Secrets Operator shapes, but no secret example is included in the base kustomization. Use distinct remote secret paths for staging and production, including separate `PREVIOUS_*` paths for planned auth/session and GitHub token-encryption key overlap windows.

Render locally:

```bash
kubectl kustomize deployments/k8s/overlays/staging
kubectl kustomize deployments/k8s/overlays/production
```

Deployments can also be rendered, applied, or rolled back through the manual `Deploy Kubernetes` GitHub Actions workflow. Its default mode only renders manifests; cluster apply or rollback requires `KUBE_CONFIG_B64`.

Rollback procedure:

1. Open the `Deploy Kubernetes` workflow.
2. Select the `staging` or `production` environment.
3. Set `rollback` to `true` and leave `apply` as `false`.
4. Optionally set `rollback_revision` to a Kubernetes deployment revision; leave it empty to roll back each deployment to its previous revision.
5. Confirm every service and `scheduler-job-worker` report a successful `kubectl rollout status`.

Rollback scope is application deployment rollback only. Database migrations are forward-only in v1; use the documented backup and restore process if a data rollback is required.

Verify the local rollback wiring and manifest render path with:

```bash
make verify-rollback-procedure
make verify-k8s-autoscaling
```

The production-readiness rollback gate also requires a real staging or
production-like drill. Use `docs/runbooks/production-rollback-drill.md` to record
rollout history, rollback status, critical product checks, and follow-up actions.

Managed PostgreSQL and managed Redis are preferred instead of running stateful databases inside the cluster.

Observability manifests are rendered separately from the application baseline:

```bash
kubectl kustomize deployments/observability
make verify-observability-manifests
```

Create `GRAFANA_ADMIN_USER` and `GRAFANA_ADMIN_PASSWORD` in `gitrank-runtime-secrets` before applying the Grafana deployment.

Secret separation and rotation guidance lives in `docs/runbooks/secret-rotation.md` and is statically checked by:

```bash
make verify-secret-policy
```
