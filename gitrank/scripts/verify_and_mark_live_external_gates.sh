#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
WORKSPACE_ROOT=$(CDPATH= cd -- "$REPO_ROOT/.." && pwd)
CONTRIBUTING_FILE="${CONTRIBUTING_FILE:-$WORKSPACE_ROOT/CONTRIBUTING.md}"
TMP_ROOT="${TMPDIR:-/tmp}"

fail() {
  printf 'verify and mark live external gates failed: %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"
}

[ -f "$CONTRIBUTING_FILE" ] || fail "CONTRIBUTING.md not found at $CONTRIBUTING_FILE"
require_command awk
require_command cmp
require_command cp
require_command mktemp
mkdir -p "$TMP_ROOT"

printf 'running live GitHub repository controls verification...\n'
(
  cd "$REPO_ROOT"
  make verify-github-repository-controls
)

printf 'running live observability verification...\n'
(
  cd "$REPO_ROOT"
  make verify-live-observability
)

tmp_file=$(mktemp "$TMP_ROOT/gitrank-contributing-live-gates.XXXXXX")
trap 'rm -f "$tmp_file"' EXIT
cp "$CONTRIBUTING_FILE" "$tmp_file"

awk '
{
  line = $0
  if (line ~ /^- \[ \] /) {
    if (line ~ /enable dependency graph/) sub(/^- \[ \]/, "- [x]", line)
    if (line ~ /enable Dependabot alerts/) sub(/^- \[ \]/, "- [x]", line)
    if (line ~ /protect the default branch or apply repository rulesets/) sub(/^- \[ \]/, "- [x]", line)
    if (line ~ /require pull request review before merge/) sub(/^- \[ \]/, "- [x]", line)
    if (line ~ /require status checks before merge/) sub(/^- \[ \]/, "- [x]", line)
    if (line ~ /enforce required checks before merge/) sub(/^- \[ \]/, "- [x]", line)
    if (line ~ /prevent direct pushes to protected branches/) sub(/^- \[ \]/, "- [x]", line)
    if (line ~ /default branch protections or rulesets are enforced/) sub(/^- \[ \]/, "- [x]", line)
    if (line ~ /Deploy and verify production observability against real traffic/) sub(/^- \[ \]/, "- [x]", line)
    if (line ~ /Apply and verify live GitHub repository controls before V2 release branches are cut/) sub(/^- \[ \]/, "- [x]", line)
  }
  print line
}
' "$tmp_file" >"$tmp_file.next"
mv "$tmp_file.next" "$tmp_file"

if cmp -s "$CONTRIBUTING_FILE" "$tmp_file"; then
  printf 'no checklist updates were needed in CONTRIBUTING.md\n'
  exit 0
fi

cp "$tmp_file" "$CONTRIBUTING_FILE"
printf 'updated CONTRIBUTING.md live external gate checkboxes after successful verifier run\n'
