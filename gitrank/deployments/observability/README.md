# Observability Baseline

This directory contains the committed v1 observability baseline for GitRank.

Contents:

- `prometheus/alerts.yaml`: alert rules for queue backlog, webhook failures, auth failures, GitHub API rate-limit pressure, and scoring service failures
- `grafana/gitrank-overview-dashboard.json`: service health and throughput dashboard
- `grafana/gitrank-slo-dashboard.json`: SLO and error-budget oriented dashboard

Current scope:

- assets are committed and ready to be provisioned into Prometheus and Grafana
- assets reference only metric names that already exist in the codebase
- tracing is still not implemented
- AI cost alerting is still pending because the repo does not yet emit live token-cost metrics

Deployment note:

- these files are not yet wired into Kubernetes manifests or a live Grafana/Prometheus stack
- production rollout should mount or provision them through the eventual deployment workflow
