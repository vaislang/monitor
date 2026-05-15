#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PATTERN='\b(server_listen[A-Za-z0-9_]*|db_[A-Za-z0-9_]+|ws_[A-Za-z0-9_]+)\b'

if rg -n "$PATTERN" "$ROOT_DIR/server/src" "$ROOT_DIR/playground"; then
  echo "uncertified runtime symbol found in reference app source" >&2
  echo "HTTP/DB/WS calls require named runtime gates before use here." >&2
  exit 1
fi

echo "runtime boundary fixture passed"
