#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PATTERN='\b(server_listen[A-Za-z0-9_]*|db_[A-Za-z0-9_]+|ws_[A-Za-z0-9_]+)\b'

if command -v rg >/dev/null 2>&1; then
  MATCHES="$(rg -n "$PATTERN" "$ROOT_DIR/server/src" "$ROOT_DIR/playground" || true)"
else
  MATCHES="$(grep -RInE '(server_listen[A-Za-z0-9_]*|db_[A-Za-z0-9_]+|ws_[A-Za-z0-9_]+)' "$ROOT_DIR/server/src" "$ROOT_DIR/playground" || true)"
fi

if [[ -n "$MATCHES" ]]; then
  printf '%s\n' "$MATCHES"
  echo "uncertified runtime symbol found in reference app source" >&2
  echo "HTTP/DB/WS calls require named runtime gates before use here." >&2
  exit 1
fi

echo "runtime boundary fixture passed"
