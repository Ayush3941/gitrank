#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
LIVE_ENV_FILE="${LIVE_V2_ENV_FILE:-${FINALIZE_V2_ENV_FILE:-.env.v2-live-gates.local}}"

fail() {
  printf 'finalize-v2 oauth bootstrap failed: %s\n' "$1" >&2
  exit 1
}

RESOLVED_ENV_FILE="$LIVE_ENV_FILE"
case "$RESOLVED_ENV_FILE" in
  /*) ;;
  *) RESOLVED_ENV_FILE="$ROOT_DIR/$RESOLVED_ENV_FILE" ;;
esac

if [ ! -f "$RESOLVED_ENV_FILE" ]; then
  fail "missing env file: $RESOLVED_ENV_FILE (run make scaffold-v2-live-env first)"
fi

printf 'Step 1/2: run live closeout with OAuth web-flow token bootstrap\n'
(
  cd "$ROOT_DIR"
  CONFIRM_FINALIZE_V2=yes \
  FINALIZE_V2_ENV_FILE="$RESOLVED_ENV_FILE" \
  AUTO_CREATE_GITHUB_OAUTH_WEB_TOKEN=true \
  make finalize-v2-live-closeout
)

printf 'Step 2/2: verify unresolved checklist items\n'
(
  cd "$ROOT_DIR/.."
  remaining="$(rg -n "^- \[ \]" CONTRIBUTING.md || true)"
  if [ -n "$remaining" ]; then
    printf '%s\n' "$remaining"
    fail "checklist still has unresolved items"
  fi
)

printf 'finalize-v2 oauth bootstrap flow completed\n'
printf 'env file used: %s\n' "$RESOLVED_ENV_FILE"
