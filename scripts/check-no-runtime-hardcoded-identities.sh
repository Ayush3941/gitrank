#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

fail() {
  printf 'runtime hardcoded identity check failed: %s\n' "$1" >&2
  exit 1
}

if ! command -v rg >/dev/null 2>&1; then
  fail "rg is required"
fi

violations="$(
  cd "$ROOT_DIR" && rg -n -i \
    -e 'ayush3941' \
    -e 'ayush[[:space:]_-]+kumar[[:space:]_-]+gaur' \
    -e 'octocat' \
    gitrank/services gitrank/packages \
    --glob '**/*.go' \
    --glob '!**/*_test.go' \
    --glob '!**/*_integration_test.go' \
    --glob '!**/testdata/**' \
    --glob '!**/docs/**' || true
)"

if [[ -n "$violations" ]]; then
  printf '%s\n' "$violations" >&2
  fail "production Go runtime code must not contain personal/demo identities"
fi

printf 'runtime hardcoded identity check passed\n'
