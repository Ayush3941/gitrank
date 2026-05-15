#!/usr/bin/env sh
set -eu

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

RUN_LOCAL_STATIC="${RUN_LOCAL_STATIC:-true}"
RUN_GITHUB_CONTROLS="${RUN_GITHUB_CONTROLS:-false}"
APPLY_GITHUB_CONTROLS="${APPLY_GITHUB_CONTROLS:-false}"
RUN_OBSERVABILITY="${RUN_OBSERVABILITY:-false}"
RUN_RELEASE_RENDER="${RUN_RELEASE_RENDER:-false}"
RUN_INPUT_PREFLIGHT="${RUN_INPUT_PREFLIGHT:-true}"
RUN_PUBLIC_WORKFLOW_HEALTH="${RUN_PUBLIC_WORKFLOW_HEALTH:-false}"
AUTO_SYNC_REMOTE_TRIVY_POLICY="${AUTO_SYNC_REMOTE_TRIVY_POLICY:-false}"
RUN_REMOTE_WORKFLOW_SYNC="${RUN_REMOTE_WORKFLOW_SYNC:-false}"
AUTO_SYNC_REMOTE_WORKFLOW="${AUTO_SYNC_REMOTE_WORKFLOW:-false}"

fail() {
  printf 'v2 live readiness verification failed: %s\n' "$1" >&2
  exit 1
}

run_make() {
  target=$1
  shift || true
  (cd "$root_dir" && TMPDIR="${TMPDIR:-$root_dir/.tmp}" make "$target" "$@")
}

if [ "$RUN_LOCAL_STATIC" = "true" ]; then
  run_make verify-v2-no-mock-release-gate
  run_make verify-contributing-checked-file-refs
  run_make verify-v2-unresolved-checklist-scope
  run_make verify-live-v2-workflow
  run_make verify-observability-manifests
  run_make verify-rollback-procedure
  run_make verify-k8s-autoscaling
  run_make verify-secret-policy
  run_make verify-finalize-v2-closeout-env-aliases
  run_make verify-github-app-token-env-aliases
  run_make verify-v2-completion-audit-behavior
  run_make verify-v2-artifact-redaction
fi

if [ "$RUN_PUBLIC_WORKFLOW_HEALTH" = "true" ]; then
  if run_make verify-public-workflow-health; then
    :
  else
    if [ "$AUTO_SYNC_REMOTE_TRIVY_POLICY" = "true" ]; then
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
      if [ -z "$token_candidate" ] && [ "$has_app_bootstrap" != "true" ]; then
        push_probe_log=$(mktemp "${TMPDIR:-$root_dir/.tmp}/gitrank-origin-push-probe.XXXXXX")
        if run_make verify-origin-push-access >"$push_probe_log" 2>&1; then
          current_branch=$(git -C "$root_dir/.." rev-parse --abbrev-ref HEAD 2>/dev/null || printf 'main')
          rm -f "$push_probe_log"
          fail "public workflow health failed and AUTO_SYNC_REMOTE_TRIVY_POLICY=true, but no admin token/App credentials are set. Push the local branch to origin to sync Trivy policy drift (verify-origin-push-access passed). Example: git push origin $current_branch"
        else
          push_summary=$(grep -E 'origin push access verification (failed|passed)' "$push_probe_log" | tail -n 1 2>/dev/null || true)
          if [ -z "$push_summary" ]; then
            push_summary=$(tail -n 1 "$push_probe_log" 2>/dev/null || true)
          fi
          rm -f "$push_probe_log"
          if [ -z "$push_summary" ]; then
            push_summary="origin push access probe failed (no output captured)"
          fi
          fail "public workflow health failed and AUTO_SYNC_REMOTE_TRIVY_POLICY=true, but no admin token/App credentials are set. $push_summary"
        fi
      fi
      run_make sync-remote-trivy-policy
      run_make verify-public-workflow-health
    else
      fail "public workflow health gate failed (set AUTO_SYNC_REMOTE_TRIVY_POLICY=true to attempt automated Trivy policy sync)"
    fi
  fi
fi

if [ "$RUN_REMOTE_WORKFLOW_SYNC" = "true" ]; then
  if [ "$RUN_INPUT_PREFLIGHT" = "true" ]; then
    RUN_REMOTE_WORKFLOW_SYNC=true \
    AUTO_SYNC_REMOTE_WORKFLOW="$AUTO_SYNC_REMOTE_WORKFLOW" \
    run_make verify-live-v2-inputs
  fi
  if run_make verify-remote-live-v2-workflow-sync; then
    :
  else
    if [ "$AUTO_SYNC_REMOTE_WORKFLOW" = "true" ]; then
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
      if [ -z "$token_candidate" ] && [ "$has_app_bootstrap" != "true" ]; then
        push_probe_log=$(mktemp "${TMPDIR:-$root_dir/.tmp}/gitrank-origin-push-probe.XXXXXX")
        if run_make verify-origin-push-access >"$push_probe_log" 2>&1; then
          current_branch=$(git -C "$root_dir/.." rev-parse --abbrev-ref HEAD 2>/dev/null || printf 'main')
          rm -f "$push_probe_log"
          fail "remote workflow sync failed and AUTO_SYNC_REMOTE_WORKFLOW=true, but no admin token/App credentials are set. Push the local branch to origin to sync workflow drift (verify-origin-push-access passed). Example: git push origin $current_branch"
        else
          push_summary=$(grep -E 'origin push access verification (failed|passed)' "$push_probe_log" | tail -n 1 2>/dev/null || true)
          if [ -z "$push_summary" ]; then
            push_summary=$(tail -n 1 "$push_probe_log" 2>/dev/null || true)
          fi
          rm -f "$push_probe_log"
          if [ -z "$push_summary" ]; then
            push_summary="origin push access probe failed (no output captured)"
          fi
          fail "remote workflow sync failed and AUTO_SYNC_REMOTE_WORKFLOW=true, but no admin token/App credentials are set. $push_summary"
        fi
      fi
      run_make sync-remote-live-v2-workflow
      run_make verify-remote-live-v2-workflow-sync
    else
      fail "remote live workflow sync gate failed (set AUTO_SYNC_REMOTE_WORKFLOW=true to attempt automated workflow sync)"
    fi
  fi
fi

if [ "$RUN_GITHUB_CONTROLS" = "true" ]; then
  if [ "$RUN_INPUT_PREFLIGHT" = "true" ]; then
    RUN_GITHUB_CONTROLS=true run_make verify-live-v2-inputs
  fi
  run_make verify-live-github-access
  if [ "$APPLY_GITHUB_CONTROLS" = "true" ]; then
    export GITRANK_APPLY_REPOSITORY_CONTROLS=yes
    run_make apply-github-repository-controls-auto
  fi
  run_make verify-github-repository-controls
fi

if [ "$RUN_OBSERVABILITY" = "true" ]; then
  if [ "$RUN_INPUT_PREFLIGHT" = "true" ]; then
    RUN_OBSERVABILITY=true run_make verify-live-v2-inputs
  fi
  run_make verify-live-observability
fi

if [ -n "${OBS_EVIDENCE_FILE:-}" ]; then
  run_make verify-observability-evidence EVIDENCE_FILE="$OBS_EVIDENCE_FILE"
fi

if [ -n "${ROLLBACK_EVIDENCE_FILE:-}" ]; then
  run_make verify-rollback-drill-evidence EVIDENCE_FILE="$ROLLBACK_EVIDENCE_FILE"
fi

if [ -n "${RESTORE_EVIDENCE_FILE:-}" ]; then
  run_make verify-database-restore-drill-evidence EVIDENCE_FILE="$RESTORE_EVIDENCE_FILE"
fi

if [ "$RUN_RELEASE_RENDER" = "true" ]; then
  if [ "$RUN_INPUT_PREFLIGHT" = "true" ]; then
    RUN_RELEASE_RENDER=true run_make verify-live-v2-inputs
  fi
  [ -n "${K8S_ENVIRONMENT:-}" ] || fail "K8S_ENVIRONMENT is required when RUN_RELEASE_RENDER=true"
  [ -n "${OUTPUT_FILE:-}" ] || fail "OUTPUT_FILE is required when RUN_RELEASE_RENDER=true"
  run_make render-k8s-release-manifests K8S_ENVIRONMENT="$K8S_ENVIRONMENT" OUTPUT_FILE="$OUTPUT_FILE"
fi

printf 'v2 live readiness verification passed\n'
