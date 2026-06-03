#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_PACKAGE_JSON="$ROOT_DIR/frontend/package.json"

fail() {
  printf 'workflow frontend npm script check failed: %s\n' "$1" >&2
  exit 1
}

[[ -f "$FRONTEND_PACKAGE_JSON" ]] || fail "missing frontend/package.json"

if ! command -v rg >/dev/null 2>&1; then
  fail "rg is required"
fi
if ! command -v node >/dev/null 2>&1; then
  fail "node is required"
fi
if ! command -v sed >/dev/null 2>&1; then
  fail "sed is required"
fi

frontend_scripts="$(
  node -e '
    const pkg = require(process.argv[1]);
    for (const key of Object.keys(pkg.scripts || {})) {
      console.log(key);
    }
  ' "$FRONTEND_PACKAGE_JSON"
)"

missing=0
while IFS= read -r match; do
  [[ -z "$match" ]] && continue

  script_name="$(
    printf '%s' "$match" \
      | sed -E 's/.*npm run ([A-Za-z0-9:_-]+).*/\1/'
  )"
  [[ -n "$script_name" ]] || continue

  if ! rg -qx -- "$script_name" <<<"$frontend_scripts"; then
    printf 'unknown frontend npm script referenced in workflow: %s\n' "$match" >&2
    missing=1
  fi
done < <(
  cd "$ROOT_DIR" && rg -n -o 'npm run [A-Za-z0-9:_-]+' .github/workflows --glob '*.yml' --glob '*.yaml' | sort -u
)

if [[ "$missing" -ne 0 ]]; then
  fail "workflow frontend npm scripts are out of sync with frontend/package.json"
fi

printf 'workflow frontend npm script check passed\n'
