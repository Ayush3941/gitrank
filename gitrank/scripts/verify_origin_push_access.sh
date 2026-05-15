#!/usr/bin/env sh
set -eu

REPO_DIR="${REPO_DIR:-}"
REMOTE_NAME="${REMOTE_NAME:-origin}"
TARGET_BRANCH="${TARGET_BRANCH:-}"

fail() {
  printf 'origin push access verification failed: %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"
}

resolve_repo_dir() {
  [ -n "$REPO_DIR" ] && return 0
  REPO_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
}

resolve_target_branch() {
  [ -n "$TARGET_BRANCH" ] && return 0
  remote_head_ref=$(git -C "$REPO_DIR" symbolic-ref -q --short "refs/remotes/$REMOTE_NAME/HEAD" 2>/dev/null || true)
  case "$remote_head_ref" in
    "$REMOTE_NAME"/*) TARGET_BRANCH=${remote_head_ref#"$REMOTE_NAME"/} ;;
  esac
  [ -n "$TARGET_BRANCH" ] || TARGET_BRANCH=main
}

resolve_repo_dir
require_command git

git -C "$REPO_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "REPO_DIR is not a git work tree: $REPO_DIR"
git -C "$REPO_DIR" remote get-url "$REMOTE_NAME" >/dev/null 2>&1 || fail "remote '$REMOTE_NAME' is not configured"

resolve_target_branch

tmpdir_root="${TMPDIR:-/tmp}"
mkdir -p "$tmpdir_root"

push_output_file=$(mktemp "$tmpdir_root/gitrank-origin-push-access.XXXXXX")
if git -C "$REPO_DIR" push --dry-run "$REMOTE_NAME" "HEAD:refs/heads/$TARGET_BRANCH" >"$push_output_file" 2>&1; then
  printf 'origin push access verification passed\n'
  printf 'remote: %s\n' "$REMOTE_NAME"
  printf 'target_branch: %s\n' "$TARGET_BRANCH"
  rm -f "$push_output_file"
  exit 0
fi

push_output=$(cat "$push_output_file" 2>/dev/null || true)
rm -f "$push_output_file"

case "$push_output" in
  *"could not read Username for 'https://github.com'"*)
    fail "missing HTTPS git credentials for remote '$REMOTE_NAME'; configure a credential helper or PAT-backed remote and retry"
    ;;
  *"Permission denied (publickey)"*)
    fail "SSH authentication failed for remote '$REMOTE_NAME'; configure an SSH key with repository write access or use HTTPS credentials"
    ;;
  *"Authentication failed"*|*"auth failed"*|*"fatal: could not authenticate"*)
    fail "authentication failed for remote '$REMOTE_NAME'; ensure token/credentials have repository write access"
    ;;
  *"remote: error: GH006: Protected branch update failed"*|*"protected branch hook declined"*)
    fail "remote '$TARGET_BRANCH' rejected push due to protection/rulesets; use PR flow or update branch policies as intended"
    ;;
  *"remote rejected"*|*"pre-receive hook declined"*)
    fail "remote rejected dry-run push to '$TARGET_BRANCH'; inspect branch policies and required checks"
    ;;
  *)
    last_line=$(printf '%s' "$push_output" | tail -n 1)
    if [ -z "$last_line" ]; then
      last_line="no stderr/stdout captured"
    fi
    fail "dry-run push to '$REMOTE_NAME/$TARGET_BRANCH' failed: $last_line"
    ;;
esac
