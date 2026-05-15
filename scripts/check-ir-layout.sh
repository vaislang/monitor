#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${TMPDIR:-/tmp}/vais-monitor-ir-layout"
IR_FILE="$OUT_DIR/monitor.ll"

MONITOR_OUT_DIR="$OUT_DIR" "$ROOT_DIR/server/build.sh" --ir-only

grep -q '^%Option = type { i32, { i64 } }' "$IR_FILE"
grep -q '^%Result = type { i32, { i64 } }' "$IR_FILE"
grep -q '^define %Option @seed_title_len' "$IR_FILE"
grep -q '^define %Result @validate_title_len' "$IR_FILE"
grep -q '^define %Result @find_summary_score' "$IR_FILE"

if grep -q '{ i8, i64 }' "$IR_FILE"; then
  echo "anonymous enum literal layout found; expected canonical i32 tag layout" >&2
  exit 1
fi

echo "IR layout fixture passed: $IR_FILE"
