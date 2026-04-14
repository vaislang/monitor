#!/bin/bash
# rss_plateau.sh — vais-monitor RSS plateau verification.
#
# RFC-001 §9 ("장기 실행 서버 RSS는 상수 시간 내 수렴해야 한다") 검증 자동화.
# Phase 190.5/190.6 문자열 소유권 수정이 실서버 RSS 곡선에서 유효한지 증명.
#
# 절차:
#   1. monitor-server 바이너리를 백그라운드로 기동
#   2. `ps -o rss=`로 1초 간격 RSS(KB) 샘플링
#   3. WARMUP_SEC(기본 30초) 구간은 제외하고 나머지에서 max-min delta 계산
#   4. delta ≤ THRESHOLD_MB 이면 PASS, 초과면 FAIL
#   5. 서버 종료 + CSV 정리
#
# Usage:
#   ./bench/rss_plateau.sh                   # 기본 300초 구동, 15MB 임계
#   ./bench/rss_plateau.sh 120               # 120초 구동
#   DURATION_SEC=600 THRESHOLD_MB=10 ./bench/rss_plateau.sh
#
# Env overrides:
#   MONITOR_BIN   monitor-server 경로 (기본: server/monitor-server)
#   DURATION_SEC  총 구동 시간 (기본: 300)
#   WARMUP_SEC    제외할 초반 구간 (기본: 30)
#   THRESHOLD_MB  PASS 허용 delta, MB (기본: 15)
#   CSV_OUT       샘플 저장 경로 (기본: 임시파일, 종료 시 삭제)
#   KEEP_CSV=1    CSV를 지우지 않고 유지
#
# Exit codes: 0 PASS, 1 FAIL, 2 setup error.

set -euo pipefail

DURATION_SEC="${DURATION_SEC:-${1:-300}}"
WARMUP_SEC="${WARMUP_SEC:-30}"
THRESHOLD_MB="${THRESHOLD_MB:-15}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MONITOR_BIN="${MONITOR_BIN:-$REPO_ROOT/server/monitor-server}"

if [[ ! -x "$MONITOR_BIN" ]]; then
    echo "!! monitor-server not found at $MONITOR_BIN" >&2
    echo "   Build first: cd $REPO_ROOT/server && ./build.sh" >&2
    exit 2
fi

if (( DURATION_SEC <= WARMUP_SEC )); then
    echo "!! DURATION_SEC ($DURATION_SEC) must exceed WARMUP_SEC ($WARMUP_SEC)" >&2
    exit 2
fi

CSV_OUT="${CSV_OUT:-$(mktemp -t rss_plateau.XXXXXX.csv)}"
KEEP_CSV="${KEEP_CSV:-0}"

MONITOR_STDOUT=$(mktemp -t monitor_stdout.XXXXXX.log)
MONITOR_STDERR=$(mktemp -t monitor_stderr.XXXXXX.log)
# Isolate per-run state (sqlite DB, WAL/SHM) so the script doesn't pollute the caller's cwd.
MONITOR_RUNDIR=$(mktemp -d -t monitor_run.XXXXXX)

cleanup() {
    local rc=$?
    if [[ -n "${MON_PID:-}" ]] && kill -0 "$MON_PID" 2>/dev/null; then
        kill -TERM "$MON_PID" 2>/dev/null || true
        # Brief grace period, then SIGKILL.
        for _ in 1 2 3 4 5; do
            kill -0 "$MON_PID" 2>/dev/null || break
            sleep 0.2
        done
        kill -KILL "$MON_PID" 2>/dev/null || true
    fi
    if [[ "$KEEP_CSV" != "1" ]]; then
        rm -f "$CSV_OUT"
    fi
    rm -f "$MONITOR_STDOUT" "$MONITOR_STDERR"
    rm -rf "$MONITOR_RUNDIR"
    exit "$rc"
}
trap cleanup EXIT INT TERM

echo "=== rss_plateau.sh ==="
echo "binary:       $MONITOR_BIN"
echo "duration:     ${DURATION_SEC}s"
echo "warmup:       ${WARMUP_SEC}s (excluded)"
echo "threshold:    ${THRESHOLD_MB} MB"
echo "samples csv:  $CSV_OUT"
echo

# Launch monitor-server in background from an isolated rundir so DB/WAL
# artefacts don't land in the caller's cwd.
(cd "$MONITOR_RUNDIR" && exec "$MONITOR_BIN" >"$MONITOR_STDOUT" 2>"$MONITOR_STDERR") &
MON_PID=$!

# Confirm it's alive after a short settle.
sleep 1
if ! kill -0 "$MON_PID" 2>/dev/null; then
    echo "!! monitor-server exited immediately; stderr:" >&2
    cat "$MONITOR_STDERR" >&2 || true
    exit 2
fi

echo "started monitor-server (pid=$MON_PID), sampling..."
echo "sec,rss_kb" > "$CSV_OUT"

for ((t=0; t<DURATION_SEC; t++)); do
    if ! kill -0 "$MON_PID" 2>/dev/null; then
        echo "!! monitor-server died at t=${t}s" >&2
        cat "$MONITOR_STDERR" >&2 || true
        exit 2
    fi
    rss_kb="$(ps -o rss= -p "$MON_PID" 2>/dev/null | tr -d ' ' || true)"
    if [[ -n "$rss_kb" ]]; then
        printf '%d,%s\n' "$t" "$rss_kb" >> "$CSV_OUT"
    fi
    sleep 1
done

# Analyze: skip warmup, compute max/min in KB → MB.
read -r start_rss_kb stable_rss_kb max_rss_kb min_rss_kb < <(
    awk -F, -v warmup="$WARMUP_SEC" '
        NR == 2 { start = $2 }
        NR > 1 && $1 >= warmup {
            if (max == "" || $2 > max) max = $2
            if (min == "" || $2 < min) min = $2
            last = $2
        }
        END {
            if (max == "") { print start, start, start, start; exit }
            print start, last, max, min
        }
    ' "$CSV_OUT"
)

if [[ -z "${max_rss_kb:-}" || -z "${min_rss_kb:-}" ]]; then
    echo "!! no samples collected after warmup" >&2
    exit 2
fi

delta_kb=$(( max_rss_kb - min_rss_kb ))
delta_mb_int=$(( delta_kb / 1024 ))
threshold_kb=$(( THRESHOLD_MB * 1024 ))

mb() { printf '%.2f' "$(echo "scale=4; $1 / 1024" | bc)"; }

verdict="PASS"
exit_code=0
if (( delta_kb > threshold_kb )); then
    verdict="FAIL"
    exit_code=1
fi

echo
echo "=== result ==="
printf 'start RSS:     %s MB (%d KB)\n' "$(mb "$start_rss_kb")" "$start_rss_kb"
printf 'stable RSS:    %s MB (%d KB, last sample)\n' "$(mb "$stable_rss_kb")" "$stable_rss_kb"
printf 'max RSS:       %s MB (%d KB, post-warmup)\n'  "$(mb "$max_rss_kb")" "$max_rss_kb"
printf 'min RSS:       %s MB (%d KB, post-warmup)\n'  "$(mb "$min_rss_kb")" "$min_rss_kb"
printf 'delta:         %s MB (%d KB)  threshold=%d MB\n' \
    "$(mb "$delta_kb")" "$delta_kb" "$THRESHOLD_MB"
printf 'verdict:       %s\n' "$verdict"

if [[ "$KEEP_CSV" == "1" ]]; then
    echo "csv preserved: $CSV_OUT"
fi

exit "$exit_code"
