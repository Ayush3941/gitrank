#!/usr/bin/env sh
set -eu

API_BASE="${GITHUB_API_URL:-https://api.github.com}"
API_VERSION="${GITHUB_API_VERSION:-2026-03-10}"
API_TIMEOUT_SECONDS="${GITHUB_API_TIMEOUT_SECONDS:-30}"
APP_ID="${GITHUB_APP_ID:-${GITRANK_GITHUB_APP_ID:-}}"
INSTALLATION_ID="${GITHUB_APP_INSTALLATION_ID:-${GITRANK_GITHUB_APP_INSTALLATION_ID:-}}"
PRIVATE_KEY_FILE="${GITHUB_APP_PRIVATE_KEY_FILE:-${GITRANK_GITHUB_APP_PRIVATE_KEY_FILE:-}}"
PRIVATE_KEY_PEM="${GITHUB_APP_PRIVATE_KEY_PEM:-${GITRANK_GITHUB_APP_PRIVATE_KEY_PEM:-}}"
TOKEN_OUTPUT_FILE="${TOKEN_OUTPUT_FILE:-}"
GITHUB_ENV_FILE="${GITHUB_ENV_FILE:-}"
PRINT_TOKEN="${PRINT_TOKEN:-false}"
TMP_ROOT="${TMPDIR:-/tmp}"

fail() {
  printf 'github app installation token creation failed: %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"
}

base64url() {
  openssl base64 -A | tr '+/' '-_' | tr -d '='
}

[ -n "$APP_ID" ] || fail "GITHUB_APP_ID or GITRANK_GITHUB_APP_ID is required"
[ -n "$INSTALLATION_ID" ] || fail "GITHUB_APP_INSTALLATION_ID or GITRANK_GITHUB_APP_INSTALLATION_ID is required"

require_command curl
require_command jq
require_command openssl
require_command date
require_command mktemp
mkdir -p "$TMP_ROOT"

temp_key_file=
cleanup() {
  if [ -n "$temp_key_file" ] && [ -f "$temp_key_file" ]; then
    rm -f "$temp_key_file"
  fi
}
trap cleanup EXIT

if [ -z "$PRIVATE_KEY_FILE" ]; then
  [ -n "$PRIVATE_KEY_PEM" ] || fail "set GITHUB_APP_PRIVATE_KEY_FILE/GITRANK_GITHUB_APP_PRIVATE_KEY_FILE or GITHUB_APP_PRIVATE_KEY_PEM/GITRANK_GITHUB_APP_PRIVATE_KEY_PEM"
  temp_key_file=$(mktemp "$TMP_ROOT/gitrank-app-key.XXXXXX.pem")
  chmod 600 "$temp_key_file"
  printf '%s' "$PRIVATE_KEY_PEM" >"$temp_key_file"
  PRIVATE_KEY_FILE="$temp_key_file"
fi
[ -s "$PRIVATE_KEY_FILE" ] || fail "private key file is missing or empty: $PRIVATE_KEY_FILE"

now=$(date -u +%s)
iat=$((now - 60))
exp=$((now + 540))

header='{"alg":"RS256","typ":"JWT"}'
payload=$(jq -nc --argjson iat "$iat" --argjson exp "$exp" --arg iss "$APP_ID" '{iat:$iat,exp:$exp,iss:$iss}')

header_b64=$(printf '%s' "$header" | base64url)
payload_b64=$(printf '%s' "$payload" | base64url)
unsigned="${header_b64}.${payload_b64}"
signature_b64=$(printf '%s' "$unsigned" | openssl dgst -binary -sha256 -sign "$PRIVATE_KEY_FILE" | base64url)
jwt="${unsigned}.${signature_b64}"

response_file=$(mktemp "$TMP_ROOT/gitrank-app-token-response.XXXXXX.json")
status_code=$(curl -sS -o "$response_file" -w '%{http_code}' \
  --connect-timeout "$API_TIMEOUT_SECONDS" \
  --max-time "$API_TIMEOUT_SECONDS" \
  -X POST \
  -H 'Accept: application/vnd.github+json' \
  -H "Authorization: Bearer $jwt" \
  -H "X-GitHub-Api-Version: $API_VERSION" \
  "$API_BASE/app/installations/$INSTALLATION_ID/access_tokens") || {
    rm -f "$response_file"
    fail "token exchange request failed"
  }

case "$status_code" in
  200|201) ;;
  *)
    body=$(cat "$response_file")
    rm -f "$response_file"
    fail "token exchange returned HTTP $status_code: $body"
    ;;
esac

token=$(jq -r '.token // empty' "$response_file")
expires_at=$(jq -r '.expires_at // empty' "$response_file")
rm -f "$response_file"
[ -n "$token" ] || fail "GitHub API response did not include token"
[ -n "$expires_at" ] || fail "GitHub API response did not include expires_at"

if [ -n "$TOKEN_OUTPUT_FILE" ]; then
  umask 077
  printf '%s\n' "$token" >"$TOKEN_OUTPUT_FILE"
fi

if [ -n "$GITHUB_ENV_FILE" ]; then
  printf 'GITHUB_TOKEN=%s\n' "$token" >>"$GITHUB_ENV_FILE"
fi

if [ "$PRINT_TOKEN" = "true" ]; then
  printf '%s\n' "$token"
fi

printf 'github app installation token created\n'
printf 'installation_id: %s\n' "$INSTALLATION_ID"
printf 'expires_at: %s\n' "$expires_at"
if [ -n "$TOKEN_OUTPUT_FILE" ]; then
  printf 'token_file: %s\n' "$TOKEN_OUTPUT_FILE"
fi
if [ -n "$GITHUB_ENV_FILE" ]; then
  printf 'github_env_file: %s\n' "$GITHUB_ENV_FILE"
fi
