#!/usr/bin/env sh
set -eu

CLIENT_ID="${GITHUB_DEVICE_FLOW_CLIENT_ID:-${GITHUB_CLIENT_ID:-${GITHUB_APP_CLIENT_ID:-}}}"
CLIENT_SECRET="${GITHUB_DEVICE_FLOW_CLIENT_SECRET:-${GITHUB_CLIENT_SECRET:-${GITHUB_APP_CLIENT_SECRET:-}}}"
DEVICE_URL="${GITHUB_OAUTH_DEVICE_URL:-https://github.com/login/device/code}"
TOKEN_URL="${GITHUB_OAUTH_EXCHANGE_URL:-https://github.com/login/oauth/access_token}"
SCOPES="${GITHUB_DEVICE_FLOW_SCOPES:-repo read:org admin:repo_hook}"
POLL_INTERVAL_SECONDS="${GITHUB_DEVICE_FLOW_POLL_INTERVAL_SECONDS:-5}"
MAX_WAIT_SECONDS="${GITHUB_DEVICE_FLOW_MAX_WAIT_SECONDS:-600}"
TOKEN_OUTPUT_FILE="${TOKEN_OUTPUT_FILE:-}"
TMP_ROOT="${TMPDIR:-/tmp}"

fail() {
  printf 'github device-flow token bootstrap failed: %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"
}

[ -n "$CLIENT_ID" ] || fail "GITHUB_DEVICE_FLOW_CLIENT_ID (or GITHUB_CLIENT_ID / GITHUB_APP_CLIENT_ID) is required"
[ -n "$CLIENT_SECRET" ] || fail "GITHUB_DEVICE_FLOW_CLIENT_SECRET (or GITHUB_CLIENT_SECRET / GITHUB_APP_CLIENT_SECRET) is required"
[ -n "$DEVICE_URL" ] || fail "GITHUB_OAUTH_DEVICE_URL is required"
[ -n "$TOKEN_URL" ] || fail "GITHUB_OAUTH_EXCHANGE_URL is required"

require_command curl
require_command jq
require_command mktemp
mkdir -p "$TMP_ROOT"

device_response_file=$(mktemp "$TMP_ROOT/gitrank-device-flow-device.XXXXXX")
token_response_file=$(mktemp "$TMP_ROOT/gitrank-device-flow-token.XXXXXX")
trap 'rm -f "$device_response_file" "$token_response_file"' EXIT

if [ -n "$SCOPES" ]; then
  device_code_request_status=$(
    {
      curl -sS \
        --connect-timeout 30 \
        --max-time 30 \
        -o "$device_response_file" \
        -w '%{http_code}' \
        -X POST \
        -H 'Accept: application/json' \
        -H 'Content-Type: application/x-www-form-urlencoded' \
        --data-urlencode "client_id=$CLIENT_ID" \
        --data-urlencode "scope=$SCOPES" \
        "$DEVICE_URL"
    } || true
  )
else
  device_code_request_status=$(
    {
      curl -sS \
        --connect-timeout 30 \
        --max-time 30 \
        -o "$device_response_file" \
        -w '%{http_code}' \
        -X POST \
        -H 'Accept: application/json' \
        -H 'Content-Type: application/x-www-form-urlencoded' \
        --data-urlencode "client_id=$CLIENT_ID" \
        "$DEVICE_URL"
    } || true
  )
fi

if [ "$device_code_request_status" != "200" ]; then
  device_error=$(jq -r '.error_description // .error // .message // empty' "$device_response_file" 2>/dev/null || true)
  if [ -n "$device_error" ]; then
    fail "device-code request failed (HTTP $device_code_request_status): $device_error"
  fi
  fail "device-code request failed (HTTP $device_code_request_status)"
fi

DEVICE_CODE=$(jq -r '.device_code // empty' "$device_response_file")
USER_CODE=$(jq -r '.user_code // empty' "$device_response_file")
VERIFICATION_URI=$(jq -r '.verification_uri // empty' "$device_response_file")
VERIFICATION_URI_COMPLETE=$(jq -r '.verification_uri_complete // empty' "$device_response_file")
DEVICE_EXPIRES_IN=$(jq -r '.expires_in // 900' "$device_response_file")
DEVICE_INTERVAL=$(jq -r '.interval // 5' "$device_response_file")

[ -n "$DEVICE_CODE" ] || fail "device_code missing in device authorization response"
[ -n "$USER_CODE" ] || fail "user_code missing in device authorization response"
[ -n "$VERIFICATION_URI" ] || fail "verification_uri missing in device authorization response"

if [ "$POLL_INTERVAL_SECONDS" -lt "$DEVICE_INTERVAL" ]; then
  POLL_INTERVAL_SECONDS="$DEVICE_INTERVAL"
fi
if [ "$MAX_WAIT_SECONDS" -gt "$DEVICE_EXPIRES_IN" ]; then
  MAX_WAIT_SECONDS="$DEVICE_EXPIRES_IN"
fi

printf '\n'
printf 'GitHub device authorization required\n'
printf '1. Open: %s\n' "$VERIFICATION_URI"
if [ -n "$VERIFICATION_URI_COMPLETE" ] && [ "$VERIFICATION_URI_COMPLETE" != "null" ]; then
  printf '   direct link: %s\n' "$VERIFICATION_URI_COMPLETE"
fi
printf '2. Enter code: %s\n' "$USER_CODE"
printf '3. Approve scopes: %s\n' "$SCOPES"
printf '\n'
printf 'Polling token endpoint every %ss (max wait: %ss)\n' "$POLL_INTERVAL_SECONDS" "$MAX_WAIT_SECONDS"

elapsed=0
while [ "$elapsed" -lt "$MAX_WAIT_SECONDS" ]; do
  curl -fsS \
    --connect-timeout 30 \
    --max-time 30 \
    -X POST \
    -H 'Accept: application/json' \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    --data-urlencode "client_id=$CLIENT_ID" \
    --data-urlencode "client_secret=$CLIENT_SECRET" \
    --data-urlencode "device_code=$DEVICE_CODE" \
    --data-urlencode 'grant_type=urn:ietf:params:oauth:grant-type:device_code' \
    "$TOKEN_URL" >"$token_response_file" || fail "token polling request failed"

  ACCESS_TOKEN=$(jq -r '.access_token // empty' "$token_response_file")
  TOKEN_ERROR=$(jq -r '.error // empty' "$token_response_file")
  POLL_INTERVAL_OVERRIDE=$(jq -r '.interval // empty' "$token_response_file")

  if [ -n "$ACCESS_TOKEN" ]; then
    TOKEN_SCOPE=$(jq -r '.scope // empty' "$token_response_file")
    printf 'device flow completed\n'
    printf 'granted scopes: %s\n' "$TOKEN_SCOPE"
    if [ -n "$TOKEN_OUTPUT_FILE" ]; then
      printf '%s' "$ACCESS_TOKEN" >"$TOKEN_OUTPUT_FILE"
      printf 'token written to %s\n' "$TOKEN_OUTPUT_FILE"
    else
      printf 'export GITRANK_REPO_ADMIN_TOKEN=%s\n' "$ACCESS_TOKEN"
    fi
    exit 0
  fi

  case "$TOKEN_ERROR" in
    authorization_pending|"")
      :
      ;;
    slow_down)
      POLL_INTERVAL_SECONDS=$((POLL_INTERVAL_SECONDS + 5))
      ;;
    access_denied)
      fail "authorization denied by user"
      ;;
    expired_token)
      fail "device code expired before authorization completed"
      ;;
    *)
      fail "unexpected token error: $TOKEN_ERROR"
      ;;
  esac

  if [ -n "$POLL_INTERVAL_OVERRIDE" ] && [ "$POLL_INTERVAL_OVERRIDE" != "null" ]; then
    POLL_INTERVAL_SECONDS="$POLL_INTERVAL_OVERRIDE"
  fi

  sleep "$POLL_INTERVAL_SECONDS"
  elapsed=$((elapsed + POLL_INTERVAL_SECONDS))
done

fail "timed out waiting for device authorization"
