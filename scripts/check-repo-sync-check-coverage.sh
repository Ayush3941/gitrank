#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_SYNC_SCRIPT="$ROOT_DIR/scripts/check-repo-sync.sh"

fail() {
  printf 'repo-sync check coverage validation failed: %s\n' "$1" >&2
  exit 1
}

if ! command -v git >/dev/null 2>&1; then
  fail "git is required"
fi
if ! command -v rg >/dev/null 2>&1; then
  fail "rg is required"
fi
if ! command -v sed >/dev/null 2>&1; then
  fail "sed is required"
fi
if ! command -v comm >/dev/null 2>&1; then
  fail "comm is required"
fi

[[ -f "$REPO_SYNC_SCRIPT" ]] || fail "missing scripts/check-repo-sync.sh"

expected_tmp="$(mktemp "${TMPDIR:-/tmp}/repo-sync-expected.XXXXXX")"
observed_tmp="$(mktemp "${TMPDIR:-/tmp}/repo-sync-observed.XXXXXX")"
trap 'rm -f "$expected_tmp" "$observed_tmp"' EXIT

cd "$ROOT_DIR"
git ls-files 'scripts/check-*.sh' \
  | sort \
  | rg -v '^scripts/check-repo-sync\.sh$' \
  >"$expected_tmp"

if [[ ! -s "$expected_tmp" ]]; then
  fail "no tracked scripts/check-*.sh coverage targets found"
fi

rg -o --no-filename --no-line-number 'scripts/check-[A-Za-z0-9._/-]+\.sh' "$REPO_SYNC_SCRIPT" \
  | sort -u \
  >"$observed_tmp"

missing="$(comm -23 "$expected_tmp" "$observed_tmp" || true)"
if [[ -n "$missing" ]]; then
  printf 'tracked check script not wired into scripts/check-repo-sync.sh: %s\n' "$missing" >&2
  fail "one or more check scripts are not enforced by repo sync gate"
fi

printf 'repo-sync check coverage validation passed\n'
