# Kubernetes Baseline

GitRank uses Kubernetes as the v1 deployment baseline.

Current committed assets in this directory include:

- `base/namespace.yaml`
- `base/kustomization.yaml`
- `base/configmap.yaml`
- `base/serviceaccount.yaml`
- `base/deployments.yaml`
- `base/services.yaml`
- `base/ingress.yaml`
- `base/migration-job.yaml`
- `overlays/staging/`
- `overlays/production/`
- `examples/runtime-secret.example.yaml`
- `examples/external-secret.example.yaml`

The base deploys the seven Go services, ClusterIP Services, an ingress for `api-gateway` and `auth-service`, and a migration Job. Staging and production overlays set namespaces, public URLs, ingress hosts, and image replacement points.

Before applying the manifests, create or sync a `gitrank-runtime-secrets` Secret in the target namespace. The example manifests show both a direct Kubernetes Secret shape and an External Secrets Operator shape, but neither example is included in the base kustomization.

Render locally:

```bash
kubectl kustomize deployments/k8s/overlays/staging
kubectl kustomize deployments/k8s/overlays/production
```

Deployments can also be rendered or applied through the manual `Deploy Kubernetes` GitHub Actions workflow. Its default mode only renders manifests; cluster apply requires `KUBE_CONFIG_B64` and the `apply` input.

Managed PostgreSQL and managed Redis are preferred instead of running stateful databases inside the cluster.
