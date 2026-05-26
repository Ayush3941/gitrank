#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

fail() {
  printf 'gitrank script discoverability check failed: %s\n' "$1" >&2
  exit 1
}

if ! command -v rg >/dev/null 2>&1; then
  fail "rg is required"
fi
if ! command -v sed >/dev/null 2>&1; then
  fail "sed is required"
fi
if ! command -v git >/dev/null 2>&1; then
  fail "git is required"
fi

mapfile -t tracked_scripts < <(cd "$ROOT_DIR" && git ls-files 'gitrank/scripts/*.sh' | sort)
if [[ "${#tracked_scripts[@]}" -eq 0 ]]; then
  fail "no tracked gitrank/scripts/*.sh files found"
fi

normalize_ref() {
  local ref="${1:-}"
  ref="${ref#./}"
  ref="${ref#gitrank/}"
  printf '%s\n' "$ref"
}

extract_refs_from_files() {
  local file
  for file in "$@"; do
    [[ -f "$ROOT_DIR/$file" ]] || continue
    rg -o --no-filename --no-line-number \
      '(?:\./)?(?:gitrank/)?scripts/[A-Za-z0-9._/-]+\.sh' \
      "$ROOT_DIR/$file" || true
  done \
    | sed -E 's#^\./##' \
    | sed -E 's#^gitrank/##' \
    | sort -u
}

declare -A tracked_map=()
for script_path in "${tracked_scripts[@]}"; do
  normalized="$(normalize_ref "${script_path}")"
  tracked_map["$normalized"]=1
done

mapfile -t root_files < <(
  cd "$ROOT_DIR" && {
    printf '%s\n' "gitrank/Makefile" "start.sh"
    git ls-files '.github/workflows/*.yml' '.github/workflows/*.yaml' 'gitrank/deployments/docker/*Dockerfile'
  } | awk 'NF' | sort -u
)

declare -A reachable=()
queue=()

while IFS= read -r ref; do
  [[ -z "$ref" ]] && continue
  if [[ -n "${tracked_map[$ref]+1}" && -z "${reachable[$ref]+1}" ]]; then
    reachable["$ref"]=1
    queue+=("$ref")
  fi
done < <(extract_refs_from_files "${root_files[@]}")

if [[ "${#queue[@]}" -eq 0 ]]; then
  fail "no gitrank scripts are reachable from root entrypoints"
fi

for ((i = 0; i < ${#queue[@]}; i++)); do
  current="${queue[$i]}"
  source_file="gitrank/$current"
  while IFS= read -r next_ref; do
    [[ -z "$next_ref" ]] && continue
    if [[ -n "${tracked_map[$next_ref]+1}" && -z "${reachable[$next_ref]+1}" ]]; then
      reachable["$next_ref"]=1
      queue+=("$next_ref")
    fi
  done < <(extract_refs_from_files "$source_file")
done

missing=0
for script_path in "${tracked_scripts[@]}"; do
  normalized="$(normalize_ref "$script_path")"
  if [[ -z "${reachable[$normalized]+1}" ]]; then
    printf 'unreachable gitrank script (no entrypoint path): %s\n' "$script_path" >&2
    missing=1
  fi
done

if [[ "$missing" -ne 0 ]]; then
  fail "one or more gitrank scripts are not discoverable from entrypoints"
fi

printf 'gitrank script discoverability check passed\n'
