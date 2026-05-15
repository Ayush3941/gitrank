#!/usr/bin/env sh
set -eu

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
repo_dir="$(CDPATH= cd -- "$root_dir/.." && pwd)"
contributing_file="$repo_dir/CONTRIBUTING.md"
audit_report_file="${AUDIT_REPORT_FILE:-}"
display_repository="${GITHUB_REPOSITORY_DISPLAY:-}"
run_public_probe="${RUN_PUBLIC_PROBE:-true}"
api_token="${GITHUB_TOKEN:-${GH_TOKEN:-${GITRANK_REPO_ADMIN_TOKEN:-}}}"
github_app_id="${GITHUB_APP_ID:-${GITRANK_GITHUB_APP_ID:-}}"
github_app_installation_id="${GITHUB_APP_INSTALLATION_ID:-${GITRANK_GITHUB_APP_INSTALLATION_ID:-}}"
github_app_private_key_file="${GITHUB_APP_PRIVATE_KEY_FILE:-${GITRANK_GITHUB_APP_PRIVATE_KEY_FILE:-}}"
github_app_private_key_pem="${GITHUB_APP_PRIVATE_KEY_PEM:-${GITRANK_GITHUB_APP_PRIVATE_KEY_PEM:-}}"

fail() {
  printf 'v2 contributing audit failed: %s\n' "$1" >&2
  exit 1
}

run_make() {
  target=$1
  shift || true
  (cd "$root_dir" && TMPDIR="${TMPDIR:-$root_dir/.tmp}" make "$target" "$@")
}

resolve_repository_from_git_remote() {
  if [ -n "${GITHUB_REPOSITORY:-}" ]; then
    printf '%s' "$GITHUB_REPOSITORY"
    return 0
  fi
  if ! command -v git >/dev/null 2>&1; then
    return 0
  fi
  remote_url=$(git -C "$repo_dir" config --get remote.origin.url 2>/dev/null || true)
  [ -n "$remote_url" ] || return 0
  case "$remote_url" in
    https://github.com/*) inferred_repo=${remote_url#https://github.com/} ;;
    git@github.com:*) inferred_repo=${remote_url#git@github.com:} ;;
    *) inferred_repo= ;;
  esac
  inferred_repo=${inferred_repo%.git}
  printf '%s' "$inferred_repo"
}

resolve_display_repository() {
  resolved_repository=$1
  if [ -n "$display_repository" ]; then
    printf '%s' "$display_repository"
    return 0
  fi
  printf 'OWNER/REPO'
}

bootstrap_probe_token_from_github_app() {
  [ -n "$api_token" ] && return 0
  [ -n "$github_app_id" ] || return 0
  [ -n "$github_app_installation_id" ] || return 0
  if [ -z "$github_app_private_key_file" ] && [ -z "$github_app_private_key_pem" ]; then
    return 0
  fi

  token_file=$(mktemp "${TMPDIR:-/tmp}/gitrank-v2-audit-token.XXXXXX")
  if GITHUB_APP_ID="$github_app_id" \
    GITHUB_APP_INSTALLATION_ID="$github_app_installation_id" \
    GITHUB_APP_PRIVATE_KEY_FILE="$github_app_private_key_file" \
    GITHUB_APP_PRIVATE_KEY_PEM="$github_app_private_key_pem" \
    TOKEN_OUTPUT_FILE="$token_file" \
    "$root_dir/scripts/create_github_app_installation_token.sh" >/dev/null 2>&1; then
    api_token=$(cat "$token_file" 2>/dev/null || true)
  fi
  rm -f "$token_file"
}

emit_public_live_probe_snapshot() {
  repository=$1
  repository_display=$2
  [ -n "$repository" ] || {
    printf 'public probe: skipped (repository unavailable)\n'
    [ -n "$audit_report_file" ] && {
      printf '\n## Public Probe Snapshot\n' >>"$audit_report_file"
      printf '%s\n' '- skipped: repository unavailable' >>"$audit_report_file"
    }
    return 0
  }

  if ! command -v curl >/dev/null 2>&1 || ! command -v jq >/dev/null 2>&1; then
    printf 'public probe: skipped (curl/jq missing)\n'
    [ -n "$audit_report_file" ] && {
      printf '\n## Public Probe Snapshot\n' >>"$audit_report_file"
      printf '%s\n' '- skipped: curl/jq missing' >>"$audit_report_file"
    }
    return 0
  fi

  owner=${repository%%/*}
  repo=${repository#*/}
  api_base="${GITHUB_API_URL:-https://api.github.com}"
  api_timeout_seconds="${GITHUB_API_TIMEOUT_SECONDS:-20}"
  branch_status=
  rules_status=
  workflow_runs_status=
  controls_public_probe_status=unknown
  controls_public_probe_summary=
  workflow_badge_status=unknown
  workflow_badge_url=
  remote_workflow_sync_status=unknown
  remote_workflow_sync_summary=
  default_branch=
  protected_state=unknown
  rules_count=unknown
  workflow_runs_count=unknown
  probe_msg=

  api_get() {
    path=$1
    status_file=$(mktemp "${TMPDIR:-/tmp}/gitrank-v2-audit-probe.XXXXXX")
    if [ -n "$api_token" ]; then
      status_code=$(curl -sS -L -o "$status_file" -w '%{http_code}' \
        --connect-timeout "$api_timeout_seconds" \
        --max-time "$api_timeout_seconds" \
        -H 'Accept: application/vnd.github+json' \
        -H "Authorization: Bearer $api_token" \
        "$api_base$path") || status_code=000
    else
      status_code=$(curl -sS -L -o "$status_file" -w '%{http_code}' \
        --connect-timeout "$api_timeout_seconds" \
        --max-time "$api_timeout_seconds" \
        -H 'Accept: application/vnd.github+json' \
        "$api_base$path") || status_code=000
    fi
    body=$(cat "$status_file" 2>/dev/null || true)
    rm -f "$status_file"
    API_GET_STATUS=$status_code
    API_GET_BODY=$body
  }

  api_get "/repos/$owner/$repo"
  repo_status=$API_GET_STATUS
  repo_body=$API_GET_BODY
  if [ "$repo_status" = "200" ]; then
    default_branch=$(printf '%s' "$repo_body" | jq -r '.default_branch // empty')
  fi

  if [ -n "$default_branch" ]; then
    api_get "/repos/$owner/$repo/branches/$default_branch"
    branch_status=$API_GET_STATUS
    branch_body=$API_GET_BODY
    if [ "$branch_status" = "200" ]; then
      protected_state=$(printf '%s' "$branch_body" | jq -r '.protected // false')
      api_get "/repos/$owner/$repo/rules/branches/$default_branch"
      rules_status=$API_GET_STATUS
      rules_body=$API_GET_BODY
      if [ "$rules_status" = "200" ]; then
        rules_count=$(printf '%s' "$rules_body" | jq -r '
          if type == "array" then length
          elif type == "object" and has("rules") then (.rules | length)
          elif type == "object" and has("type") then 1
          else 0 end
        ')
      fi
    fi
  fi

  api_get "/repos/$owner/$repo/actions/workflows/verify-live-v2-gates.yml/runs?per_page=1"
  workflow_runs_status=$API_GET_STATUS
  workflow_runs_body=$API_GET_BODY
  if [ "$workflow_runs_status" = "200" ]; then
    workflow_runs_count=$(printf '%s' "$workflow_runs_body" | jq -r '.total_count // (.workflow_runs | length) // 0')
  fi

  workflow_badge_url="https://github.com/$owner/$repo/actions/workflows/verify-live-v2-gates.yml/badge.svg?event=workflow_dispatch"
  if [ -n "$default_branch" ]; then
    workflow_badge_url="$workflow_badge_url&branch=$default_branch"
  fi
  badge_file=$(mktemp "${TMPDIR:-/tmp}/gitrank-v2-audit-workflow-badge.XXXXXX")
  badge_http_status=$(curl -sS -L -o "$badge_file" -w '%{http_code}' \
    --connect-timeout "$api_timeout_seconds" \
    --max-time "$api_timeout_seconds" \
    "$workflow_badge_url" 2>/dev/null || printf '000')
  if [ "$badge_http_status" = "200" ]; then
    workflow_badge_status=$(sed -n 's:.*<title>[^<]* - \([^<]*\)</title>.*:\1:p' "$badge_file" | head -n 1 | tr '[:upper:]' '[:lower:]')
    [ -n "$workflow_badge_status" ] || workflow_badge_status=unknown
  else
    workflow_badge_status="http-$badge_http_status"
  fi
  rm -f "$badge_file"

  if [ "$workflow_runs_status" = "404" ] && [ "$workflow_runs_count" = "unknown" ]; then
    probe_msg='workflow file has no visible runs yet (or workflow file absent on remote default branch)'
  fi

  controls_probe_log=$(mktemp "${TMPDIR:-/tmp}/gitrank-v2-audit-controls-probe.XXXXXX")
  if GITHUB_REPOSITORY="$repository" \
    "$root_dir/scripts/verify_github_repository_controls_public.sh" >"$controls_probe_log" 2>&1; then
    controls_public_probe_status=pass
  else
    controls_public_probe_status=fail
  fi
  controls_public_probe_summary=$(tail -n 1 "$controls_probe_log" 2>/dev/null || true)
  rm -f "$controls_probe_log"
  if [ -z "$controls_public_probe_summary" ]; then
    controls_public_probe_summary='no output captured from public controls probe'
  fi

  remote_sync_probe_log=$(mktemp "${TMPDIR:-/tmp}/gitrank-v2-audit-remote-sync.XXXXXX")
  if GITHUB_REPOSITORY="$repository" \
    "$root_dir/scripts/verify_remote_live_v2_workflow_sync.sh" >"$remote_sync_probe_log" 2>&1; then
    remote_workflow_sync_status=pass
  else
    remote_workflow_sync_status=fail
  fi
  remote_workflow_sync_summary=$(tail -n 1 "$remote_sync_probe_log" 2>/dev/null || true)
  rm -f "$remote_sync_probe_log"
  if [ -z "$remote_workflow_sync_summary" ]; then
    remote_workflow_sync_summary='no output captured from remote workflow sync probe'
  fi

  printf 'public probe snapshot\n'
  printf 'repository: %s\n' "$repository_display"
  printf 'repo metadata http: %s\n' "${repo_status:-unknown}"
  printf 'default branch: %s\n' "${default_branch:-unknown}"
  printf 'branch metadata http: %s\n' "${branch_status:-unknown}"
  printf 'default branch protected: %s\n' "$protected_state"
  printf 'branch rules http: %s\n' "${rules_status:-unknown}"
  printf 'branch rules count: %s\n' "$rules_count"
  printf 'live-gates workflow runs http: %s\n' "$workflow_runs_status"
  printf 'live-gates workflow run count: %s\n' "$workflow_runs_count"
  printf 'live-gates workflow badge status: %s\n' "$workflow_badge_status"
  printf 'live-gates workflow badge url: %s\n' "$workflow_badge_url"
  printf 'remote workflow sync probe: %s\n' "$remote_workflow_sync_status"
  printf 'remote workflow sync summary: %s\n' "$remote_workflow_sync_summary"
  printf 'controls public probe: %s\n' "$controls_public_probe_status"
  printf 'controls public probe summary: %s\n' "$controls_public_probe_summary"
  if [ -n "$probe_msg" ]; then
    printf 'probe note: %s\n' "$probe_msg"
  fi

  if [ -n "$audit_report_file" ]; then
    {
      printf '\n## Public Probe Snapshot\n'
      printf '%s\n' "- repository: $repository_display"
      printf '%s\n' "- repo metadata http: ${repo_status:-unknown}"
      printf '%s\n' "- default branch: ${default_branch:-unknown}"
      printf '%s\n' "- branch metadata http: ${branch_status:-unknown}"
      printf '%s\n' "- default branch protected: $protected_state"
      printf '%s\n' "- branch rules http: ${rules_status:-unknown}"
      printf '%s\n' "- branch rules count: $rules_count"
      printf '%s\n' "- live-gates workflow runs http: $workflow_runs_status"
      printf '%s\n' "- live-gates workflow run count: $workflow_runs_count"
      printf '%s\n' "- live-gates workflow badge status: $workflow_badge_status"
      printf '%s\n' "- live-gates workflow badge url: $workflow_badge_url"
      printf '%s\n' "- remote workflow sync probe: $remote_workflow_sync_status"
      printf '%s\n' "- remote workflow sync summary: $remote_workflow_sync_summary"
      printf '%s\n' "- controls public probe: $controls_public_probe_status"
      printf '%s\n' "- controls public probe summary: $controls_public_probe_summary"
      if [ -n "$probe_msg" ]; then
        printf '%s\n' "- note: $probe_msg"
      fi
    } >>"$audit_report_file"
  fi
}

emit_skipped_public_probe_snapshot() {
  repository_display=$1
  reason=$2
  printf 'public probe snapshot\n'
  printf 'repository: %s\n' "$repository_display"
  printf 'probe skipped: %s\n' "$reason"

  if [ -n "$audit_report_file" ]; then
    {
      printf '\n## Public Probe Snapshot\n'
      printf '%s\n' "- repository: $repository_display"
      printf '%s\n' "- probe skipped: $reason"
    } >>"$audit_report_file"
  fi
}

emit_env_presence_snapshot() {
  repository=$1
  if [ ! -x "$root_dir/scripts/report_live_v2_env_presence.sh" ]; then
    return 0
  fi

  env_probe_file=$(mktemp "${TMPDIR:-/tmp}/gitrank-v2-env-presence.XXXXXX")
  if INFERRED_GITHUB_REPOSITORY="$repository" \
    "$root_dir/scripts/report_live_v2_env_presence.sh" >"$env_probe_file" 2>/dev/null; then
    :
  else
    rm -f "$env_probe_file"
    return 0
  fi

  auth_mode=$(awk -F= '/^derived\.auth_mode=/{print $2; exit}' "$env_probe_file")
  has_app_bootstrap=$(awk -F= '/^derived\.has_app_bootstrap=/{print $2; exit}' "$env_probe_file")
  workflow_sync_readiness=$(awk -F= '/^derived\.workflow_sync_credential_readiness=/{print $2; exit}' "$env_probe_file")

  if [ -n "$auth_mode" ] || [ -n "$has_app_bootstrap" ] || [ -n "$workflow_sync_readiness" ]; then
    printf 'env derived readiness\n'
    printf 'derived.auth_mode: %s\n' "${auth_mode:-unknown}"
    printf 'derived.has_app_bootstrap: %s\n' "${has_app_bootstrap:-unknown}"
    printf 'derived.workflow_sync_credential_readiness: %s\n' "${workflow_sync_readiness:-unknown}"
    if [ -n "$audit_report_file" ]; then
      {
        printf '\n## Env Presence Snapshot\n'
        printf '%s\n' "- derived.auth_mode: ${auth_mode:-unknown}"
        printf '%s\n' "- derived.has_app_bootstrap: ${has_app_bootstrap:-unknown}"
        printf '%s\n' "- derived.workflow_sync_credential_readiness: ${workflow_sync_readiness:-unknown}"
      } >>"$audit_report_file"
    fi
  fi
  rm -f "$env_probe_file"
}

[ -s "$contributing_file" ] || fail "missing CONTRIBUTING.md at $contributing_file"
bootstrap_probe_token_from_github_app

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
      remediation="run make verify-live-github-access (token/App preflight) and make verify-github-repository-controls-public (precheck), then apply/verify via make apply-github-repository-controls-auto + make verify-github-repository-controls (admin token or GitHub App creds), or verify successful live-gates workflow evidence via make verify-live-v2-workflow-run"
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

repository=$(resolve_repository_from_git_remote || true)
repository_display=$(resolve_display_repository "$repository")
if [ "$run_public_probe" = "true" ]; then
  emit_public_live_probe_snapshot "$repository" "$repository_display"
else
  emit_skipped_public_probe_snapshot "$repository_display" "RUN_PUBLIC_PROBE=false"
fi
emit_env_presence_snapshot "$repository"

fail "checklist still has unresolved items"
