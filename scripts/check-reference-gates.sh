#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

"$ROOT_DIR/scripts/check-ir-layout.sh"
"$ROOT_DIR/scripts/check-runtime-boundary.sh"

if ! cmp -s "$ROOT_DIR/server/src/main.vais" "$ROOT_DIR/playground/monitor.vais"; then
  echo "playground/monitor.vais is out of sync with server/src/main.vais" >&2
  echo "run: scripts/sync-playground-example.sh" >&2
  exit 1
fi

(
  cd "$ROOT_DIR/web"
  npm ci
  npm run build
)

echo "monitor reference gates passed"
