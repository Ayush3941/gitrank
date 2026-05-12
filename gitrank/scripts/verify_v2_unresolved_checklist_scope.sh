#!/usr/bin/env sh
set -eu

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
repo_dir="$(CDPATH= cd -- "$root_dir/.." && pwd)"
contributing_file="${CONTRIBUTING_FILE:-$repo_dir/CONTRIBUTING.md}"

fail() {
  printf 'v2 unresolved checklist scope verification failed: %s\n' "$1" >&2
  exit 1
}

[ -s "$contributing_file" ] || fail "missing CONTRIBUTING.md at $contributing_file"

unchecked_file="$(mktemp "${TMPDIR:-/tmp}/gitrank-v2-unchecked-scope.XXXXXX")"
unexpected_file="$(mktemp "${TMPDIR:-/tmp}/gitrank-v2-unexpected-unchecked.XXXXXX")"
trap 'rm -f "$unchecked_file" "$unexpected_file"' EXIT

rg -n "\\[ \\]" "$contributing_file" >"$unchecked_file" || true
unchecked_count=$(wc -l <"$unchecked_file" | tr -d ' ')

if [ "$unchecked_count" -eq 0 ]; then
  printf 'v2 unresolved checklist scope verification passed: no unchecked items remain\n'
  exit 0
fi

is_allowed_unchecked_item() {
  line_text=$1
  case "$line_text" in
    *"Production observability exists."*|\
    *"enable dependency graph"*|\
    *"enable Dependabot alerts"*|\
    *"protect the default branch or apply repository rulesets"*|\
    *"require pull request review before merge"*|\
    *"require status checks before merge"*|\
    *"enforce required checks before merge"*|\
    *"prevent direct pushes to protected branches"*|\
    *"default branch protections or rulesets are enforced"*|\
    *"rollback procedures are documented and tested"*|\
    *"Deploy and verify production observability against real traffic"*|\
    *"Apply and verify live GitHub repository controls before V2 release branches are cut."*|\
    *"Run and record staging rollback and restore drills."*|\
    *"Replace provider-neutral Kubernetes placeholders with environment-specific secrets, TLS, ingress, managed PostgreSQL, managed Redis, registry, and environment-tuned autoscaling thresholds."*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

while IFS= read -r line; do
  [ -n "$line" ] || continue
  line_number=${line%%:*}
  text=${line#*:}
  if ! is_allowed_unchecked_item "$text"; then
    printf '%s:%s\n' "$line_number" "$text" >>"$unexpected_file"
  fi
done <"$unchecked_file"

unexpected_count=$(wc -l <"$unexpected_file" | tr -d ' ')
if [ "$unexpected_count" -gt 0 ]; then
  printf 'unexpected unchecked checklist items:\n' >&2
  cat "$unexpected_file" >&2
  fail "found unchecked items outside approved live-gate scope"
fi

printf 'v2 unresolved checklist scope verification passed\n'
printf 'unchecked items in approved live-gate scope: %s\n' "$unchecked_count"
