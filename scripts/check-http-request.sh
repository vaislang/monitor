#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="$ROOT_DIR/server/src/http_request.vais"
OUT_DIR="${MONITOR_OUT_DIR:-${TMPDIR:-/tmp}/vais-monitor-http-request}"
IR_FILE="$OUT_DIR/http_request.ll"
BIN_FILE="$OUT_DIR/http_request"
LOG_FILE="$OUT_DIR/http_request.vaisc.log"
CLANG_LOG="$OUT_DIR/http_request.clang.log"
RELEASE_COMPILER="/Users/sswoo/study/projects/vais/compiler/target/release/vaisc"
DEBUG_COMPILER="/Users/sswoo/study/projects/vais/compiler/target/debug/vaisc"
COMPILER_DIR=""

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
      COMPILER_DIR="$dir"
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

if [[ -z "$COMPILER_DIR" ]]; then
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
    if [[ -f "$dir/std/http_runtime.c" ]]; then
      COMPILER_DIR="$dir"
      break
    fi
  done
fi

if [[ ! -f "$COMPILER_DIR/std/http_runtime.c" ]]; then
  echo "std/http_runtime.c not found. Set VAIS_COMPILER_DIR to the compiler checkout." >&2
  exit 1
fi

if ! command -v clang >/dev/null 2>&1; then
  echo "missing required command: clang" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

if ! "$VAISC" "$SOURCE" --emit-ir -o "$IR_FILE" --no-update-check >"$LOG_FILE" 2>&1; then
  cat "$LOG_FILE" >&2
  exit 1
fi

cat "$LOG_FILE"
test -s "$IR_FILE"

if ! clang "$IR_FILE" "$COMPILER_DIR/std/http_runtime.c" -o "$BIN_FILE" >"$CLANG_LOG" 2>&1; then
  cat "$CLANG_LOG" >&2
  exit 1
fi

test -x "$BIN_FILE"
"$BIN_FILE"
echo "HTTP request fixture passed: $BIN_FILE"
