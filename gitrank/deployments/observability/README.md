# Observability Baseline

This directory contains the committed v1 observability baseline for GitRank.

Contents:

- `prometheus/alerts.yaml`: alert rules for queue backlog, webhook failures, auth failures, GitHub API rate-limit pressure, scoring service failures, scoring replay failures, and elevated AI analysis cost estimates
- `grafana/gitrank-overview-dashboard.json`: service health and throughput dashboard
- `grafana/gitrank-slo-dashboard.json`: SLO and error-budget oriented dashboard
- `kustomization.yaml` and `k8s/`: optional in-cluster Prometheus and Grafana manifests that mount these rules and dashboards

Current scope:

- assets are committed and ready to be provisioned into Prometheus and Grafana
- assets reference only metric names that already exist in the codebase
- PR analysis emits estimated token counters and estimated provider cost counters; deterministic analysis records zero provider cost until live AI enrichment is enabled
- W3C `traceparent` propagation is implemented across service HTTP boundaries, async sync execution, GitHub API calls, OAuth token calls, and AI request builders
- Kubernetes manifests render Prometheus, Grafana, dashboard provisioning, datasource provisioning, alert rules, and namespace-scoped Prometheus discovery RBAC

Render locally:

```bash
kubectl kustomize deployments/observability
make verify-observability-manifests
```

Deployment note:

- these files are not yet applied to a live Grafana/Prometheus stack
- create `GRAFANA_ADMIN_USER` and `GRAFANA_ADMIN_PASSWORD` in `gitrank-runtime-secrets` before applying the Grafana deployment
- trace context propagation is present, but an OTLP collector/exporter deployment is still required before production traces exist in a backend
