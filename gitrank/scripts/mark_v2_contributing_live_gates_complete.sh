#!/usr/bin/env sh
set -eu

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
repo_dir="$(CDPATH= cd -- "$root_dir/.." && pwd)"
contributing_file="${CONTRIBUTING_FILE:-$repo_dir/CONTRIBUTING.md}"

MARK_OBSERVABILITY="${MARK_OBSERVABILITY:-false}"
MARK_GITHUB_CONTROLS="${MARK_GITHUB_CONTROLS:-false}"
MARK_ROLLBACK_RESTORE="${MARK_ROLLBACK_RESTORE:-false}"
MARK_K8S_RUNTIME="${MARK_K8S_RUNTIME:-false}"
VERIFY_BEFORE_MARK="${VERIFY_BEFORE_MARK:-true}"
CONFIRM_MARK_CONTRIBUTING="${CONFIRM_MARK_CONTRIBUTING:-}"

fail() {
  printf 'mark v2 contributing gates failed: %s\n' "$1" >&2
  exit 1
}

run_make() {
  target=$1
  shift || true
  (cd "$root_dir" && TMPDIR="${TMPDIR:-$root_dir/.tmp}" make "$target" "$@")
}

replace_checkbox_for_substring() {
  substring=$1
  file=$2
  tmp_file=$(mktemp "${TMPDIR:-/tmp}/gitrank-mark-v2.XXXXXX")
  if ! awk -v needle="$substring" '
    BEGIN { changed = 0 }
    {
      if (index($0, needle) > 0 && $0 ~ /- \[ \]/) {
        sub(/- \[ \]/, "- [x]")
        changed = 1
      }
      print $0
    }
    END {
      if (changed == 0) {
        exit 2
      }
    }
  ' "$file" >"$tmp_file"; then
    rm -f "$tmp_file"
    fail "could not mark checklist line containing: $substring"
  fi
  mv "$tmp_file" "$file"
}

[ -s "$contributing_file" ] || fail "missing CONTRIBUTING.md at $contributing_file"
[ "$CONFIRM_MARK_CONTRIBUTING" = "yes" ] || fail "set CONFIRM_MARK_CONTRIBUTING=yes to allow checklist mutations"

if [ "$MARK_OBSERVABILITY" = "true" ]; then
  if [ "$VERIFY_BEFORE_MARK" = "true" ]; then
    [ -n "${OBS_EVIDENCE_FILE:-}" ] || fail "OBS_EVIDENCE_FILE is required when MARK_OBSERVABILITY=true"
    run_make verify-live-observability
    run_make verify-observability-evidence EVIDENCE_FILE="$OBS_EVIDENCE_FILE"
  fi
  replace_checkbox_for_substring "Production observability exists." "$contributing_file"
  replace_checkbox_for_substring "Deploy and verify production observability against real traffic" "$contributing_file"
fi

if [ "$MARK_GITHUB_CONTROLS" = "true" ]; then
  if [ "$VERIFY_BEFORE_MARK" = "true" ]; then
    if [ "${APPLY_GITHUB_CONTROLS:-false}" = "true" ]; then
      GITRANK_APPLY_REPOSITORY_CONTROLS=yes run_make apply-github-repository-controls-auto
    fi
    run_make verify-github-repository-controls
  fi
  replace_checkbox_for_substring "enable dependency graph" "$contributing_file"
  replace_checkbox_for_substring "enable Dependabot alerts" "$contributing_file"
  replace_checkbox_for_substring "protect the default branch or apply repository rulesets" "$contributing_file"
  replace_checkbox_for_substring "require pull request review before merge" "$contributing_file"
  replace_checkbox_for_substring "require status checks before merge" "$contributing_file"
  replace_checkbox_for_substring "enforce required checks before merge" "$contributing_file"
  replace_checkbox_for_substring "prevent direct pushes to protected branches" "$contributing_file"
  replace_checkbox_for_substring "default branch protections or rulesets are enforced" "$contributing_file"
  replace_checkbox_for_substring "Apply and verify live GitHub repository controls before V2 release branches are cut." "$contributing_file"
fi

if [ "$MARK_ROLLBACK_RESTORE" = "true" ]; then
  if [ "$VERIFY_BEFORE_MARK" = "true" ]; then
    [ -n "${ROLLBACK_EVIDENCE_FILE:-}" ] || fail "ROLLBACK_EVIDENCE_FILE is required when MARK_ROLLBACK_RESTORE=true"
    [ -n "${RESTORE_EVIDENCE_FILE:-}" ] || fail "RESTORE_EVIDENCE_FILE is required when MARK_ROLLBACK_RESTORE=true"
    run_make verify-rollback-drill-evidence EVIDENCE_FILE="$ROLLBACK_EVIDENCE_FILE"
    run_make verify-database-restore-drill-evidence EVIDENCE_FILE="$RESTORE_EVIDENCE_FILE"
  fi
  replace_checkbox_for_substring "rollback procedures are documented and tested" "$contributing_file"
  replace_checkbox_for_substring "Run and record staging rollback and restore drills." "$contributing_file"
fi

if [ "$MARK_K8S_RUNTIME" = "true" ]; then
  if [ "$VERIFY_BEFORE_MARK" = "true" ]; then
    [ -n "${STAGING_RENDER_OUTPUT:-}" ] || fail "STAGING_RENDER_OUTPUT is required when MARK_K8S_RUNTIME=true"
    [ -n "${PRODUCTION_RENDER_OUTPUT:-}" ] || fail "PRODUCTION_RENDER_OUTPUT is required when MARK_K8S_RUNTIME=true"
    K8S_ENVIRONMENT=staging OUTPUT_FILE="$STAGING_RENDER_OUTPUT" run_make render-k8s-release-manifests
    K8S_ENVIRONMENT=production OUTPUT_FILE="$PRODUCTION_RENDER_OUTPUT" run_make render-k8s-release-manifests
  fi
  replace_checkbox_for_substring "Replace provider-neutral Kubernetes placeholders with environment-specific secrets, TLS, ingress, managed PostgreSQL, managed Redis, registry, and environment-tuned autoscaling thresholds." "$contributing_file"
fi

printf 'v2 contributing live-gate checklist update complete\n'
printf 'file: %s\n' "$contributing_file"
