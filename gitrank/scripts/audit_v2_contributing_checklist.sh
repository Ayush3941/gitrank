#!/usr/bin/env sh
set -eu

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
repo_dir="$(CDPATH= cd -- "$root_dir/.." && pwd)"
contributing_file="$repo_dir/CONTRIBUTING.md"
audit_report_file="${AUDIT_REPORT_FILE:-}"

fail() {
  printf 'v2 contributing audit failed: %s\n' "$1" >&2
  exit 1
}

run_make() {
  target=$1
  shift || true
  (cd "$root_dir" && TMPDIR="${TMPDIR:-$root_dir/.tmp}" make "$target" "$@")
}

[ -s "$contributing_file" ] || fail "missing CONTRIBUTING.md at $contributing_file"

if [ "${RUN_BASELINE_VERIFIERS:-true}" = "true" ]; then
  run_make verify-v2-live-readiness
fi

report_dir=
if [ -n "$audit_report_file" ]; then
  report_dir=$(dirname "$audit_report_file")
  mkdir -p "$report_dir"
fi

unchecked_file="$(mktemp "${TMPDIR:-/tmp}/gitrank-v2-unchecked.XXXXXX")"
trap 'rm -f "$unchecked_file"' EXIT
rg -n "\\[ \\]" "$contributing_file" >"$unchecked_file" || true

unchecked_count=$(wc -l <"$unchecked_file" | tr -d ' ')
if [ "$unchecked_count" -eq 0 ]; then
  if [ -n "$audit_report_file" ]; then
    {
      printf '# V2 Contributing Audit Report\n'
      printf '\n'
      printf 'Status: pass\n'
      printf 'Unchecked items: 0\n'
      printf 'Contributing file: %s\n' "$contributing_file"
    } >"$audit_report_file"
  fi
  printf 'v2 contributing audit passed: no unchecked checklist items remain\n'
  exit 0
fi

if [ -n "$audit_report_file" ]; then
  {
    printf '# V2 Contributing Audit Report\n'
    printf '\n'
    printf 'Status: fail\n'
    printf 'Unchecked items: %s\n' "$unchecked_count"
    printf 'Contributing file: %s\n' "$contributing_file"
    printf '\n'
    printf '## Unresolved Items\n'
  } >"$audit_report_file"
fi

printf 'v2 contributing audit summary\n'
printf 'unchecked items: %s\n' "$unchecked_count"

while IFS= read -r line; do
  [ -n "$line" ] || continue
  line_number=${line%%:*}
  text=${line#*:}
  remediation=
  case "$text" in
    *"Production observability exists."*)
      remediation="run make verify-live-observability and provide live observability evidence file"
      ;;
    *"enable dependency graph"*|*"enable Dependabot alerts"*|*"protect the default branch"*|*"require pull request review"*|*"require status checks"*|*"enforce required checks"*|*"prevent direct pushes"*|*"default branch protections or rulesets are enforced"*|*"Apply and verify live GitHub repository controls"*)
      remediation="run make verify-github-repository-controls-public for no-token precheck, then apply/verify via make apply-github-repository-controls-auto + make verify-github-repository-controls (admin token), or verify successful live-gates workflow evidence via make verify-live-v2-workflow-run"
      ;;
    *"rollback procedures are documented and tested"*|*"Run and record staging rollback and restore drills"*)
      remediation="execute live rollback+restore drills and validate evidence files with make verify-rollback-drill-evidence + make verify-database-restore-drill-evidence"
      ;;
    *"Deploy and verify production observability against real traffic"*)
      remediation="run make verify-live-observability with live endpoints, or verify live-gates workflow evidence and generate a record with make generate-observability-evidence-from-workflow-run"
      ;;
    *"Replace provider-neutral Kubernetes placeholders"*)
      remediation="provide K8S_* runtime values and run make render-k8s-release-manifests for staging+production"
      ;;
    *)
      remediation="inspect checklist line and map to an explicit verifier/evidence record"
      ;;
  esac
  printf '%s | %s | %s\n' "$line_number" "$text" "$remediation"
  if [ -n "$audit_report_file" ]; then
    {
      printf '%s\n' "- line $line_number: $text"
      printf '%s\n' "  remediation: $remediation"
    } >>"$audit_report_file"
  fi
done <"$unchecked_file"

fail "checklist still has unresolved items"
