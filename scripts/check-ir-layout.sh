#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${TMPDIR:-/tmp}/vais-monitor-ir-layout"
IR_FILE="$OUT_DIR/monitor.ll"

MONITOR_OUT_DIR="$OUT_DIR" "$ROOT_DIR/server/build.sh" --ir-only

grep -q '^define { i32, { i64 } } @seed_title_len' "$IR_FILE"
grep -q '^define { i32, { i64 } } @validate_title_len' "$IR_FILE"
grep -q '^define { i32, { i64 } } @summarize' "$IR_FILE"
grep -q '^define { i32, { i64 } } @find_summary_score' "$IR_FILE"

if grep -Eq '^define \{ i8, i64 \} @(seed_title_len|validate_title_len|summarize|find_summary_score)\b' "$IR_FILE"; then
  echo "generic Option/Result i8 enum layout found; expected canonical i32 tag layout" >&2
  exit 1
fi

echo "IR layout fixture passed: $IR_FILE"
