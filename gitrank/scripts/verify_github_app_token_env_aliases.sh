#!/usr/bin/env sh
set -eu

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
script="$root_dir/scripts/create_github_app_installation_token.sh"

fail() {
  printf 'github-app token env-alias verification failed: %s\n' "$1" >&2
  exit 1
}

[ -s "$script" ] || fail "script missing: $script"

for required in \
  'APP_ID="${GITHUB_APP_ID:-${GITRANK_GITHUB_APP_ID:-}}"' \
  'INSTALLATION_ID="${GITHUB_APP_INSTALLATION_ID:-${GITRANK_GITHUB_APP_INSTALLATION_ID:-}}"' \
  'PRIVATE_KEY_FILE="${GITHUB_APP_PRIVATE_KEY_FILE:-${GITRANK_GITHUB_APP_PRIVATE_KEY_FILE:-}}"' \
  'PRIVATE_KEY_PEM="${GITHUB_APP_PRIVATE_KEY_PEM:-${GITRANK_GITHUB_APP_PRIVATE_KEY_PEM:-}}"' \
  'GITHUB_APP_ID or GITRANK_GITHUB_APP_ID is required' \
  'GITHUB_APP_INSTALLATION_ID or GITRANK_GITHUB_APP_INSTALLATION_ID is required' \
  'set GITHUB_APP_PRIVATE_KEY_FILE/GITRANK_GITHUB_APP_PRIVATE_KEY_FILE or GITHUB_APP_PRIVATE_KEY_PEM/GITRANK_GITHUB_APP_PRIVATE_KEY_PEM'; do
  grep -qF "$required" "$script" || fail "missing script content: $required"
done

echo "github-app token env-alias verification passed"
