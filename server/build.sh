#!/bin/bash
# build.sh — monitor-server build harness
#
# Pipes vaisc → clang → link so that ROADMAP #9 (monitor re-verification)
# can run end-to-end instead of stopping after TC. Runtime implementations
# for monitor's 47 extern functions are NOT complete; the link step is
# expected to report unresolved symbols, and that report IS the current
# "runtime stub specification" for the monitor project. See the README
# section added at the bottom of this file for the follow-up plan.
#
# Usage:
#   ./build.sh                     # default: IR + object + link (may fail)
#   ./build.sh --ir-only           # stop after .ll emission
#   ./build.sh --objects           # stop after clang -c
#   ./build.sh --link-report       # run full pipeline and dump link errors
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

set -euo pipefail

REPO=/Users/sswoo/study/projects/vais
VAISC="${VAISC:-$REPO/compiler/target/debug/vaisc}"
STD="${STD:-/opt/homebrew/opt/vais/share/vais/std}"
SRC=server/src
OUT=server/monitor-server
OBJ_DIR=/tmp/monitor_objs
LINK_LOG=/tmp/monitor_link_errors.log

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

echo "=== Step 3: compile shared C runtimes ==="
mkdir -p /tmp/monitor_runtime
for rt in http_runtime sqlite_runtime http_server_runtime; do
    if [[ -f "$STD/$rt.c" ]]; then
        clang -c "$STD/$rt.c" -o "/tmp/monitor_runtime/$rt.o" 2>&1 || {
            echo "  [warn] failed to compile $STD/$rt.c" >&2
        }
    fi
done

echo "=== Step 4: link (best effort) ==="
# Monitor-specific runtime_glue.c is NOT yet written — this step is
# expected to fail with unresolved externs. The failure log becomes the
# input to the next iteration that writes runtime_glue.c / runtime.c.
mkdir -p "$(dirname "$OUT")"
if clang "$OBJ_DIR"/*.o \
        /tmp/monitor_runtime/*.o \
        -o "$OUT" \
        -lsqlite3 -lc \
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

# ============================================================================
# README (for whoever picks up the runtime stub work)
# ============================================================================
# monitor/server declares ~47 extern functions in runtime.vais (see
# `grep '^X F ' server/src/runtime.vais`). signature/server has a
# hand-written `src/runtime.c` that implements all of its 9 externs. To
# produce a working monitor binary, someone needs to write the monitor
# equivalent — roughly grouped as:
#
#   1. string helpers: str_len, str_char_at, str_slice, str_contains,
#      str_starts_with, str_ends_with, str_replace, str_trim, str_to_lower,
#      str_to_upper, str_to_f64, str_to_i64, i64_to_str, f64_to_str
#   2. math: abs_f64, abs_i64, ceil, floor, sqrt, random_f64, random_i64
#   3. time: current_time_ms, sleep_ms
#   4. io: println, read_file, write_file, env_get
#   5. json: json_parse, json_stringify, json_get, json_set
#   6. crypto / auth: hash_password, verify_password, jwt_encode, jwt_decode,
#      generate_uuid
#   7. http server: server_listen, server_stop
#   8. sqlite: db_connect, db_close, db_execute, db_query, db_prepare,
#      db_execute_prepared, db_begin_transaction, db_commit, db_rollback
#
# The fastest path is to port signature/server/src/runtime.c and add the
# missing groups, reusing /opt/homebrew/opt/vais/share/vais/std/*.c
# helpers where possible. Track that work as a separate ROADMAP item.
