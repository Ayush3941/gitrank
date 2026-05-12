# Production Observability Runbook

This runbook defines how GitRank turns the committed observability manifests
into a production-readiness proof. `make verify-observability-manifests` proves
that manifests render and reference committed dashboards and alert rules. The
production observability checkbox remains unchecked until these assets are
applied to a live environment and verified against real service traffic.

Official references:

- Prometheus configuration: https://prometheus.io/docs/prometheus/latest/configuration/configuration/
- Prometheus alerting rules: https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/
- Grafana provisioning: https://grafana.com/docs/grafana/latest/administration/provisioning/

## Scope

The v1 observability baseline covers:

- service health and request metrics
- auth failures
- webhook failures
- queue backlog and dead-letter growth
- GitHub API rate-limit pressure
- scoring and replay failures
- AI estimated token and cost counters
- profile freshness and stale/partial profile states

The committed manifests provision Prometheus, Grafana, Grafana datasources,
Grafana dashboards, alert rules, and namespace-scoped Prometheus discovery RBAC.

## Preconditions

- Kubernetes cluster access exists for the target environment.
- Application services are deployed and exposing `/metrics`.
- `gitrank-runtime-secrets` contains `GRAFANA_ADMIN_USER` and
  `GRAFANA_ADMIN_PASSWORD`.
- Ingress, port-forwarding, or another approved access path exists for Grafana
  and Prometheus.
- An alert routing destination exists if production paging or notifications are
  required.
- A read-only Grafana API token exists for dashboard search validation.

## Deploy

1. Render and statically verify the manifests:

   ```bash
   cd gitrank
   make verify-observability-manifests
   kubectl kustomize deployments/observability
   ```

2. Apply the observability baseline:

   ```bash
   kubectl apply -k deployments/observability
   ```

3. Verify rollout state:

   ```bash
   kubectl -n gitrank-observability rollout status deployment/prometheus --timeout=180s
   kubectl -n gitrank-observability rollout status deployment/grafana --timeout=180s
   ```

4. Confirm the Prometheus and Grafana Services exist:

   ```bash
   kubectl -n gitrank-observability get service prometheus grafana
   ```

## Validate

Run these checks before marking production observability complete:

- Prometheus target discovery shows every deployed GitRank service as `up`.
- Prometheus rule API includes the GitRank alert groups.
- Grafana datasource provisioning points at the live Prometheus service.
- Grafana shows the GitRank overview dashboard.
- Grafana shows the GitRank SLO dashboard.
- At least one request path has produced API metrics.
- At least one worker or sync path has produced queue/sync metrics, or the
  environment explicitly records that workers are intentionally idle.
- Alert evaluation is enabled and a test alert route is confirmed.
- Dashboards show timestamps from the live environment, not only local test
  fixture data.

Automated verification command:

```bash
PROMETHEUS_BASE_URL=https://prometheus.your-env.example \
GRAFANA_BASE_URL=https://grafana.your-env.example \
GRAFANA_API_TOKEN=... \
make verify-live-observability
```

Equivalent GitHub Actions path:

- run `.github/workflows/verify-live-v2-gates.yml` with `run_observability=true`

Useful local access commands:

```bash
kubectl -n gitrank-observability port-forward service/prometheus 9090:9090
kubectl -n gitrank-observability port-forward service/grafana 3000:3000
```

Useful Prometheus API checks:

```bash
curl -fsS http://localhost:9090/-/ready
curl -fsS http://localhost:9090/api/v1/targets
curl -fsS http://localhost:9090/api/v1/rules
```

## Evidence Record

Start from:

```bash
cp docs/evidence/observability-live-template.txt docs/evidence/observability-live-YYYY-MM-DD.txt
```

Validate before marking the gate complete:

```bash
make verify-observability-evidence EVIDENCE_FILE=docs/evidence/observability-live-YYYY-MM-DD.txt
```

Attach the completed evidence to the release issue or maintainer operations
notes. Only then may `Production observability exists` be checked in
`CONTRIBUTING.md`.
