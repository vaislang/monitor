# Vais Monitor

AI 기반 인프라/서비스 모니터링 플랫폼.

## Build & Run

```bash
# 서버 빌드
cd server && vaisc build src/main.vais -o vais-monitor

# 서버 실행
./vais-monitor --port 8080

# 프론트엔드 빌드
cd web && vaisc build app/layout.vaisx --target js -o dist/
```

## Test

```bash
cd server && vaisc test src/
cd web && vitest run
```

## Project Structure

- `server/src/` — vais-server 백엔드
  - `api/` — REST API 핸들러
  - `models/` — 도메인 모델 + Repository trait
  - `workers/` — async 백그라운드 워커
  - `graph/` — 서비스 의존성 그래프
  - `rag/` — RAG 파이프라인
  - `graphql/` — GraphQL 스키마/리졸버
  - `websocket/` — WebSocket 핸들러
- `web/app/` — VaisX 프론트엔드
- `web/locales/` — i18n 번역 파일
- `data/` — 데이터 파일

## Conventions

- vais 단축 키워드 사용: F(함수), S(구조체), EN(열거형), W(트레잇), X(구현), I/EL(if/else), M(매치), R(리턴), A/Y(async/await), U(use), D(defer), G(global)
- 에러 처리: Result<T, E> + ? 연산자
- 네이밍: snake_case (함수/변수), PascalCase (타입/트레잇)
- 모든 public API에 타입 어노테이션 필수
- DB 쿼리는 QueryBuilder 사용 (문자열 연결 금지)
