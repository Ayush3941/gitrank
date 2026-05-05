# Kubernetes Baseline

GitRank uses Kubernetes as the v1 deployment baseline.

Current committed assets in this directory are intentionally minimal:

- `base/namespace.yaml`
- `base/kustomization.yaml`

They establish the namespace and filesystem layout for the chosen baseline.

Still pending in follow-up work:

- per-service `Deployment` manifests
- `Service` objects
- ingress or gateway configuration
- secret-manager integration
- staging and production overlays
- migration job wiring

Managed PostgreSQL and managed Redis are preferred instead of running stateful databases inside the cluster.
