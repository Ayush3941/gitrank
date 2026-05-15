#!/usr/bin/env sh
set -eu

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
script="$root_dir/scripts/finalize_v2_live_closeout.sh"

fail() {
  printf 'finalize-v2-live-closeout env-alias verification failed: %s\n' "$1" >&2
  exit 1
}

[ -s "$script" ] || fail "script missing: $script"

for required in \
  'FINALIZE_V2_ENV_FILE="${FINALIZE_V2_ENV_FILE:-${LIVE_V2_ENV_FILE:-}}"' \
  '. "$resolved_finalize_env_file"' \
  'RESOLVED_GITHUB_APP_ID="${GITHUB_APP_ID:-${GITRANK_GITHUB_APP_ID:-}}"' \
  'RESOLVED_GITHUB_APP_INSTALLATION_ID="${GITHUB_APP_INSTALLATION_ID:-${GITRANK_GITHUB_APP_INSTALLATION_ID:-}}"' \
  'RESOLVED_GITHUB_APP_PRIVATE_KEY_FILE="${GITHUB_APP_PRIVATE_KEY_FILE:-${GITRANK_GITHUB_APP_PRIVATE_KEY_FILE:-}}"' \
  'RESOLVED_GITHUB_APP_PRIVATE_KEY_PEM="${GITHUB_APP_PRIVATE_KEY_PEM:-${GITRANK_GITHUB_APP_PRIVATE_KEY_PEM:-}}"' \
  '[ -z "$RESOLVED_GITHUB_APP_ID" ] || [ -z "$RESOLVED_GITHUB_APP_INSTALLATION_ID" ]' \
  '[ -z "$RESOLVED_GITHUB_APP_PRIVATE_KEY_FILE" ] && [ -z "$RESOLVED_GITHUB_APP_PRIVATE_KEY_PEM" ]' \
  'GITHUB_APP_ID="$RESOLVED_GITHUB_APP_ID" \' \
  'GITHUB_APP_INSTALLATION_ID="$RESOLVED_GITHUB_APP_INSTALLATION_ID" \' \
  'GITHUB_APP_PRIVATE_KEY_FILE="$RESOLVED_GITHUB_APP_PRIVATE_KEY_FILE" \' \
  'GITHUB_APP_PRIVATE_KEY_PEM="$RESOLVED_GITHUB_APP_PRIVATE_KEY_PEM" \' \
  'export GITHUB_APP_ID="$RESOLVED_GITHUB_APP_ID"' \
  'export GITHUB_APP_INSTALLATION_ID="$RESOLVED_GITHUB_APP_INSTALLATION_ID"' \
  'export GITHUB_APP_PRIVATE_KEY_FILE="$RESOLVED_GITHUB_APP_PRIVATE_KEY_FILE"' \
  'export GITHUB_APP_PRIVATE_KEY_PEM="$RESOLVED_GITHUB_APP_PRIVATE_KEY_PEM"'; do
  grep -qF "$required" "$script" || fail "missing script content: $required"
done

echo "finalize-v2-live-closeout env-alias verification passed"
