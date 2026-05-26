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

assert_script_entrypoint_hygiene() {
  local failed=0
  local file first_line
  while IFS= read -r file; do
    [[ -z "$file" ]] && continue

    if [[ ! -x "$ROOT_DIR/$file" ]]; then
      printf 'script is not executable: %s\n' "$file" >&2
      failed=1
    fi

    first_line="$(head -n 1 "$ROOT_DIR/$file" || true)"
    if [[ ! "$first_line" =~ ^#!(/usr/bin/env[[:space:]]+(sh|bash)|/bin/(sh|bash))$ ]]; then
      printf 'script missing normalized shebang: %s (%s)\n' "$file" "$first_line" >&2
      failed=1
    fi
  done < <(cd "$ROOT_DIR" && git ls-files 'scripts/*.sh' 'gitrank/scripts/*.sh' 'start.sh')

  if [[ "$failed" -ne 0 ]]; then
    fail "script entrypoint hygiene failed"
  fi
}

assert_large_tracked_file_budget() {
  local limit_bytes=$((5 * 1024 * 1024))
  local failed=0
  local file size
  while IFS= read -r file; do
    if [[ ! -f "$ROOT_DIR/$file" ]]; then
      continue
    fi
    size="$(wc -c <"$ROOT_DIR/$file")"
    if [[ "$size" -gt "$limit_bytes" ]]; then
      printf 'tracked file exceeds size budget (%s bytes): %s\n' "$size" "$file" >&2
      failed=1
    fi
  done < <(cd "$ROOT_DIR" && git ls-files)

  if [[ "$failed" -ne 0 ]]; then
    fail "tracked file size budget exceeded (5MB)"
  fi
}

assert_frontend_background_asset_layout() {
  local legacy_dupes=(
    "frontend/public/background.jpg"
    "frontend/public/background.webp"
  )
  local required_assets=(
    "frontend/public/assets/background.jpg"
    "frontend/public/assets/background.webp"
  )
  local path

  for path in "${legacy_dupes[@]}"; do
    if (cd "$ROOT_DIR" && git ls-files --error-unmatch "$path" >/dev/null 2>&1); then
      fail "legacy background duplicate is tracked: $path"
    fi
  done

  for path in "${required_assets[@]}"; do
    if [[ ! -f "$ROOT_DIR/$path" ]]; then
      fail "required frontend background asset missing: $path"
    fi
  done
}

assert_no_placeholder_public_assets() {
  local placeholder_assets=(
    "frontend/public/file.svg"
    "frontend/public/globe.svg"
    "frontend/public/next.svg"
    "frontend/public/vercel.svg"
    "frontend/public/window.svg"
  )
  local path
  for path in "${placeholder_assets[@]}"; do
    if (cd "$ROOT_DIR" && git ls-files --error-unmatch "$path" >/dev/null 2>&1); then
      fail "placeholder public asset is tracked but unused: $path"
    fi
  done
}

assert_frontend_public_assets_are_referenced() {
  local failed=0
  local asset rel web_ref
  while IFS= read -r asset; do
    rel="${asset#frontend/public/}"
    web_ref="/$rel"

    if ! (
      cd "$ROOT_DIR" && rg -q -F -- "$web_ref" frontend/app frontend/components frontend/features frontend/hooks frontend/lib
    ) && ! (
      cd "$ROOT_DIR" && rg -q -F -- "$rel" frontend/app frontend/components frontend/features frontend/hooks frontend/lib
    ); then
      printf 'frontend public asset appears unreferenced by source: %s\n' "$asset" >&2
      failed=1
    fi
  done < <(cd "$ROOT_DIR" && find frontend/public/assets -type f | sort)

  if [[ "$failed" -ne 0 ]]; then
    fail "frontend public asset reference audit failed"
  fi
}

assert_weekly_evidence_png_deduplicated() {
  local evidence_dir="$ROOT_DIR/frontend/docs/evidence/weekly-2026-05-17"
  [[ -d "$evidence_dir" ]] || return 0

  if ! python - "$evidence_dir" <<'PY'
import hashlib
import pathlib
import sys

evidence_dir = pathlib.Path(sys.argv[1])
pngs = sorted(evidence_dir.glob("*.png"))
groups = {}
for png in pngs:
    digest = hashlib.sha256(png.read_bytes()).hexdigest()
    groups.setdefault(digest, []).append(png.name)

allowed_duplicate_group = {"lighthouse-home-before-final.png", "lighthouse-home-final.png"}
violations = []
for names in groups.values():
    if len(names) < 2:
        continue
    if set(names) == allowed_duplicate_group:
        continue
    violations.append(sorted(names))

if violations:
    for group in violations:
        print("duplicate weekly evidence PNG group:", ", ".join(group), file=sys.stderr)
    sys.exit(1)
PY
  then
    fail "weekly evidence PNG deduplication check failed"
  fi
}

assert_frontend_env_coverage_against_backend_env() {
  if ! (
    cd "$ROOT_DIR/frontend" && node scripts/check-env-example-coverage.mjs ../gitrank/.env.example >/dev/null
  ); then
    fail "frontend env coverage drift against gitrank/.env.example"
  fi
}

assert_frontend_stale_refresh_sync_wiring() {
  if ! (
    cd "$ROOT_DIR/frontend" && node scripts/check-stale-refresh-sync-wiring.mjs >/dev/null
  ); then
    fail "frontend stale refresh actions are not wired to user sync execution"
  fi
}

assert_backend_env_default_parity() {
  if ! (
    cd "$ROOT_DIR/gitrank/packages/config" \
      && go test ./... -run 'TestLoadDefaultsMatchBackendEnvExample|TestLoadDefaultsByServiceAddressKey' -count=1 >/dev/null
  ); then
    fail "backend config defaults are out of sync with gitrank/.env.example"
  fi
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
  local tmp_tree
  tmp_tree="$(mktemp "${TMPDIR:-/tmp}/gitrank-repo-tree.XXXXXX.md")"
  trap 'rm -f "$tmp_tree"' RETURN
  "$ROOT_DIR/scripts/generate-repo-tree.sh" "$tmp_tree" >/dev/null
  if ! cmp -s "$tmp_tree" "$ROOT_DIR/docs/REPO_TREE.md"; then
    fail "docs/REPO_TREE.md is stale; run ./scripts/generate-repo-tree.sh"
  fi
  rm -f "$tmp_tree"
  trap - RETURN
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

assert_markdown_npm_script_refs() {
  if ! "$ROOT_DIR/scripts/check-doc-frontend-npm-scripts.sh" >/dev/null; then
    fail "markdown npm script references drifted from frontend/package.json"
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
  assert_script_entrypoint_hygiene
  assert_large_tracked_file_budget
  assert_frontend_background_asset_layout
  assert_no_placeholder_public_assets
  assert_frontend_public_assets_are_referenced
  assert_weekly_evidence_png_deduplicated
  assert_frontend_env_coverage_against_backend_env
  assert_frontend_stale_refresh_sync_wiring
  assert_markdown_npm_script_refs
  assert_backend_env_default_parity

  if ! check_markdown_relative_links; then
    fail "broken markdown relative links detected"
  fi

  printf 'repo-sync check passed\n'
}

main "$@"
