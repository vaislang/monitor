# Performance Testing

## RSS Plateau Test

Vais 컴파일러 RFC-001 §9 "장기 실행 서버의 RSS는 상수 시간 내 수렴해야 한다" 조건을
`monitor-server`에서 자동 검증한다. Phase 190.5/190.6의 문자열 소유권 드롭 추적이
실서버 워크로드에서도 유효한지 확인하는 용도.

### Usage

```bash
# 기본 (5분 구동, 워밍업 30초 제외, 15 MB 임계)
./bench/rss_plateau.sh

# 120초만 빠르게
./bench/rss_plateau.sh 120

# 파라미터 전체 제어
DURATION_SEC=600 WARMUP_SEC=60 THRESHOLD_MB=10 ./bench/rss_plateau.sh

# CSV 샘플 보존 (기본은 삭제)
KEEP_CSV=1 CSV_OUT=/tmp/monitor_rss.csv ./bench/rss_plateau.sh
```

### Exit codes

| Code | Meaning |
|------|---------|
| 0    | PASS — 워밍업 이후 RSS max-min delta ≤ THRESHOLD_MB |
| 1    | FAIL — delta가 임계 초과. `KEEP_CSV=1`로 재실행해 샘플 조사 |
| 2    | 설정/실행 오류 — 바이너리 없음, 즉시 종료, 샘플 수집 실패 |

### Output

스크립트는 시작 RSS / 마지막(stable) RSS / 워밍업 이후 max·min / delta / verdict를
출력한다. 현재 baseline (2026-04-14, 45s 스모크):
start=stable=max=min=2.38 MB, delta=0 KB → PASS.

### CI integration

GitHub Actions workflow에 등록할 경우 `DURATION_SEC=300 THRESHOLD_MB=15`로 실행하고
exit code로 gate 처리. `KEEP_CSV=1`로 결과 CSV를 아티팩트로 업로드하면 RSS 곡선 회귀를
추적할 수 있다.
