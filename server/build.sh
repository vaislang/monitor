#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="$ROOT_DIR/server/src/main.vais"
OUT_DIR="${MONITOR_OUT_DIR:-${TMPDIR:-/tmp}/vais-monitor}"
OUT_FILE="$OUT_DIR/monitor.ll"
LOG_FILE="$OUT_DIR/monitor.vaisc.log"
OBJ_FILE="$OUT_DIR/monitor.o"
CLANG_LOG="$OUT_DIR/monitor.clang.log"
RELEASE_COMPILER="/Users/sswoo/study/projects/vais/compiler/target/release/vaisc"
DEBUG_COMPILER="/Users/sswoo/study/projects/vais/compiler/target/debug/vaisc"

if [[ -n "${VAISC:-}" ]]; then
  VAISC="$VAISC"
else
  candidate_compiler_dirs=()
  if [[ -n "${VAIS_COMPILER_DIR:-}" ]]; then
    candidate_compiler_dirs+=("$VAIS_COMPILER_DIR")
  fi
  candidate_compiler_dirs+=(
    "$ROOT_DIR/../../vais/compiler"
    "$ROOT_DIR/../vais/compiler"
    "/Users/sswoo/study/projects/vais/compiler"
  )

  for dir in "${candidate_compiler_dirs[@]}"; do
    if [[ -x "$dir/target/release/vaisc" || -x "$dir/target/debug/vaisc" ]]; then
      RELEASE_COMPILER="$dir/target/release/vaisc"
      DEBUG_COMPILER="$dir/target/debug/vaisc"
      break
    fi
  done
fi

if [[ -x "${VAISC:-}" ]]; then
  :
elif [[ -x "$RELEASE_COMPILER" && -x "$DEBUG_COMPILER" && "$DEBUG_COMPILER" -nt "$RELEASE_COMPILER" ]]; then
  VAISC="$DEBUG_COMPILER"
elif [[ -x "$RELEASE_COMPILER" ]]; then
  VAISC="$RELEASE_COMPILER"
elif [[ -x "$DEBUG_COMPILER" ]]; then
  VAISC="$DEBUG_COMPILER"
elif command -v vaisc >/dev/null 2>&1; then
  VAISC="$(command -v vaisc)"
else
  echo "vaisc not found. Build the compiler first." >&2
  echo "Set VAISC or VAIS_COMPILER_DIR if the compiler is outside the default workspace." >&2
  exit 1
fi

MODE="${1:---ir-only}"
mkdir -p "$OUT_DIR"

case "$MODE" in
  --ir-only)
    if ! "$VAISC" "$SOURCE" --emit-ir -o "$OUT_FILE" --no-update-check >"$LOG_FILE" 2>&1; then
      cat "$LOG_FILE" >&2
      exit 1
    fi
    cat "$LOG_FILE"
    test -s "$OUT_FILE"
    grep -q '^%Option = type { i32,' "$OUT_FILE"
    grep -q '^%Result = type { i32,' "$OUT_FILE"
    if grep -q '{ i8, i64 }' "$OUT_FILE"; then
      echo "anonymous i8 enum layout found; expected canonical i32 tag layout" >&2
      exit 1
    fi
    if command -v clang >/dev/null 2>&1; then
      if ! clang -c "$OUT_FILE" -o "$OBJ_FILE" >"$CLANG_LOG" 2>&1; then
        cat "$CLANG_LOG" >&2
        exit 1
      fi
      rm -f "$OBJ_FILE"
    fi
    echo "IR emitted: $OUT_FILE"
    ;;
  *)
    echo "Usage: ./build.sh --ir-only" >&2
    exit 2
    ;;
esac
