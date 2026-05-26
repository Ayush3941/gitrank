#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

fail() {
  printf 'repo-sync check failed: %s\n' "$1" >&2
  exit 1
}

contains_generated_runtime_artifacts() {
  local matches
  matches="$(cd "$ROOT_DIR" && git ls-files | rg '(^|/)(\.tmp|\.run|\.logs)/|\.pid$|\.log$|\.test$|coverage\.out$|\.tsbuildinfo$' || true)"
  if [[ -n "$matches" ]]; then
    printf '%s\n' "$matches"
    return 0
  fi
  return 1
}

check_markdown_relative_links() {
  local missing=0
  local file dir token target clean resolved
  while IFS= read -r file; do
    dir="$(dirname "$file")"
    while IFS= read -r token; do
      target="$token"
      target="${target#<}"
      target="${target%>}"
      target="${target%%#*}"
      target="${target%%\?*}"
      target="$(printf '%s' "$target" | sed 's/[[:space:]]*$//')"

      [[ -z "$target" ]] && continue
      [[ "$target" =~ ^(https?:|mailto:|tel:|data:) ]] && continue
      [[ "$target" =~ ^# ]] && continue

      if [[ "$target" == /* ]]; then
        resolved="$ROOT_DIR$target"
      else
        resolved="$ROOT_DIR/$dir/$target"
      fi

      if [[ ! -e "$resolved" ]]; then
        printf 'broken markdown relative link: %s -> %s\n' "$file" "$token" >&2
        missing=1
      fi
    done < <(
      cd "$ROOT_DIR" && rg -o '\[[^]]+\]\([^)]*\)|!\[[^]]*\]\([^)]*\)' "$file" \
        | sed -E 's/^[^[]*\[[^]]*\]\(([^)]*)\)$/\1/' \
        | sed -E 's/^([^ ]+).*/\1/'
    )
  done < <(cd "$ROOT_DIR" && git ls-files '*.md')

  if [[ "$missing" -ne 0 ]]; then
    return 1
  fi
  return 0
}

ensure_repo_tree_in_sync() {
  "$ROOT_DIR/scripts/generate-repo-tree.sh" >/dev/null
  if ! (cd "$ROOT_DIR" && git diff --quiet -- docs/REPO_TREE.md); then
    fail "docs/REPO_TREE.md is stale; run ./scripts/generate-repo-tree.sh"
  fi
}

assert_no_stale_pdf_references() {
  if (
    cd "$ROOT_DIR" && rg -n 'gitrank_research \.pdf' --hidden \
      --glob '!.git/*' \
      --glob '!.tmp/*' \
      --glob '!.run/*' \
      --glob '!.logs/*' \
      --glob '!frontend/node_modules/*' \
      --glob '!frontend/.next/*' \
      --glob '!gitrank/docs/releases/*actual.md' \
      --glob '!scripts/check-repo-sync.sh' >/dev/null
  ); then
    fail "stale reference to 'gitrank_research .pdf' found"
  fi
}

assert_clean_root_binary_clutter() {
  local pdfs
  pdfs="$(find "$ROOT_DIR" -maxdepth 1 -type f -name '*.pdf' -print || true)"
  if [[ -n "$pdfs" ]]; then
    printf '%s\n' "$pdfs" >&2
    fail "root directory contains PDFs; move local references under docs/research/"
  fi
}

main() {
  if contains_generated_runtime_artifacts; then
    fail "tracked generated/runtime artifacts found (logs/pids/test binaries)"
  fi

  assert_no_stale_pdf_references
  assert_clean_root_binary_clutter
  ensure_repo_tree_in_sync

  if ! check_markdown_relative_links; then
    fail "broken markdown relative links detected"
  fi

  printf 'repo-sync check passed\n'
}

main "$@"
