#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

mkdir -p "$ROOT_DIR/playground"
cp "$ROOT_DIR/server/src/main.vais" "$ROOT_DIR/playground/monitor.vais"

echo "synced playground/monitor.vais from server/src/main.vais"
