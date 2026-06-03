#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

fail() {
  printf 'frontend CI/repo-sync parity check failed: %s\n' "$1" >&2
  exit 1
}

if ! command -v node >/dev/null 2>&1; then
  fail "node is required"
fi

node "$ROOT_DIR/scripts/lib/check-frontend-ci-repo-sync-parity.mjs" "$ROOT_DIR"
