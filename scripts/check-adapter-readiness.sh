#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${1:-status}"

if [[ "$MODE" != "status" && "$MODE" != "--require-promoted" ]]; then
  echo "usage: scripts/check-adapter-readiness.sh [--require-promoted]" >&2
  exit 2
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

compiler_dir=""
for dir in "${candidate_compiler_dirs[@]}"; do
  if [[ -f "$dir/PUBLIC_STATUS.md" ]]; then
    compiler_dir="$dir"
    break
  fi
done

if [[ -z "$compiler_dir" ]]; then
  echo "adapter readiness: unknown" >&2
  echo "PUBLIC_STATUS.md not found. Set VAIS_COMPILER_DIR to the Vais compiler checkout." >&2
  exit 1
fi

public_status="$compiler_dir/PUBLIC_STATUS.md"

has_db_smoke=0
has_server_smoke=0
has_pending_aggregate=0
has_promoted_aggregate=0

if grep -Eq 'VaisDB runtime smoke: `34/34`|VaisDB runtime[[:space:]]*\|[[:space:]]*`smoke=34/34`' "$public_status"; then
  has_db_smoke=1
fi

if grep -Eq 'Vais Server runtime smoke: `20/20`|vais-server runtime[[:space:]]*\|[[:space:]]*`smoke=20/20`' "$public_status"; then
  has_server_smoke=1
fi

if grep -Eiq 'Full ecosystem runtime aggregate runner: still pending|single full ecosystem runtime (aggregate )?gate pending|Main-branch reproducibility for a single full ecosystem runtime aggregate' "$public_status"; then
  has_pending_aggregate=1
fi

if grep -Eiq 'Full ecosystem runtime aggregate runner: (passed|ok|green|promoted)|DB/server/web runtime main gate: (passed|ok|green|promoted)|single full ecosystem runtime (aggregate )?gate: (passed|ok|green|promoted)' "$public_status"; then
  has_promoted_aggregate=1
fi

if [[ "$has_db_smoke" -eq 1 && "$has_server_smoke" -eq 1 ]]; then
  echo "adapter readiness evidence: db smoke=34/34, server smoke=20/20"
else
  echo "adapter readiness evidence: missing db/server smoke marker in $public_status"
fi

if [[ "$has_promoted_aggregate" -eq 1 && "$has_pending_aggregate" -eq 0 ]]; then
  echo "adapter readiness: promoted"
  exit 0
fi

echo "adapter readiness: blocked"
echo "reason: DB/server individual smokes are not enough; monitor adapters require a promoted single DB/server/web runtime main gate."

if [[ "$MODE" == "--require-promoted" ]]; then
  exit 1
fi

exit 0
