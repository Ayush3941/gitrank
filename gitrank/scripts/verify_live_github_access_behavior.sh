#!/usr/bin/env sh
set -eu

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
script="$root_dir/scripts/verify_live_github_access.sh"
tmp_root="${TMPDIR:-$root_dir/.tmp}"
mkdir -p "$tmp_root"

fail() {
  printf 'live github access behavior verification failed: %s\n' "$1" >&2
  exit 1
}

[ -s "$script" ] || fail "script missing: $script"

for required in \
  'is_placeholder_value() {' \
  'if is_placeholder_value "$TOKEN"; then' \
  'if is_placeholder_value "$GITHUB_APP_ID"; then' \
  'if is_placeholder_value "$GITHUB_APP_INSTALLATION_ID"; then' \
  'if is_placeholder_value "$GITHUB_APP_PRIVATE_KEY_FILE"; then' \
  'if is_placeholder_value "$GITHUB_APP_PRIVATE_KEY_PEM"; then' \
  'GITHUB_TOKEN, GH_TOKEN, or GITRANK_REPO_ADMIN_TOKEN is required (or set GitHub App credentials)'; do
  grep -qF "$required" "$script" || fail "missing script content: $required"
done

stderr_file="$tmp_root/gitrank-live-github-access-behavior.stderr"
set +e
GITHUB_REPOSITORY="octo/example" \
GITRANK_REPO_ADMIN_TOKEN="replace-me-with-repo-admin-token" \
GITHUB_APP_ID="replace-me-app-id" \
GITHUB_APP_INSTALLATION_ID="replace-me-installation-id" \
GITHUB_APP_PRIVATE_KEY_PEM="replace-me-private-key" \
TMPDIR="$tmp_root" \
  "$script" >/dev/null 2>"$stderr_file"
exit_code=$?
set -e

[ "$exit_code" -ne 0 ] || fail "placeholder-only credentials should fail"
grep -q "is required (or set GitHub App credentials)" "$stderr_file" \
  || fail "placeholder-only credentials should report missing credential guidance"

rm -f "$stderr_file"

echo "live github access behavior verification passed"
