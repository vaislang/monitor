#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REV="${1:-HEAD}"

if [[ "$REV" == "HEAD" ]]; then
  if ! git -C "$ROOT_DIR" diff --quiet || ! git -C "$ROOT_DIR" diff --cached --quiet; then
    echo "clean-checkout gate requires a clean working tree for HEAD." >&2
    echo "commit or stash local changes, or pass an explicit committed revision." >&2
    exit 1
  fi
fi

TMP_PARENT="${TMPDIR:-/tmp}/vais-monitor-clean-checkout"
mkdir -p "$TMP_PARENT"
WORKTREE="$(mktemp -d "$TMP_PARENT/worktree.XXXXXX")"
rm -rf "$WORKTREE"

cleanup() {
  git -C "$ROOT_DIR" worktree remove --force "$WORKTREE" >/dev/null 2>&1 || rm -rf "$WORKTREE"
}
trap cleanup EXIT

git -C "$ROOT_DIR" worktree add --detach "$WORKTREE" "$REV" >/dev/null
"$WORKTREE/scripts/check-reference-gates.sh"

echo "clean checkout reference gates passed: $REV"
