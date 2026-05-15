#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "missing required command: $1" >&2
    exit 1
  fi
}

require_cmd git
require_cmd npm
require_cmd rg

if [[ -n "${VAISC:-}" ]]; then
  if [[ ! -x "$VAISC" ]]; then
    echo "VAISC is set but is not executable: $VAISC" >&2
    exit 1
  fi
  echo "using VAISC=$VAISC"
  exit 0
fi

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
    echo "found vaisc under $dir"
    exit 0
  fi
done

if command -v vaisc >/dev/null 2>&1; then
  echo "found vaisc on PATH"
  exit 0
fi

echo "vaisc binary not found." >&2
echo "Set VAISC, set VAIS_COMPILER_DIR, or build the compiler with:" >&2
echo "  cd /path/to/vais/compiler && cargo build --release -p vaisc" >&2
exit 1
