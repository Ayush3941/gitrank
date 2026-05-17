#!/usr/bin/env sh
set -eu

PROMETHEUS_BASE_URL="${PROMETHEUS_BASE_URL:-}"
GRAFANA_BASE_URL="${GRAFANA_BASE_URL:-}"
GRAFANA_API_TOKEN="${GRAFANA_API_TOKEN:-}"
EXPECTED_SERVICES="${EXPECTED_SERVICES:-api-gateway auth-service github-ingestor pr-analyzer profile-service scheduler-worker scoring-engine}"
EXPECTED_ALERT_GROUPS="${EXPECTED_ALERT_GROUPS:-gitrank-platform}"
EXPECTED_DASHBOARD_TITLES="${EXPECTED_DASHBOARD_TITLES:-GitRank Overview,GitRank SLOs,GitRank Frontend UX}"
OBS_HTTP_TIMEOUT_SECONDS="${OBS_HTTP_TIMEOUT_SECONDS:-30}"
TMP_ROOT="${TMPDIR:-/tmp}"

fail() {
  printf 'live observability verification failed: %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"
}

trim_url() {
  printf '%s' "$1" | sed 's#/*$##'
}

[ -n "$PROMETHEUS_BASE_URL" ] || fail "PROMETHEUS_BASE_URL is required"
[ -n "$GRAFANA_BASE_URL" ] || fail "GRAFANA_BASE_URL is required"
[ -n "$GRAFANA_API_TOKEN" ] || fail "GRAFANA_API_TOKEN is required"

require_command curl
require_command jq
require_command mktemp
mkdir -p "$TMP_ROOT"

PROMETHEUS_BASE_URL=$(trim_url "$PROMETHEUS_BASE_URL")
GRAFANA_BASE_URL=$(trim_url "$GRAFANA_BASE_URL")

prom_ready_file=$(mktemp "$TMP_ROOT/gitrank-prom-ready.XXXXXX")
prom_targets_file=$(mktemp "$TMP_ROOT/gitrank-prom-targets.XXXXXX")
prom_rules_file=$(mktemp "$TMP_ROOT/gitrank-prom-rules.XXXXXX")
prom_query_file=$(mktemp "$TMP_ROOT/gitrank-prom-query.XXXXXX")
grafana_search_file=$(mktemp "$TMP_ROOT/gitrank-grafana-search.XXXXXX")
trap 'rm -f "$prom_ready_file" "$prom_targets_file" "$prom_rules_file" "$prom_query_file" "$grafana_search_file"' EXIT

curl -fsS \
  --connect-timeout "$OBS_HTTP_TIMEOUT_SECONDS" \
  --max-time "$OBS_HTTP_TIMEOUT_SECONDS" \
  "$PROMETHEUS_BASE_URL/-/ready" >"$prom_ready_file"
grep -qi "ready" "$prom_ready_file" || fail "Prometheus readiness endpoint did not report ready"

curl -fsS \
  --connect-timeout "$OBS_HTTP_TIMEOUT_SECONDS" \
  --max-time "$OBS_HTTP_TIMEOUT_SECONDS" \
  "$PROMETHEUS_BASE_URL/api/v1/targets" >"$prom_targets_file"
jq -e '.status == "success"' "$prom_targets_file" >/dev/null || fail "Prometheus targets API did not return success"
target_count=$(jq -r '[.data.activeTargets[]?] | length' "$prom_targets_file")
[ "$target_count" -gt 0 ] || fail "Prometheus has zero active scrape targets"

for service in $EXPECTED_SERVICES; do
  jq -e --arg service "$service" '[.data.activeTargets[]? | tostring | contains($service)] | any' "$prom_targets_file" >/dev/null || fail "service target not found in Prometheus active targets: $service"
done

curl -fsS \
  --connect-timeout "$OBS_HTTP_TIMEOUT_SECONDS" \
  --max-time "$OBS_HTTP_TIMEOUT_SECONDS" \
  "$PROMETHEUS_BASE_URL/api/v1/rules" >"$prom_rules_file"
jq -e '.status == "success"' "$prom_rules_file" >/dev/null || fail "Prometheus rules API did not return success"

for group in $EXPECTED_ALERT_GROUPS; do
  jq -e --arg group "$group" '[.data.groups[]? | .name == $group] | any' "$prom_rules_file" >/dev/null || fail "Prometheus alert group missing: $group"
done

curl -fsS \
  --connect-timeout "$OBS_HTTP_TIMEOUT_SECONDS" \
  --max-time "$OBS_HTTP_TIMEOUT_SECONDS" \
  -G "$PROMETHEUS_BASE_URL/api/v1/query" \
  --data-urlencode 'query=count({__name__=~"gitrank_.*"})' >"$prom_query_file"
jq -e '.status == "success"' "$prom_query_file" >/dev/null || fail "Prometheus metrics query API did not return success"
gitrank_metric_series=$(jq -r '.data.result[0].value[1] // "0"' "$prom_query_file")
[ "$gitrank_metric_series" != "0" ] || fail "Prometheus query returned zero gitrank_* metric series"

curl -fsS \
  --connect-timeout "$OBS_HTTP_TIMEOUT_SECONDS" \
  --max-time "$OBS_HTTP_TIMEOUT_SECONDS" \
  -H "Authorization: Bearer $GRAFANA_API_TOKEN" \
  "$GRAFANA_BASE_URL/api/search?type=dash-db&query=GitRank" >"$grafana_search_file"
test -s "$grafana_search_file" || fail "Grafana dashboard search returned empty response"

expected_dashboards_csv=$(printf '%s' "$EXPECTED_DASHBOARD_TITLES" | tr ',' '\n')
printf '%s\n' "$expected_dashboards_csv" | while IFS= read -r title; do
  [ -n "$title" ] || continue
  jq -e --arg title "$title" '[.[]? | .title == $title] | any' "$grafana_search_file" >/dev/null || fail "Grafana dashboard not found: $title"
done

printf 'live observability verification passed\n'
printf 'prometheus active targets: %s\n' "$target_count"
printf 'gitrank metric series: %s\n' "$gitrank_metric_series"
