#!/bin/bash
# build.sh — monitor-server build harness
#
# Full pipeline: vaisc → clang → link, producing `server/monitor-server`.
#
# History:
#   - iter 13 (vais ROADMAP #6): initial scaffolding; link was expected to
#     fail because monitor_runtime.c did not exist. Step 1.5 (python3) was
#     deliberately omitted because vais ROADMAP #9 fix landed at the same
#     time.
#   - iter 15 (vais ROADMAP Phase 2): monitor_runtime.c (1586 LOC) now
#     implements all 27 C-side symbols (io/socket, sqlite db, random/uuid,
#     crypto+jwt, json). This script was updated to compile it and link
#     with -lcrypto -lm -lsqlite3 so the full pipeline produces a working
#     binary.
#
# Usage:
#   ./build.sh                     # default: full pipeline → binary
#   ./build.sh --ir-only           # stop after .ll emission
#   ./build.sh --objects           # stop after clang -c
#   ./build.sh --link-report       # run full pipeline; on link failure,
#                                  # dump unresolved symbol list and exit 0
#                                  # (kept for CI that wants to ingest the
#                                  # unresolved-symbol report as a step
#                                  # before flipping to strict mode).
#
# Exit codes:
#   0  every step succeeded (binary produced)
#   2  IR emission failed
#   3  object compile failed
#   4  link failed — see /tmp/monitor_link_errors.log
#
# Dependencies:
#   - vaisc built from /Users/sswoo/study/projects/vais/compiler
#   - clang (Apple clang on macOS)
#   - Vais std C runtimes under /opt/homebrew/opt/vais/share/vais/std
#   - OpenSSL (libcrypto) for PBKDF2-HMAC-SHA256 and HMAC-SHA256 JWT
#   - libsqlite3 for the db_* group

set -euo pipefail

REPO=/Users/sswoo/study/projects/vais
VAISC="${VAISC:-$REPO/compiler/target/release/vaisc}"
# Fall back to debug binary if release build is missing, matching what
# iter 15 development used interactively.
if [[ ! -x "$VAISC" ]]; then
    VAISC="$REPO/compiler/target/debug/vaisc"
fi

STD="${STD:-/opt/homebrew/opt/vais/share/vais/std}"
SRC=server/src
OUT=server/monitor-server
OBJ_DIR=/tmp/monitor_objs
LINK_LOG=/tmp/monitor_link_errors.log
MONITOR_RUNTIME_C="$SRC/monitor_runtime.c"
MONITOR_RUNTIME_O=/tmp/monitor_runtime.o

MODE="${1:-full}"

# Resolve to the project root (script lives in monitor/server/).
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "=== Step 1: vaisc → LLVM IR ==="
rm -rf "$SRC/.vais-cache"
rm -f "$SRC"/main_*.ll
VAIS_DEP_PATHS="$(pwd)/$SRC:/tmp/vais-lib/std" \
VAIS_STD_PATH="/tmp/vais-lib/std" \
"$VAISC" build "$SRC/main.vais" --emit-ir --force-rebuild \
    2>&1 | tee /tmp/monitor_vaisc.log | tail -5 || {
        echo "!! vaisc failed — see /tmp/monitor_vaisc.log" >&2
        exit 2
    }
LL_COUNT=$(ls "$SRC"/main_*.ll 2>/dev/null | wc -l | tr -d ' ')
echo "Emitted $LL_COUNT .ll files to $SRC/"

if [[ "$MODE" == "--ir-only" ]]; then
    exit 0
fi

echo "=== Step 2: clang -c each .ll → .o ==="
mkdir -p "$OBJ_DIR"
rm -f "$OBJ_DIR"/*.o
: > /tmp/monitor_clang.log
FAILED_OBJS=0
for ll in "$SRC"/main_*.ll; do
    base=$(basename "$ll" .ll)
    if ! clang -c "$ll" -o "$OBJ_DIR/$base.o" -Wno-override-module 2>>/tmp/monitor_clang.log; then
        FAILED_OBJS=$((FAILED_OBJS + 1))
        echo "  [fail] $ll" >&2
    fi
done
echo "Compiled $(ls "$OBJ_DIR"/*.o 2>/dev/null | wc -l | tr -d ' ') object file(s); $FAILED_OBJS failed"
if [[ "$FAILED_OBJS" -gt 0 ]]; then
    echo "!! see /tmp/monitor_clang.log for details" >&2
    exit 3
fi

if [[ "$MODE" == "--objects" ]]; then
    exit 0
fi

echo "=== Step 3: compile shared C runtimes + monitor_runtime.c ==="
mkdir -p /tmp/monitor_runtime

# Shared Vais std C runtimes (best effort — missing ones are warned but
# don't stop the build; Step 4 will reveal any gaps).
for rt in http_runtime sqlite_runtime http_server_runtime; do
    if [[ -f "$STD/$rt.c" ]]; then
        clang -c "$STD/$rt.c" -o "/tmp/monitor_runtime/$rt.o" \
            -I/opt/homebrew/include 2>&1 || {
            echo "  [warn] failed to compile $STD/$rt.c" >&2
        }
    fi
done

# Monitor-specific runtime implementations (iter 15 — vais ROADMAP Phase 2
# #16~#20). This single file covers io/socket, sqlite db, random/uuid,
# crypto+jwt, and json — ~1600 LOC.
if [[ ! -f "$MONITOR_RUNTIME_C" ]]; then
    echo "!! monitor_runtime.c not found at $MONITOR_RUNTIME_C" >&2
    exit 3
fi
if ! clang -c "$MONITOR_RUNTIME_C" -o "$MONITOR_RUNTIME_O" \
        -Wno-override-module -I/opt/homebrew/include \
        2>>/tmp/monitor_clang.log; then
    echo "!! failed to compile monitor_runtime.c — see /tmp/monitor_clang.log" >&2
    exit 3
fi

echo "=== Step 4: link ==="
mkdir -p "$(dirname "$OUT")"
if clang "$OBJ_DIR"/*.o \
        /tmp/monitor_runtime/*.o \
        "$MONITOR_RUNTIME_O" \
        -o "$OUT" \
        -L/opt/homebrew/lib \
        -lsqlite3 -lcrypto -lm -lc \
        2>"$LINK_LOG"; then
    echo "=== Build complete ==="
    ls -la "$OUT"
    file "$OUT"
    exit 0
fi

echo "!! link failed — see $LINK_LOG" >&2
echo "=== Unresolved symbol summary ==="
# Extract unresolved symbols (Undefined symbols: _<name>) and dedupe.
# The macOS linker prints "Undefined symbols for architecture arm64:" then
# "  \"_symbol\", referenced from:" lines. We grep the latter.
grep -oE '"_[A-Za-z_][A-Za-z0-9_]*"' "$LINK_LOG" 2>/dev/null \
    | sort -u \
    | sed 's/^"//;s/"$//;s/^_//' \
    | tee /tmp/monitor_unresolved.txt
UNRESOLVED=$(wc -l < /tmp/monitor_unresolved.txt | tr -d ' ')
echo "Total unresolved symbols: $UNRESOLVED"

if [[ "$MODE" == "--link-report" ]]; then
    # Link-report mode is informational — succeed so CI can ingest the report.
    exit 0
fi
exit 4
