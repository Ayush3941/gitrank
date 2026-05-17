#!/usr/bin/env sh
set -eu

CLIENT_ID="${GITHUB_OAUTH_WEB_CLIENT_ID:-${GITHUB_CLIENT_ID:-${GITHUB_APP_CLIENT_ID:-}}}"
CLIENT_SECRET="${GITHUB_OAUTH_WEB_CLIENT_SECRET:-${GITHUB_CLIENT_SECRET:-${GITHUB_APP_CLIENT_SECRET:-}}}"
AUTHORIZE_URL="${GITHUB_OAUTH_AUTHORIZE_URL:-https://github.com/login/oauth/authorize}"
TOKEN_URL="${GITHUB_OAUTH_EXCHANGE_URL:-https://github.com/login/oauth/access_token}"
REDIRECT_URL="${GITHUB_OAUTH_REDIRECT_URL:-http://localhost:8081/oauth/github/callback}"
SCOPES="${GITHUB_OAUTH_WEB_SCOPES:-repo read:org admin:repo_hook security_events}"
STATE="${GITHUB_OAUTH_WEB_STATE:-}"
CALLBACK_INPUT="${GITHUB_OAUTH_WEB_CALLBACK_URL:-}"
TOKEN_OUTPUT_FILE="${TOKEN_OUTPUT_FILE:-}"
TMP_ROOT="${TMPDIR:-/tmp}"

fail() {
  printf 'github oauth web-flow token bootstrap failed: %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"
}

urlencode() {
  printf '%s' "$1" | jq -sRr @uri
}

extract_param() {
  key="$1"
  input="$2"
  query="$input"
  case "$query" in
    *\?*) query="${query#*\?}" ;;
  esac
  old_ifs="${IFS-}"
  IFS='&'
  set -- $query
  IFS="$old_ifs"
  for part in "$@"; do
    case "$part" in
      "$key="*)
        printf '%s' "${part#*=}"
        return 0
        ;;
    esac
  done
  return 1
}

[ -n "$CLIENT_ID" ] || fail "GITHUB_OAUTH_WEB_CLIENT_ID (or GITHUB_CLIENT_ID / GITHUB_APP_CLIENT_ID) is required"
[ -n "$CLIENT_SECRET" ] || fail "GITHUB_OAUTH_WEB_CLIENT_SECRET (or GITHUB_CLIENT_SECRET / GITHUB_APP_CLIENT_SECRET) is required"
[ -n "$AUTHORIZE_URL" ] || fail "GITHUB_OAUTH_AUTHORIZE_URL is required"
[ -n "$TOKEN_URL" ] || fail "GITHUB_OAUTH_EXCHANGE_URL is required"
[ -n "$REDIRECT_URL" ] || fail "GITHUB_OAUTH_REDIRECT_URL is required"

require_command curl
require_command jq
require_command mktemp
mkdir -p "$TMP_ROOT"

if [ -z "$STATE" ]; then
  if command -v openssl >/dev/null 2>&1; then
    STATE="$(openssl rand -hex 16)"
  else
    STATE="$(date +%s)-$$"
  fi
fi

encoded_client_id=$(urlencode "$CLIENT_ID")
encoded_redirect=$(urlencode "$REDIRECT_URL")
encoded_scopes=$(urlencode "$SCOPES")
encoded_state=$(urlencode "$STATE")

authorize_link="${AUTHORIZE_URL}?client_id=${encoded_client_id}&redirect_uri=${encoded_redirect}&scope=${encoded_scopes}&state=${encoded_state}"

printf '\n'
printf 'GitHub OAuth web authorization required\n'
printf '1. Open this URL in a browser:\n'
printf '%s\n' "$authorize_link"
printf '\n'
printf '2. Approve the OAuth scopes: %s\n' "$SCOPES"
printf '3. After redirect, copy the full callback URL (or just the code value).\n'
printf '\n'

if [ -z "$CALLBACK_INPUT" ]; then
  printf 'Paste callback URL or code: '
  IFS= read -r CALLBACK_INPUT
fi

CALLBACK_INPUT=$(printf '%s' "$CALLBACK_INPUT" | sed 's/[[:space:]]*$//')
[ -n "$CALLBACK_INPUT" ] || fail "authorization callback URL or code is required"

CODE=""
RETURNED_STATE=""
if printf '%s' "$CALLBACK_INPUT" | grep -q 'code='; then
  CODE="$(extract_param code "$CALLBACK_INPUT" || true)"
  RETURNED_STATE="$(extract_param state "$CALLBACK_INPUT" || true)"
else
  CODE="$CALLBACK_INPUT"
fi

[ -n "$CODE" ] || fail "could not extract code from callback input"
if [ -n "$RETURNED_STATE" ] && [ "$RETURNED_STATE" != "$STATE" ]; then
  fail "state mismatch; expected $STATE, got $RETURNED_STATE"
fi

token_response_file=$(mktemp "$TMP_ROOT/gitrank-oauth-web-token.XXXXXX")
trap 'rm -f "$token_response_file"' EXIT

token_request_status=$(
  {
    curl -sS \
      --connect-timeout 30 \
      --max-time 30 \
      -o "$token_response_file" \
      -w '%{http_code}' \
      -X POST \
      -H 'Accept: application/json' \
      -H 'Content-Type: application/x-www-form-urlencoded' \
      --data-urlencode "client_id=$CLIENT_ID" \
      --data-urlencode "client_secret=$CLIENT_SECRET" \
      --data-urlencode "code=$CODE" \
      --data-urlencode "redirect_uri=$REDIRECT_URL" \
      --data-urlencode "state=$STATE" \
      "$TOKEN_URL"
  } || true
)

if [ "$token_request_status" != "200" ]; then
  token_error=$(jq -r '.error_description // .error // .message // empty' "$token_response_file" 2>/dev/null || true)
  if [ -n "$token_error" ]; then
    fail "token exchange failed (HTTP $token_request_status): $token_error"
  fi
  fail "token exchange failed (HTTP $token_request_status)"
fi

ACCESS_TOKEN=$(jq -r '.access_token // empty' "$token_response_file")
TOKEN_SCOPE=$(jq -r '.scope // empty' "$token_response_file")
TOKEN_ERROR=$(jq -r '.error_description // .error // empty' "$token_response_file")

[ -n "$ACCESS_TOKEN" ] || fail "token exchange response missing access_token${TOKEN_ERROR:+ ($TOKEN_ERROR)}"

printf 'oauth web flow completed\n'
printf 'granted scopes: %s\n' "$TOKEN_SCOPE"
if [ -n "$TOKEN_OUTPUT_FILE" ]; then
  printf '%s' "$ACCESS_TOKEN" >"$TOKEN_OUTPUT_FILE"
  printf 'token written to %s\n' "$TOKEN_OUTPUT_FILE"
else
  printf 'export GITRANK_REPO_ADMIN_TOKEN=%s\n' "$ACCESS_TOKEN"
fi
