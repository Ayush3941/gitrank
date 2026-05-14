#!/usr/bin/env sh
set -eu

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
repo_dir="$(CDPATH= cd -- "$root_dir/.." && pwd)"
tmp_root="${TMPDIR:-$root_dir/.tmp}"
mkdir -p "$tmp_root"

OUTPUT_FILE="${OUTPUT_FILE:-$root_dir/docs/releases/v2-live-closeout-status-latest.md}"
CHECK_PUBLIC_GITHUB_CONTROLS="${CHECK_PUBLIC_GITHUB_CONTROLS:-true}"
CHECK_PUBLIC_WORKFLOW_HEALTH="${CHECK_PUBLIC_WORKFLOW_HEALTH:-true}"
CHECK_REMOTE_LIVE_WORKFLOW_SYNC="${CHECK_REMOTE_LIVE_WORKFLOW_SYNC:-true}"
CHECK_WORKFLOW_EVIDENCE="${CHECK_WORKFLOW_EVIDENCE:-true}"
CHECK_LIVE_GITHUB_ACCESS="${CHECK_LIVE_GITHUB_ACCESS:-true}"
WORKFLOW_RUN_ID="${WORKFLOW_RUN_ID:-latest}"
WORKFLOW_EVENT="${WORKFLOW_EVENT:-workflow_dispatch}"
DISPLAY_REPOSITORY="${GITHUB_REPOSITORY_DISPLAY:-OWNER/REPO}"

fail() {
  printf 'generate v2 live closeout status failed: %s\n' "$1" >&2
  exit 1
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
  [ -n "$sanitized_file" ] && rm -f "$sanitized_file"
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

mkdir -p "$(dirname "$OUTPUT_FILE")"

{
  printf '# V2 Live Closeout Status\n\n'
  printf '%s\n' "- Generated at (UTC): \`$(date -u +%Y-%m-%dT%H:%M:%SZ)\`"
  printf '%s\n' "- Repository: \`$DISPLAY_REPOSITORY\`"
  printf '%s\n' "- Workdir: \`$root_dir\`"
  printf '\n'
} >"$OUTPUT_FILE"

run_and_capture "Branch Divergence" \
  sh -c "cd '$repo_dir' && git status --short --branch && printf '\nleft-right count (origin/main...HEAD): ' && git rev-list --left-right --count origin/main...HEAD && printf '\nrecent divergent commits:\n' && git log --oneline --left-right --decorate --max-count=30 origin/main...HEAD"
branch_divergence_code=$RUN_CAPTURE_LAST_CODE

run_and_capture "Local Readiness Gate" \
  sh -c "cd '$root_dir' && make verify-v2-live-readiness"
local_readiness_code=$RUN_CAPTURE_LAST_CODE

audit_report_tmp="${AUDIT_REPORT_FILE:-$tmp_root/v2-closeout-status-audit.$$.md}"
run_and_capture "Contributing Checklist Audit" \
  sh -c "cd '$root_dir' && RUN_BASELINE_VERIFIERS=false AUDIT_REPORT_FILE='$audit_report_tmp' make audit-v2-contributing-checklist"
audit_code=$RUN_CAPTURE_LAST_CODE

if [ -s "$audit_report_tmp" ]; then
  {
    printf '## Checklist Audit Artifact\n\n'
    printf '%s\n\n' "- File: \`$audit_report_tmp\`"
    printf '```markdown\n'
    sed -n '1,260p' "$audit_report_tmp"
    printf '```\n\n'
  } >>"$OUTPUT_FILE"
fi

run_and_capture "Essential Live Env Presence" \
  sh -c '
for v in GITHUB_REPOSITORY GITRANK_REPO_ADMIN_TOKEN GITHUB_TOKEN GH_TOKEN GITHUB_APP_ID GITHUB_APP_INSTALLATION_ID GITHUB_APP_PRIVATE_KEY_FILE GITHUB_APP_PRIVATE_KEY_PEM GITRANK_GITHUB_APP_ID GITRANK_GITHUB_APP_INSTALLATION_ID GITRANK_GITHUB_APP_PRIVATE_KEY_FILE GITRANK_GITHUB_APP_PRIVATE_KEY_PEM PROMETHEUS_BASE_URL GRAFANA_BASE_URL GRAFANA_API_TOKEN OBS_EVIDENCE_FILE ROLLBACK_EVIDENCE_FILE RESTORE_EVIDENCE_FILE IMAGE_TAG IMAGE_REGISTRY_OWNER REQUIRE_ENV_SPECIFIC_K8S_OVERRIDES STAGING_K8S_PUBLIC_BASE_URL PRODUCTION_K8S_PUBLIC_BASE_URL STAGING_K8S_API_BASE_URL PRODUCTION_K8S_API_BASE_URL STAGING_K8S_AUTH_COOKIE_DOMAIN PRODUCTION_K8S_AUTH_COOKIE_DOMAIN STAGING_K8S_GITHUB_OAUTH_REDIRECT_URL PRODUCTION_K8S_GITHUB_OAUTH_REDIRECT_URL STAGING_K8S_API_HOST PRODUCTION_K8S_API_HOST STAGING_K8S_AUTH_HOST PRODUCTION_K8S_AUTH_HOST STAGING_K8S_TLS_SECRET_NAME PRODUCTION_K8S_TLS_SECRET_NAME; do
  eval val="\${$v-}"
  if [ -n "$val" ]; then
    echo "$v=set"
  else
    echo "$v=unset"
  fi
done
'
env_presence_code=$RUN_CAPTURE_LAST_CODE

public_workflow_health_code=skip
if [ "$CHECK_PUBLIC_WORKFLOW_HEALTH" = "true" ]; then
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
  eval val="\${$v-}"
  [ -n "$val" ] || add_missing_var "$v"
done

require_env_specific="${REQUIRE_ENV_SPECIFIC_K8S_OVERRIDES:-true}"
if [ "$require_env_specific" = "true" ]; then
  for v in STAGING_K8S_PUBLIC_BASE_URL PRODUCTION_K8S_PUBLIC_BASE_URL STAGING_K8S_API_BASE_URL PRODUCTION_K8S_API_BASE_URL STAGING_K8S_AUTH_COOKIE_DOMAIN PRODUCTION_K8S_AUTH_COOKIE_DOMAIN STAGING_K8S_GITHUB_OAUTH_REDIRECT_URL PRODUCTION_K8S_GITHUB_OAUTH_REDIRECT_URL STAGING_K8S_API_HOST PRODUCTION_K8S_API_HOST STAGING_K8S_AUTH_HOST PRODUCTION_K8S_AUTH_HOST STAGING_K8S_TLS_SECRET_NAME PRODUCTION_K8S_TLS_SECRET_NAME; do
    eval val="\${$v-}"
    [ -n "$val" ] || add_missing_var "$v"
  done
fi

token_candidate="${GITRANK_REPO_ADMIN_TOKEN:-${GITHUB_TOKEN:-${GH_TOKEN:-}}}"
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
if [ -z "$token_candidate" ] && [ "$has_app_bootstrap" != "true" ]; then
  add_missing_var "GITRANK_REPO_ADMIN_TOKEN_OR_GITHUB_TOKEN_OR_GH_TOKEN_OR_GITHUB_APP_CREDENTIALS"
fi

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
  printf '### Probe Exit Codes\n\n'
  printf '%s\n' "- Branch divergence probe: \`$branch_divergence_code\`"
  printf '%s\n' "- Local readiness: \`$local_readiness_code\`"
  printf '%s\n' "- Contributing audit: \`$audit_code\`"
  printf '%s\n' "- Env presence probe: \`$env_presence_code\`"
  printf '%s\n' "- Public workflow health: \`$public_workflow_health_code\`"
  printf '%s\n' "- Remote live workflow sync: \`$remote_live_workflow_sync_code\`"
  printf '%s\n' "- Live GitHub access preflight: \`$live_github_access_code\`"
  printf '%s\n' "- Public controls precheck: \`$public_controls_code\`"
  printf '%s\n' "- Workflow evidence probe: \`$workflow_probe_code\`"
  printf '\n'
} >>"$OUTPUT_FILE"

printf 'v2 live closeout status report generated\n'
printf 'report: %s\n' "$OUTPUT_FILE"
