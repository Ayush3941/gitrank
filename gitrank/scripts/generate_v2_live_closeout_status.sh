#!/usr/bin/env sh
set -eu

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
repo_dir="$(CDPATH= cd -- "$root_dir/.." && pwd)"
tmp_root="${TMPDIR:-$root_dir/.tmp}"
mkdir -p "$tmp_root"

LIVE_ENV_FILE="${LIVE_V2_ENV_FILE:-${FINALIZE_V2_ENV_FILE:-}}"
if [ -n "$LIVE_ENV_FILE" ]; then
  resolved_live_env_file="$LIVE_ENV_FILE"
  case "$resolved_live_env_file" in
    /*) ;;
    *)
      if [ -f "$root_dir/$resolved_live_env_file" ]; then
        resolved_live_env_file="$root_dir/$resolved_live_env_file"
      fi
      ;;
  esac
  if [ ! -f "$resolved_live_env_file" ]; then
    printf 'generate v2 live closeout status failed: env file not found: %s\n' "$LIVE_ENV_FILE" >&2
    exit 1
  fi
  set -a
  # shellcheck disable=SC1090
  . "$resolved_live_env_file"
  set +a

  for token_var in GITRANK_REPO_ADMIN_TOKEN GITHUB_TOKEN GH_TOKEN GRAFANA_API_TOKEN; do
    eval token_value="\${$token_var:-}"
    case "$token_value" in
      replace-me*|changeme*|example-token*) eval "$token_var=''" ;;
    esac
  done
fi

OUTPUT_FILE="${OUTPUT_FILE:-$root_dir/docs/releases/v2-live-closeout-status-latest.md}"
CHECK_PUBLIC_GITHUB_CONTROLS="${CHECK_PUBLIC_GITHUB_CONTROLS:-true}"
CHECK_PUBLIC_WORKFLOW_HEALTH="${CHECK_PUBLIC_WORKFLOW_HEALTH:-auto}"
CHECK_REMOTE_LIVE_WORKFLOW_SYNC="${CHECK_REMOTE_LIVE_WORKFLOW_SYNC:-true}"
CHECK_WORKFLOW_EVIDENCE="${CHECK_WORKFLOW_EVIDENCE:-true}"
CHECK_LIVE_GITHUB_ACCESS="${CHECK_LIVE_GITHUB_ACCESS:-true}"
CHECK_LOCAL_READINESS="${CHECK_LOCAL_READINESS:-true}"
CHECK_ABRA_CHECKLIST="${CHECK_ABRA_CHECKLIST:-true}"
CHECKLIST_AUDIT_RUN_PUBLIC_PROBE="${CHECKLIST_AUDIT_RUN_PUBLIC_PROBE:-auto}"
WORKFLOW_RUN_ID="${WORKFLOW_RUN_ID:-latest}"
WORKFLOW_EVENT="${WORKFLOW_EVENT:-workflow_dispatch}"
DISPLAY_REPOSITORY="${GITHUB_REPOSITORY_DISPLAY:-}"

fail() {
  printf 'generate v2 live closeout status failed: %s\n' "$1" >&2
  exit 1
}

is_placeholder_value() {
  value=$1
  case "$value" in
    ""|OWNER/REPO|replace-me*|changeme*|*your-env.example*|*YYYY-MM-DD*|*your-cluster*|*your-name*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

state_for_value() {
  value=$1
  if [ -z "$value" ]; then
    printf 'unset'
    return 0
  fi
  if is_placeholder_value "$value"; then
    printf 'placeholder'
    return 0
  fi
  printf 'set'
}

resolve_checklist_audit_run_public_probe() {
  resolve_boolean_or_auto_from_github_auth "$CHECKLIST_AUDIT_RUN_PUBLIC_PROBE" "CHECKLIST_AUDIT_RUN_PUBLIC_PROBE"
}

resolve_check_public_workflow_health() {
  resolve_boolean_or_auto_from_github_auth "$CHECK_PUBLIC_WORKFLOW_HEALTH" "CHECK_PUBLIC_WORKFLOW_HEALTH"
}

is_public_repository_accessible() {
  repository=$1
  [ -n "$repository" ] || return 1
  case "$repository" in
    */*) ;;
    *) return 1 ;;
  esac

  if command -v git >/dev/null 2>&1; then
    if GIT_TERMINAL_PROMPT=0 git ls-remote --exit-code "https://github.com/$repository.git" HEAD >/dev/null 2>&1; then
      return 0
    fi
  fi

  command -v curl >/dev/null 2>&1 || return 1
  command -v jq >/dev/null 2>&1 || return 1

  owner=${repository%%/*}
  repo=${repository#*/}
  api_base="${GITHUB_API_URL:-https://api.github.com}"
  api_timeout_seconds="${GITHUB_API_TIMEOUT_SECONDS:-20}"
  probe_file="$tmp_root/v2-closeout-status-public-repo-probe.$$"
  status_code=$(curl -sS -L -o "$probe_file" -w '%{http_code}' \
    --connect-timeout "$api_timeout_seconds" \
    --max-time "$api_timeout_seconds" \
    -H 'Accept: application/vnd.github+json' \
    "$api_base/repos/$owner/$repo" 2>/dev/null || printf '000')
  if [ "$status_code" != "200" ]; then
    rm -f "$probe_file"
    return 1
  fi
  is_private=$(jq -r '.private // true' "$probe_file" 2>/dev/null || printf 'true')
  rm -f "$probe_file"
  [ "$is_private" = "false" ]
}

resolve_boolean_or_auto_from_github_auth() {
  configured_value=$1
  configured_name=$2
  case "$configured_value" in
    true|false)
      printf '%s' "$configured_value"
      return 0
      ;;
    auto)
      token_candidate="${GITHUB_TOKEN:-${GH_TOKEN:-${GITRANK_REPO_ADMIN_TOKEN:-}}}"
      app_id_candidate="${GITHUB_APP_ID:-${GITRANK_GITHUB_APP_ID:-}}"
      app_installation_candidate="${GITHUB_APP_INSTALLATION_ID:-${GITRANK_GITHUB_APP_INSTALLATION_ID:-}}"
      app_key_file_candidate="${GITHUB_APP_PRIVATE_KEY_FILE:-${GITRANK_GITHUB_APP_PRIVATE_KEY_FILE:-}}"
      app_key_pem_candidate="${GITHUB_APP_PRIVATE_KEY_PEM:-${GITRANK_GITHUB_APP_PRIVATE_KEY_PEM:-}}"
      has_app_bootstrap=false
      if [ -n "$app_id_candidate" ] && [ -n "$app_installation_candidate" ]; then
        if [ -n "$app_key_file_candidate" ] || [ -n "$app_key_pem_candidate" ]; then
          has_app_bootstrap=true
        fi
      fi
      if [ -n "$token_candidate" ] || [ "$has_app_bootstrap" = "true" ]; then
        printf 'true'
      elif is_public_repository_accessible "${gitrank_repo:-}"; then
        printf 'true'
      else
        printf 'false'
      fi
      return 0
      ;;
    *)
      fail "$configured_name must be one of: true, false, auto"
      ;;
  esac
}

resolve_repository_from_git_remote() {
  if [ -n "${GITHUB_REPOSITORY:-}" ]; then
    printf '%s' "$GITHUB_REPOSITORY"
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

append_section() {
  title=$1
  exit_code=$2
  output_file=$3
  rendered_file=$output_file
  sanitized_file=
  if [ -n "${gitrank_repo:-}" ] && [ "$gitrank_repo" != "$DISPLAY_REPOSITORY" ]; then
    sanitized_file="$tmp_root/v2-closeout-status-sanitized.$$.$title.txt"
    sed \
      -e "s|https://github.com/$gitrank_repo|https://github.com/$DISPLAY_REPOSITORY|g" \
      -e "s|$gitrank_repo|$DISPLAY_REPOSITORY|g" \
      "$output_file" >"$sanitized_file"
    rendered_file=$sanitized_file
  fi
  {
    printf '## %s\n\n' "$title"
    printf '%s\n\n' "- Exit code: \`$exit_code\`"
    printf '```text\n'
    sed -n '1,220p' "$rendered_file"
    printf '```\n\n'
  } >>"$OUTPUT_FILE"
  if [ -n "$sanitized_file" ]; then
    rm -f "$sanitized_file"
  fi
}

run_and_capture() {
  title=$1
  shift
  out_file="$tmp_root/v2-closeout-status.$$.txt"
  if "$@" >"$out_file" 2>&1; then
    code=0
  else
    code=$?
  fi
  RUN_CAPTURE_LAST_CODE=$code
  append_section "$title" "$code" "$out_file"
  rm -f "$out_file"
}

gitrank_repo=$(resolve_repository_from_git_remote || true)
if [ -z "$DISPLAY_REPOSITORY" ]; then
  DISPLAY_REPOSITORY=OWNER/REPO
fi
CHECKLIST_AUDIT_RUN_PUBLIC_PROBE_RESOLVED=$(resolve_checklist_audit_run_public_probe)
CHECK_PUBLIC_WORKFLOW_HEALTH_RESOLVED=$(resolve_check_public_workflow_health)
INFERRED_GITHUB_REPOSITORY=$gitrank_repo
export INFERRED_GITHUB_REPOSITORY

mkdir -p "$(dirname "$OUTPUT_FILE")"

{
  printf '# V2 + ABRA Live Closeout Status\n\n'
  printf '%s\n' "- Generated at (UTC): \`$(date -u +%Y-%m-%dT%H:%M:%SZ)\`"
  printf '%s\n' "- Repository: \`$DISPLAY_REPOSITORY\`"
  printf '%s\n' "- Workdir: \`$root_dir\`"
  printf '\n'
} >"$OUTPUT_FILE"

run_and_capture "Branch Divergence" \
  sh -c "cd '$repo_dir' && git status --short --branch && printf '\nleft-right count (origin/main...HEAD): ' && git rev-list --left-right --count origin/main...HEAD && printf '\nrecent divergent commits:\n' && git log --oneline --left-right --decorate --max-count=30 origin/main...HEAD"
branch_divergence_code=$RUN_CAPTURE_LAST_CODE

local_readiness_code=skip
if [ "$CHECK_LOCAL_READINESS" = "true" ]; then
  run_and_capture "Local Readiness Gate" \
    sh -c "cd '$root_dir' && make verify-v2-live-readiness"
  local_readiness_code=$RUN_CAPTURE_LAST_CODE
fi

abra_checklist_code=skip
if [ "$CHECK_ABRA_CHECKLIST" = "true" ]; then
  run_and_capture "ABRA Checklist Gate" \
    sh -c "cd '$root_dir' && make verify-abra-checklist"
  abra_checklist_code=$RUN_CAPTURE_LAST_CODE
fi

audit_report_tmp="${AUDIT_REPORT_FILE:-$tmp_root/v2-closeout-status-audit.$$.md}"
run_and_capture "Contributing Checklist Audit" \
  sh -c "cd '$root_dir' && RUN_BASELINE_VERIFIERS=false RUN_PUBLIC_PROBE='$CHECKLIST_AUDIT_RUN_PUBLIC_PROBE_RESOLVED' AUDIT_REPORT_FILE='$audit_report_tmp' make audit-v2-contributing-checklist"
audit_code=$RUN_CAPTURE_LAST_CODE

if [ -s "$audit_report_tmp" ]; then
  audit_report_rendered="$audit_report_tmp"
  audit_report_sanitized=
  if [ -n "${gitrank_repo:-}" ] && [ "$gitrank_repo" != "$DISPLAY_REPOSITORY" ]; then
    audit_report_sanitized="$tmp_root/v2-closeout-status-audit-sanitized.$$.md"
    sed \
      -e "s|https://github.com/$gitrank_repo|https://github.com/$DISPLAY_REPOSITORY|g" \
      -e "s|$gitrank_repo|$DISPLAY_REPOSITORY|g" \
      "$audit_report_tmp" >"$audit_report_sanitized"
    audit_report_rendered="$audit_report_sanitized"
  fi
  {
    printf '## Checklist Audit Artifact\n\n'
    printf '%s\n\n' "- File: \`$audit_report_tmp\`"
    printf '```markdown\n'
    sed -n '1,260p' "$audit_report_rendered"
    printf '```\n\n'
  } >>"$OUTPUT_FILE"
  if [ -n "$audit_report_sanitized" ]; then
    rm -f "$audit_report_sanitized"
  fi
fi

run_and_capture "Essential Live Env Presence" \
  sh -c "cd '$root_dir' && INFERRED_GITHUB_REPOSITORY='${gitrank_repo:-}' ./scripts/report_live_v2_env_presence.sh"
env_presence_code=$RUN_CAPTURE_LAST_CODE

public_workflow_health_code=skip
if [ "$CHECK_PUBLIC_WORKFLOW_HEALTH_RESOLVED" = "true" ]; then
  run_and_capture "Public Workflow Health Gate" \
    sh -c "cd '$root_dir' && GITHUB_REPOSITORY='${gitrank_repo:-}' make verify-public-workflow-health"
  public_workflow_health_code=$RUN_CAPTURE_LAST_CODE
fi

remote_live_workflow_sync_code=skip
if [ "$CHECK_REMOTE_LIVE_WORKFLOW_SYNC" = "true" ]; then
  run_and_capture "Remote Live V2 Workflow Sync" \
    sh -c "cd '$root_dir' && GITHUB_REPOSITORY='${gitrank_repo:-}' make verify-remote-live-v2-workflow-sync"
  remote_live_workflow_sync_code=$RUN_CAPTURE_LAST_CODE
fi

live_github_access_code=skip
if [ "$CHECK_LIVE_GITHUB_ACCESS" = "true" ]; then
  run_and_capture "Live GitHub Access Preflight" \
    sh -c "cd '$root_dir' && GITHUB_REPOSITORY='${gitrank_repo:-}' make verify-live-github-access"
  live_github_access_code=$RUN_CAPTURE_LAST_CODE
fi

github_app_permission_snapshot_code=skip
if [ "$CHECK_LIVE_GITHUB_ACCESS" = "true" ]; then
  token_probe="${GITHUB_TOKEN:-${GH_TOKEN:-${GITRANK_REPO_ADMIN_TOKEN:-}}}"
  app_id_probe="${GITHUB_APP_ID:-${GITRANK_GITHUB_APP_ID:-}}"
  app_installation_probe="${GITHUB_APP_INSTALLATION_ID:-${GITRANK_GITHUB_APP_INSTALLATION_ID:-}}"
  app_key_file_probe="${GITHUB_APP_PRIVATE_KEY_FILE:-${GITRANK_GITHUB_APP_PRIVATE_KEY_FILE:-}}"
  app_key_pem_probe="${GITHUB_APP_PRIVATE_KEY_PEM:-${GITRANK_GITHUB_APP_PRIVATE_KEY_PEM:-}}"
  has_app_probe_creds=false
  if [ -n "$app_id_probe" ] && [ -n "$app_installation_probe" ]; then
    if [ -n "$app_key_file_probe" ] || [ -n "$app_key_pem_probe" ]; then
      has_app_probe_creds=true
    fi
  fi
  if [ -n "$token_probe" ] || [ "$has_app_probe_creds" = "true" ]; then
    run_and_capture "GitHub App Installation Permission Snapshot" \
      sh -c "cd '$root_dir' && GITHUB_REPOSITORY='${gitrank_repo:-}' make inspect-github-app-installation-permissions"
    github_app_permission_snapshot_code=$RUN_CAPTURE_LAST_CODE
  fi
fi

public_controls_code=skip
if [ "$CHECK_PUBLIC_GITHUB_CONTROLS" = "true" ]; then
  run_and_capture "Public GitHub Controls Precheck" \
    sh -c "cd '$root_dir' && GITHUB_REPOSITORY='${gitrank_repo:-}' make verify-github-repository-controls-public"
  public_controls_code=$RUN_CAPTURE_LAST_CODE
fi

workflow_probe_code=skip
if [ "$CHECK_WORKFLOW_EVIDENCE" = "true" ]; then
  run_and_capture "Latest Workflow Evidence Probe" \
    sh -c "cd '$root_dir' && GITHUB_REPOSITORY='${gitrank_repo:-}' WORKFLOW_RUN_ID='$WORKFLOW_RUN_ID' WORKFLOW_EVENT='$WORKFLOW_EVENT' REQUIRE_GITHUB_CONTROLS=true REQUIRE_OBSERVABILITY=true REQUIRE_RELEASE_RENDER=true make verify-live-v2-workflow-run"
  workflow_probe_code=$RUN_CAPTURE_LAST_CODE
fi

missing_vars=
add_missing_var() {
  name=$1
  if [ -n "$missing_vars" ]; then
    missing_vars="${missing_vars}, $name"
  else
    missing_vars="$name"
  fi
}

for v in GITHUB_REPOSITORY PROMETHEUS_BASE_URL GRAFANA_BASE_URL GRAFANA_API_TOKEN OBS_EVIDENCE_FILE ROLLBACK_EVIDENCE_FILE RESTORE_EVIDENCE_FILE IMAGE_TAG IMAGE_REGISTRY_OWNER; do
  if [ "$v" = "GITHUB_REPOSITORY" ] && [ -n "${gitrank_repo:-}" ]; then
    continue
  fi
  eval val="\${$v-}"
  if is_placeholder_value "$val"; then
    add_missing_var "$v"
  fi
done

require_env_specific="${REQUIRE_ENV_SPECIFIC_K8S_OVERRIDES:-true}"
if [ "$require_env_specific" = "true" ]; then
  for v in STAGING_K8S_PUBLIC_BASE_URL PRODUCTION_K8S_PUBLIC_BASE_URL STAGING_K8S_API_BASE_URL PRODUCTION_K8S_API_BASE_URL STAGING_K8S_AUTH_COOKIE_DOMAIN PRODUCTION_K8S_AUTH_COOKIE_DOMAIN STAGING_K8S_GITHUB_OAUTH_REDIRECT_URL PRODUCTION_K8S_GITHUB_OAUTH_REDIRECT_URL STAGING_K8S_API_HOST PRODUCTION_K8S_API_HOST STAGING_K8S_AUTH_HOST PRODUCTION_K8S_AUTH_HOST STAGING_K8S_TLS_SECRET_NAME PRODUCTION_K8S_TLS_SECRET_NAME; do
    eval val="\${$v-}"
    if is_placeholder_value "$val"; then
      add_missing_var "$v"
    fi
  done
fi

token_candidate="${GITRANK_REPO_ADMIN_TOKEN:-${GITHUB_TOKEN:-${GH_TOKEN:-}}}"
app_id_candidate="${GITHUB_APP_ID:-${GITRANK_GITHUB_APP_ID:-}}"
app_installation_candidate="${GITHUB_APP_INSTALLATION_ID:-${GITRANK_GITHUB_APP_INSTALLATION_ID:-}}"
app_key_file_candidate="${GITHUB_APP_PRIVATE_KEY_FILE:-${GITRANK_GITHUB_APP_PRIVATE_KEY_FILE:-}}"
app_key_pem_candidate="${GITHUB_APP_PRIVATE_KEY_PEM:-${GITRANK_GITHUB_APP_PRIVATE_KEY_PEM:-}}"
if is_placeholder_value "$token_candidate"; then
  token_candidate=
fi
if is_placeholder_value "$app_id_candidate"; then
  app_id_candidate=
fi
if is_placeholder_value "$app_installation_candidate"; then
  app_installation_candidate=
fi
if is_placeholder_value "$app_key_file_candidate"; then
  app_key_file_candidate=
fi
if is_placeholder_value "$app_key_pem_candidate"; then
  app_key_pem_candidate=
fi
has_app_bootstrap=false
if [ -n "$app_id_candidate" ] && [ -n "$app_installation_candidate" ]; then
  if [ -n "$app_key_file_candidate" ] || [ -n "$app_key_pem_candidate" ]; then
    has_app_bootstrap=true
  fi
fi
if [ -z "$token_candidate" ] && [ "$has_app_bootstrap" != "true" ]; then
  add_missing_var "GITRANK_REPO_ADMIN_TOKEN_OR_GITHUB_TOKEN_OR_GH_TOKEN_OR_GITHUB_APP_CREDENTIALS"
fi

display_repo_state="$(state_for_value "${gitrank_repo:-${GITHUB_REPOSITORY:-}}")"
token_state="$(state_for_value "${GITRANK_REPO_ADMIN_TOKEN:-${GITHUB_TOKEN:-${GH_TOKEN:-}}}")"
app_id_state="$(state_for_value "${GITHUB_APP_ID:-${GITRANK_GITHUB_APP_ID:-}}")"
app_installation_state="$(state_for_value "${GITHUB_APP_INSTALLATION_ID:-${GITRANK_GITHUB_APP_INSTALLATION_ID:-}}")"
app_key_file_state="$(state_for_value "${GITHUB_APP_PRIVATE_KEY_FILE:-${GITRANK_GITHUB_APP_PRIVATE_KEY_FILE:-}}")"
app_key_pem_state="$(state_for_value "${GITHUB_APP_PRIVATE_KEY_PEM:-${GITRANK_GITHUB_APP_PRIVATE_KEY_PEM:-}}")"
prometheus_state="$(state_for_value "${PROMETHEUS_BASE_URL:-}")"
grafana_base_state="$(state_for_value "${GRAFANA_BASE_URL:-}")"
grafana_token_state="$(state_for_value "${GRAFANA_API_TOKEN:-}")"
obs_evidence_state="$(state_for_value "${OBS_EVIDENCE_FILE:-}")"
rollback_evidence_state="$(state_for_value "${ROLLBACK_EVIDENCE_FILE:-}")"
restore_evidence_state="$(state_for_value "${RESTORE_EVIDENCE_FILE:-}")"
image_tag_state="$(state_for_value "${IMAGE_TAG:-}")"
image_owner_state="$(state_for_value "${IMAGE_REGISTRY_OWNER:-}")"
staging_public_state="$(state_for_value "${STAGING_K8S_PUBLIC_BASE_URL:-}")"
production_public_state="$(state_for_value "${PRODUCTION_K8S_PUBLIC_BASE_URL:-}")"

{
  printf '## Live Input Matrix\n\n'
  printf '| Input Group | State | Used By |\n'
  printf '| --- | --- | --- |\n'
  printf '| `GITHUB_REPOSITORY` | `%s` | GitHub controls, workflow sync/evidence probes |\n' "$display_repo_state"
  printf '| `GITRANK_REPO_ADMIN_TOKEN` / `GITHUB_TOKEN` / `GH_TOKEN` | `%s` | GitHub controls apply/verify, workflow dispatch/evidence |\n' "$token_state"
  printf '| GitHub App bootstrap (`ID`, `INSTALLATION_ID`, private key file or PEM) | `id:%s install:%s key_file:%s key_pem:%s` | Token bootstrap when PAT is absent |\n' "$app_id_state" "$app_installation_state" "$app_key_file_state" "$app_key_pem_state"
  printf '| `PROMETHEUS_BASE_URL` | `%s` | `make verify-live-observability` |\n' "$prometheus_state"
  printf '| `GRAFANA_BASE_URL` | `%s` | `make verify-live-observability` |\n' "$grafana_base_state"
  printf '| `GRAFANA_API_TOKEN` | `%s` | `make verify-live-observability` |\n' "$grafana_token_state"
  printf '| `OBS_EVIDENCE_FILE` / `ROLLBACK_EVIDENCE_FILE` / `RESTORE_EVIDENCE_FILE` | `obs:%s rollback:%s restore:%s` | Evidence verification + checklist closure |\n' "$obs_evidence_state" "$rollback_evidence_state" "$restore_evidence_state"
  printf '| `IMAGE_TAG` / `IMAGE_REGISTRY_OWNER` | `tag:%s owner:%s` | Release render verification |\n' "$image_tag_state" "$image_owner_state"
  printf '| `STAGING_K8S_PUBLIC_BASE_URL` / `PRODUCTION_K8S_PUBLIC_BASE_URL` | `staging:%s prod:%s` | Env-specific runtime override proof |\n' "$staging_public_state" "$production_public_state"
  printf '\n'
} >>"$OUTPUT_FILE"

{
  printf '## Next Command Plan\n\n'
  printf '1. Populate live environment inputs and export them.\n'
  if [ -n "$missing_vars" ]; then
    printf 'Current missing vars: `%s`.\n' "$missing_vars"
  else
    printf 'Current missing vars: `none`.\n'
  fi
  printf 'REQUIRE_ENV_SPECIFIC_K8S_OVERRIDES: `%s`.\n' "$require_env_specific"
  printf 'For auth-required commands, use either `GITRANK_REPO_ADMIN_TOKEN` (or `GITHUB_TOKEN`) or GitHub App credentials (`GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, and private key).\n'
  printf '\n'
  printf '2. Run public workflow-health check and clear failing origin workflows.\n'
  printf '\n'
  printf '```bash\n'
  printf 'cd gitrank\n'
  printf 'GITHUB_REPOSITORY=%s make verify-public-workflow-health\n' "$DISPLAY_REPOSITORY"
  printf '```\n\n'
  printf '3. If Trivy workflow-health fails because remote policy files drift, sync them.\n'
  printf '\n'
  printf '```bash\n'
  printf 'cd gitrank\n'
  printf 'GITHUB_REPOSITORY=%s \\\n' "$DISPLAY_REPOSITORY"
  printf 'GITRANK_REPO_ADMIN_TOKEN=... \\\n'
  printf 'make sync-remote-trivy-policy\n'
  printf '```\n\n'
  printf '4. Run token access preflight for GitHub controls/workflow evidence.\n'
  printf '\n'
  printf '```bash\n'
  printf 'cd gitrank\n'
  printf 'GITHUB_REPOSITORY=%s \\\n' "$DISPLAY_REPOSITORY"
  printf 'GITRANK_REPO_ADMIN_TOKEN=... \\\n'
  printf 'make verify-live-github-access\n'
  printf '```\n\n'
  printf '5. Run public controls precheck and fix branch protection first if needed.\n'
  printf '\n'
  printf '```bash\n'
  printf 'cd gitrank\n'
  printf 'GITHUB_REPOSITORY=%s make verify-github-repository-controls-public\n' "$DISPLAY_REPOSITORY"
  printf '```\n\n'
  printf '6. Verify the remote live-gates workflow file is present and in sync.\n\n'
  printf '```bash\n'
  printf 'cd gitrank\n'
  printf 'GITHUB_REPOSITORY=%s make verify-remote-live-v2-workflow-sync\n' "$DISPLAY_REPOSITORY"
  printf '```\n\n'
  printf '7. Sync the live-gates workflow file to remote default branch if sync verification or dispatch/evidence probes report it missing or stale.\n\n'
  printf '```bash\n'
  printf 'cd gitrank\n'
  printf 'GITHUB_REPOSITORY=%s \\\n' "$DISPLAY_REPOSITORY"
  printf 'GITRANK_REPO_ADMIN_TOKEN=... \\\n'
  printf 'make sync-remote-live-v2-workflow\n'
  printf '```\n\n'
  printf '8. Run live-gates workflow evidence pipeline.\n\n'
  printf '```bash\n'
  printf 'cd gitrank\n'
  printf 'CONFIRM_RUN_LIVE_V2_PIPELINE=yes \\\n'
  printf 'GITHUB_REPOSITORY=%s \\\n' "$DISPLAY_REPOSITORY"
  printf 'GITRANK_REPO_ADMIN_TOKEN=... \\\n'
  printf 'TARGET_ENVIRONMENT=staging \\\n'
  printf 'RUN_GITHUB_CONTROLS=true \\\n'
  printf 'RUN_OBSERVABILITY=true \\\n'
  printf 'RUN_RELEASE_RENDER=true \\\n'
  printf 'ENVIRONMENT=staging \\\n'
  printf 'CLUSTER=your-cluster \\\n'
  printf 'NAMESPACE=gitrank \\\n'
  printf 'OPERATOR=your-name \\\n'
  printf 'make run-live-v2-workflow-evidence-pipeline\n'
  printf '```\n\n'
  printf 'If dispatch credentials are not available, you can use the scoped push trigger on `.github/workflows/verify-live-v2-gates.yml` (runs only when that workflow file changes on `main`):\n\n'
  printf '```bash\n'
  printf 'git add .github/workflows/verify-live-v2-gates.yml\n'
  printf 'git commit -s -m "ci(v2): trigger scoped live gates run"\n'
  printf 'git push origin main\n'
  printf 'cd gitrank\n'
  printf 'GITHUB_REPOSITORY=%s WORKFLOW_EVENT=any make verify-live-v2-workflow-run\n' "$DISPLAY_REPOSITORY"
  printf '```\n\n'
  printf 'If workflow evidence verification reports no successful `workflow_dispatch` run, retry the verifier across all events:\n\n'
  printf '```bash\n'
  printf 'cd gitrank\n'
  printf 'GITHUB_REPOSITORY=%s \\\n' "$DISPLAY_REPOSITORY"
  printf 'WORKFLOW_EVENT=any \\\n'
  printf 'make verify-live-v2-workflow-run\n'
  printf '```\n\n'
  printf '9. Generate rollback and restore drill evidence (or provide equivalent real drill records).\n\n'
  printf '```bash\n'
  printf 'cd gitrank\n'
  printf 'OUTPUT_FILE=docs/evidence/rollback-drill-YYYY-MM-DD.txt \\\n'
  printf 'ENVIRONMENT=staging CLUSTER=your-cluster NAMESPACE=gitrank OPERATOR=your-name \\\n'
  printf 'STARTING_COMMIT=<sha> CANDIDATE_COMMIT=<sha> ROLLBACK_TARGET_REVISION=<revision> \\\n'
  printf 'DATABASE_BACKUP_MARKER=<backup-id> WORKFLOW_RUN_URL=https://github.com/%s/actions/runs/<id> \\\n' "$DISPLAY_REPOSITORY"
  printf 'ROLLOUT_HISTORY_CAPTURED=yes ROLLBACK_MODE=workflow ROLLOUT_STATUS_RESULTS=healthy \\\n'
  printf 'CRITICAL_PRODUCT_CHECKS=pass make generate-rollback-drill-evidence\n'
  printf '\n'
  printf 'OUTPUT_FILE=docs/evidence/database-restore-drill-YYYY-MM-DD.txt \\\n'
  printf 'ENVIRONMENT=staging CLUSTER=your-cluster NAMESPACE=gitrank OPERATOR=your-name \\\n'
  printf 'RESTORE_SOURCE=managed-backup RESTORE_TARGET=staging-db BACKUP_IDENTIFIER=<backup-id> \\\n'
  printf 'RESTORE_START_TIMESTAMP=2026-05-12T10:00:00Z RESTORE_COMPLETION_TIMESTAMP=2026-05-12T10:15:00Z \\\n'
  printf 'RESTORE_COMMAND_OR_WORKFLOW=workflow SCHEMA_MIGRATION_STATE=up-to-date CRITICAL_PRODUCT_CHECKS=pass \\\n'
  printf 'make generate-database-restore-drill-evidence\n'
  printf '```\n\n'
  printf '10. Finalize checklist marking and re-audit.\n\n'
  printf 'Recommended path (env file):\n\n'
  printf '```bash\n'
  printf 'cd gitrank\n'
  printf 'make scaffold-v2-live-env\n'
  printf '# edit values, then run:\n'
  printf 'CONFIRM_FINALIZE_V2=yes \\\n'
  printf 'make finalize-v2-live-closeout-local-env\n'
  printf '```\n\n'
  printf 'Advanced explicit override path:\n\n'
  printf '```bash\n'
  printf 'cd gitrank\n'
  printf 'CONFIRM_FINALIZE_V2=yes VERIFY_FROM_WORKFLOW=true RUN_GITHUB_CONTROLS=true RUN_OBSERVABILITY=true RUN_K8S_RUNTIME=true RUN_ROLLBACK_RESTORE=true \\\n'
  printf 'REQUIRE_ENV_SPECIFIC_K8S_OVERRIDES=true \\\n'
  printf 'STAGING_K8S_PUBLIC_BASE_URL=https://staging.example \\\n'
  printf 'PRODUCTION_K8S_PUBLIC_BASE_URL=https://prod.example \\\n'
  printf 'STAGING_K8S_API_BASE_URL=https://api.staging.example \\\n'
  printf 'PRODUCTION_K8S_API_BASE_URL=https://api.prod.example \\\n'
  printf 'STAGING_K8S_AUTH_COOKIE_DOMAIN=.staging.example \\\n'
  printf 'PRODUCTION_K8S_AUTH_COOKIE_DOMAIN=.prod.example \\\n'
  printf 'STAGING_K8S_GITHUB_OAUTH_REDIRECT_URL=https://auth.staging.example/oauth/github/callback \\\n'
  printf 'PRODUCTION_K8S_GITHUB_OAUTH_REDIRECT_URL=https://auth.prod.example/oauth/github/callback \\\n'
  printf 'STAGING_K8S_API_HOST=api.staging.example \\\n'
  printf 'PRODUCTION_K8S_API_HOST=api.prod.example \\\n'
  printf 'STAGING_K8S_AUTH_HOST=auth.staging.example \\\n'
  printf 'PRODUCTION_K8S_AUTH_HOST=auth.prod.example \\\n'
  printf 'STAGING_K8S_TLS_SECRET_NAME=staging-tls \\\n'
  printf 'PRODUCTION_K8S_TLS_SECRET_NAME=production-tls \\\n'
  printf 'OBS_EVIDENCE_FILE=docs/evidence/observability-live-YYYY-MM-DD.txt \\\n'
  printf 'ROLLBACK_EVIDENCE_FILE=docs/evidence/rollback-drill-YYYY-MM-DD.txt \\\n'
  printf 'RESTORE_EVIDENCE_FILE=docs/evidence/database-restore-drill-YYYY-MM-DD.txt \\\n'
  printf 'make finalize-v2-live-closeout\n'
  printf '```\n\n'
  printf '11. Re-verify ABRA and full V2 checklist status.\n\n'
  printf '```bash\n'
  printf 'cd gitrank\n'
  printf 'make verify-abra-checklist\n'
  printf 'make audit-v2-contributing-checklist\n'
  printf '```\n\n'
  printf '### Probe Exit Codes\n\n'
  printf '%s\n' "- Branch divergence probe: \`$branch_divergence_code\`"
  printf '%s\n' "- Local readiness: \`$local_readiness_code\`"
  printf '%s\n' "- ABRA checklist gate: \`$abra_checklist_code\`"
  printf '%s\n' "- Contributing audit: \`$audit_code\`"
  printf '%s\n' "- Checklist audit public probe mode: \`$CHECKLIST_AUDIT_RUN_PUBLIC_PROBE_RESOLVED\` (configured: \`$CHECKLIST_AUDIT_RUN_PUBLIC_PROBE\`)"
  printf '%s\n' "- Env presence probe: \`$env_presence_code\`"
  printf '%s\n' "- Public workflow health: \`$public_workflow_health_code\`"
  printf '%s\n' "- Public workflow health mode: \`$CHECK_PUBLIC_WORKFLOW_HEALTH_RESOLVED\` (configured: \`$CHECK_PUBLIC_WORKFLOW_HEALTH\`)"
  printf '%s\n' "- Remote live workflow sync: \`$remote_live_workflow_sync_code\`"
  printf '%s\n' "- Live GitHub access preflight: \`$live_github_access_code\`"
  printf '%s\n' "- GitHub App permission snapshot: \`$github_app_permission_snapshot_code\`"
  printf '%s\n' "- Public controls precheck: \`$public_controls_code\`"
  printf '%s\n' "- Workflow evidence probe: \`$workflow_probe_code\`"
  printf '\n'
} >>"$OUTPUT_FILE"

printf 'v2 live closeout status report generated\n'
printf 'report: %s\n' "$OUTPUT_FILE"
