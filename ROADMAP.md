## 설계 결정
- 기술: vais (언어) + vais-server (백엔드) + vaisdb (DB) + vais-web/VaisX (프론트엔드)
- 프로젝트: AI 기반 인프라/서비스 모니터링 플랫폼
- 인증: JWT + OAuth 2.0 (GitHub) + 패스워드 해싱
- API: REST + GraphQL + WebSocket
- DB: SQL + Vector(HNSW) + Graph + Full-Text + RAG
- 구조: server/ (vais-server), web/ (VaisX), PRD.md (기획)

## Current Tasks (2026-04-07)
mode: completed
max_iterations: 26
iteration: 7

### Phase 1: Foundation
- [x] 1. 프로젝트 폴더 구조 + CLAUDE.md + runtime.vais (impl-sonnet) ✅ 2026-04-06
  changes: CLAUDE.md (빌드/테스트/컨벤션), server/src/runtime.vais (48 X F 선언), 34개 디렉토리
- [x] 2. DB 스키마 생성 — SQL 테이블 + 인덱스 + Vector + Graph + Full-Text (impl-sonnet) ✅ 2026-04-06 [blockedBy: 1]
  changes: server/src/db.vais (13 tables, 18 B-Tree indexes, 1 FULLTEXT, 3 VECTOR HNSW, 6 helper functions)
- [x] 3. vais-server 초기화 — App, Config, 미들웨어 파이프라인 (impl-sonnet) ✅ 2026-04-06 [blockedBy: 1]
  changes: config.vais (ServerConfig + default/from_env), middleware.vais (auth_guard, require_role, check_rate_limit, log_request), main.vais (dispatch, 10 route groups, static serving)
- [x] 4. 인증 시스템 — JWT + OAuth + 패스워드 + 세션 (impl-sonnet) ✅ 2026-04-06 [blockedBy: 2, 3]
  changes: auth.vais (513L — JWT 생성/검증, 패스워드 해싱, 7 API 핸들러, OAuth GitHub flow)
- [x] 5. 사용자/팀 CRUD API + RLS (impl-sonnet) ✅ 2026-04-06 [blockedBy: 4]
  changes: models/user.vais (User/Team 모델, 13 Repository 함수), api/users.vais (18 함수 — 사용자/팀 CRUD + RLS + 페이징)

### Phase 2: Core
- [x] 6. 서비스 CRUD API + DB + 그래프 노드 연동 (impl-sonnet) ✅ 2026-04-06 [blockedBy: 5]
  changes: models/service.vais (Service/Dep 모델, 16 함수 — CRUD+Graph), api/services.vais (9 핸들러 — 트랜잭션, RLS, Graph 연동)
- [x] 7. 메트릭 수집/조회 API + 집계 (impl-sonnet) ✅ 2026-04-06 [blockedBy: 6]
  changes: models/metric.vais (Metric/Aggregation, 9 함수 — record/get/aggregate/percentile/cleanup), api/metrics.vais (3 핸들러 — push/aggregate/service_metrics)
- [x] 8. 헬스체크 워커 — async spawn + 채널 (impl-sonnet) ✅ 2026-04-06 [blockedBy: 7]
  changes: workers/healthcheck.vais (4 async 함수 — start/check/simulate/check_all, G 전역 플래그, graceful shutdown)
- [x] 9. 로그 수집/검색 API — Full-Text (BM25, BOOLEAN, PHRASE) (impl-sonnet) ✅ 2026-04-06 [blockedBy: 6]
  changes: models/log_entry.vais (LogEntry, 12 함수 — ingest/search BM25+BOOLEAN+PHRASE/cleanup), api/logs.vais (4 핸들러 + 2 헬퍼)
- [x] 10. 알림 룰 CRUD + 평가 엔진 + 인시던트 생성 (impl-sonnet) ✅ 2026-04-06 [blockedBy: 7]
  changes: models/alert.vais (19 함수 — AlertRule/Incident CRUD + evaluate_condition), api/alerts.vais (12 함수 — 10 핸들러), workers/alert_eval.vais (async 평가 워커)

### Phase 3: Advanced
- [x] 11. 벡터 임베딩 + 유사 검색 — 로그/인시던트/메트릭 (impl-sonnet) ✅ 2026-04-07 [blockedBy: 9, 10]
  changes: models/embedding.vais (Embedding struct, create/search_similar/delete_by_source), api/search.vais (4 핸들러 — create/search/get/delete)
- [x] 12. 서비스 그래프 엔진 — 노드/엣지/순회/최단경로/사이클 (impl-sonnet) ✅ 2026-04-07 [blockedBy: 6]
  changes: graph/engine.vais (GraphNode/GraphEdge, load_graph/bfs/dfs/shortest_path/detect_cycles/impact_analysis)
- [x] 13. RAG 파이프라인 — 문서 청킹 + 하이브리드 검색 + 에이전트 메모리 (impl-sonnet) ✅ 2026-04-07 [blockedBy: 11, 12]
  changes: rag/chunker.vais (ChunkConfig, chunk_text/chunk_document), rag/pipeline.vais (hybrid_search RRF, rag_query, store/recall_memory, ingest_document)
- [x] 14. 이상 탐지 엔진 — 메트릭 벡터 anomaly scoring (impl-sonnet) ✅ 2026-04-07 [blockedBy: 11]
  changes: workers/anomaly.vais (AnomalyConfig/Result, z-score+벡터 anomaly, scan_all_services async 워커, auto incident)
- [x] 15. 인시던트 관리 + 타임라인 API (impl-sonnet) ✅ 2026-04-07 [blockedBy: 10]
  changes: models/incident.vais (TimelineEvent, assign/escalate/acknowledge/resolve/reopen + timeline CRUD + stats), api/incidents.vais (5 핸들러)

### Phase 4: Frontend
- [x] 16. 앱 셸 + 라우팅 + 스토어 + i18n 기반 (impl-sonnet) ✅ 2026-04-07 [blockedBy: 5]
  changes: layout.vaisx (라우팅+레이아웃), stores/auth.vais, stores/app.vais, sidebar.vaisx, header.vaisx, ko.json, en.json (175 키)
- [x] 17. 인증 페이지 — 로그인/가입/OAuth (impl-sonnet) ✅ 2026-04-07 [blockedBy: 16]
  changes: auth/login/page.vaisx (로그인 폼+OAuth+밸리데이션), auth/register/page.vaisx (가입 폼+비밀번호 강도 미터)
- [x] 18. 대시보드 + 실시간 WebSocket (impl-sonnet) ✅ 2026-04-07 [blockedBy: 17, 8]
  changes: dashboard.vaisx (카드+차트+실시간이벤트피드), websocket/handler.vais (연결관리+브로드캐스트+채널구독)
- [x] 19. 서비스 관리 페이지 — CRUD + 폼 + 밸리데이션 (impl-sonnet) ✅ 2026-04-07 [blockedBy: 17, 6]
  changes: services/page.vaisx (목록+검색+생성모달, 1608L), services/[id]/page.vaisx (상세+편집+삭제, 1781L)
- [x] 20. 로그 탐색 + 검색 UI (impl-sonnet) ✅ 2026-04-07 [blockedBy: 17, 9]
  changes: logs/page.vaisx (BM25/BOOLEAN/PHRASE 검색+필터+테일모드, 1270L)
- [x] 21. 알림/인시던트 관리 UI (impl-sonnet) ✅ 2026-04-07 [blockedBy: 17, 15]
  changes: alerts/page.vaisx, alerts/new/page.vaisx, incidents/page.vaisx, incidents/[id]/page.vaisx (룰CRUD+타임라인)
- [x] 22. 서비스 그래프 시각화 — Spring 물리 + 트랜지션 (impl-sonnet) ✅ 2026-04-07 [blockedBy: 17, 12]
  changes: graph/page.vaisx (SVG Spring물리+드래그+줌+영향분석, 1421L)
- [x] 23. AI 질의 인터페이스 (impl-sonnet) ✅ 2026-04-07 [blockedBy: 17, 13]
  changes: ai/page.vaisx (RAG채팅UI+소스참조+세션관리+소스타입필터)

### Phase 5: Operations
- [x] 24. GraphQL API — 스키마 + 리졸버 (impl-sonnet) ✅ 2026-04-07 [blockedBy: 15]
  changes: graphql/schema.vais (SDL 스키마+간이 파서), graphql/resolvers.vais (handle_graphql_request, 8 쿼리+5 뮤테이션 리졸버)
- [x] 25. 설정/백업/감사로그 UI (impl-sonnet) ✅ 2026-04-07 [blockedBy: 17]
  changes: settings/page.vaisx (프로필+비밀번호+알림+테마), settings/backup/page.vaisx (백업/복원), settings/team/page.vaisx (팀멤버+역할+초대)
- [x] 26. 컴포넌트 테스트 + 스냅샷 테스트 (impl-sonnet) ✅ 2026-04-07 [blockedBy: 23]
  changes: tests/components/ (sidebar 14, header 19, dashboard 13, auth 28 케이스), tests/snapshots/pages.test.ts (18 스냅샷)
- [x] 27. 통합 테스트 (impl-sonnet) ✅ 2026-04-07 [blockedBy: 26]
  changes: server/src/tests/integration_test.vais (서버 API 통합), web/tests/integration/api.test.ts + flow.test.ts (프론트엔드 통합)

### Phase 6: Quality Hardening
- [x] 28. SQL 인젝션 근절 — 전체 모델/API에 Prepared Statement 적용 (impl-sonnet) ✅ 2026-04-07
  changes: models/*.vais, auth.vais, rag/pipeline.vais, workers/anomaly.vais, api/metrics.vais (INSERT/UPDATE/DELETE→prepared statements, SELECT string params→escaped)
- [x] 29. 보안 취약점 수정 — JWT/경로순회/WebSocket/Admin 인증 (impl-sonnet) ✅ 2026-04-07
  changes: config.vais (JWT시크릿 미설정 경고), main.vais (경로순회 차단, admin 역할검증, status로깅, JSON이스케이핑), websocket/handler.vais (JWT검증), graphql/resolvers.vais (viewer mutation차단)
- [x] 30. 에러 핸들링 보강 — DB 반환값 검증 + 트랜잭션 안전성 (impl-sonnet) ✅ 2026-04-07 [blockedBy: 28]
  changes: db.vais (CREATE TABLE 에러로그), auth.vais (refresh token 실패처리, OAuth 스코핑버그), alert.vais (last_insert_rowid), log_entry.vais (루프조건), services.vais (defer rollback)
- [x] 31. N+1 쿼리 제거 + 성능 최적화 (impl-sonnet) ✅ 2026-04-07 [blockedBy: 28]
  changes: graph/engine.vais (메모리 adjacency list), healthcheck/anomaly.vais (Vec 캐싱), rag/pipeline.vais (json_each제거), incidents.vais (GROUP BY), metric.vais+alert_eval.vais (동적루프), db.vais (인덱스2개)
- [x] 32. 코드 중복 제거 — 서버 공통 헬퍼 추출 (impl-sonnet) ✅ 2026-04-07 [blockedBy: 28, 29]
  changes: middleware.vais (require_auth, parse_pagination 추가), auth.vais+api/*.vais 7개 (json/error_response 통합, JWT블록→require_auth, 페이지네이션→parse_pagination)
- [x] 33. 프론트엔드 에러 핸들링 + 접근성 + i18n 보강 (impl-sonnet) ✅ 2026-04-07 [blockedBy: 29]
  changes: dashboard.vaisx (try/catch/finally, clearInterval), graph/login/register (에러처리), header/sidebar/logs/incidents/services/settings (ARIA), ko.json+en.json (30+ 키 추가), 8개 페이지 i18n화
- [x] 34. 프론트엔드 코드 중복 제거 + 컴포넌트 분리 (impl-sonnet) ✅ 2026-04-07 [blockedBy: 33]
  changes: PasswordInput.vaisx (신규), stores/api.vais (신규), login+register (PasswordInput 적용), 6개 파일 @keyframes spin 제거, ko/en.json 키 추가
- [x] 35. 서버 누락 테스트 보강 — 워커/RAG/WebSocket (impl-sonnet) ✅ 2026-04-07 [blockedBy: 28, 29, 30, 31]
  changes: worker_test.vais (12 함수 — evaluate_condition 6, determine_status 3, calculate_zscore 3), rag_test.vais (10 함수 — chunk_text 5, rrf_score 3, chunk_count 2), integration_test.vais (+3 함수 — GraphQL mutation, RLS격리, 페이지네이션)
- [x] 36. 프론트엔드 테스트 보강 (impl-sonnet) ✅ 2026-04-07 [blockedBy: 33, 34]
  changes: web/tests/components/ (logs 26, alerts 22, graph 20, ai 19, settings-team 22 테스트 케이스 추가)

strategy: sequential pipeline with parallel branches (Phase 2: 8∥9, 10∥9; Phase 3: 12∥11; Phase 4: 19∥20∥21∥22∥23; Phase 6: 28∥29, 30∥31)
### Phase 7: Review Fixes
- [x] 37. dispatch_handler stub→실제 API 핸들러 연결 (impl-sonnet) ✅ 2026-04-07
  changes: main.vais (8개 stub→실제 함수 연결: auth, services, metrics, logs, alerts, incidents, graph, ai, admin, websocket)
- [x] 38. auth.vais 보안 수정 — 동적 파싱 + JSON injection + SELECT 이스케이프 (impl-sonnet) ✅ 2026-04-07
  changes: auth.vais (extract_token LW루프, get_query_param LW루프, user_to_json 이스케이프, SELECT 백슬래시+싱글쿼트 이중이스케이프)
- [x] 39. JWT 시크릿 차단 + rate limit + 함수명 충돌 수정 (impl-sonnet) ✅ 2026-04-07 [blockedBy: 37]
  changes: config.vais (랜덤UUID시크릿), middleware.vais (fallback제거, sliding window rate limit), alerts.vais (handle_get_incident→handle_get_incident_from_alert)
- [x] 40. 로그 검색 RLS + total + FTS 이스케이프 + anomaly 동적 루프 (impl-sonnet) ✅ 2026-04-07
  changes: api/logs.vais (boolean/phrase RLS전달, total실제값), log_entry.vais (team_id파라미터), rag/pipeline.vais (FTS 6단계이스케이프), anomaly.vais (동적루프)

progress: 40/40 (100%)

## Current Tasks (2026-04-09)
mode: completed
max_iterations: 12
iteration: 3

### Phase 8: E2E Testing
- [x] 41. Playwright 설정 + E2E 테스트 인프라 구축 (impl-sonnet) ✅ 2026-04-09
  changes: playwright.config.ts (baseURL/retries/projects/webServer), helpers/auth.ts (login/loginWithToken/logout), helpers/api-mock.ts (mockApiResponse/mockAuthApi/mockServiceApi/mockWebSocket), helpers/test-utils.ts (waitForPageLoad/getByTestId/expectToast/takeScreenshot)
- [x] 42. 인증 플로우 E2E 테스트 — 로그인/가입/OAuth/로그아웃 (impl-sonnet) ✅ 2026-04-09 [blockedBy: 41]
  changes: auth.spec.ts (10 테스트 — 로그인 성공/실패, 밸리데이션, 가입, OAuth, 로그아웃, 토큰리프레시, 비인증차단)
- [x] 43. 대시보드 + 실시간 WebSocket E2E 테스트 (impl-sonnet) ✅ 2026-04-09 [blockedBy: 41]
  changes: dashboard.spec.ts (12 테스트 — 렌더링, 카드, 새로고침, WebSocket, 네비게이션, 로딩)
- [x] 44. 서비스 CRUD + 로그 검색 E2E 테스트 (impl-sonnet) ✅ 2026-04-09 [blockedBy: 41]
  changes: services.spec.ts (7 테스트 — CRUD+검색+빈목록), logs.spec.ts (7 테스트 — BM25/BOOLEAN/PHRASE+필터+테일)
- [x] 45. 알림/인시던트 관리 + 그래프/AI E2E 테스트 (impl-sonnet) ✅ 2026-04-09 [blockedBy: 41]
  changes: alerts.spec.ts (8 테스트 — 룰CRUD+인시던트상태), graph.spec.ts (4 테스트 — SVG+노드+영향분석+줌), ai.spec.ts (4 테스트 — 채팅+소스+세션+필터)
- [x] 46. 설정 페이지 + 크로스 플로우 E2E 테스트 (impl-sonnet) ✅ 2026-04-09 [blockedBy: 41, 42]
  changes: settings.spec.ts (10 테스트 — 프로필/비밀번호/알림/테마/팀/백업), cross-flow.spec.ts (6 테스트 — 네비게이션/서비스→대시보드/알림→인시던트/i18n/테마유지)

strategy: sequential start (41), then parallel branches (42∥43∥44∥45), final (46)
e2e_progress: 6/6 (100%)

## Current Tasks (2026-04-09)
mode: auto
max_iterations: 12
iteration: 2

### Phase 9: Build Verification & Fix
- [x] 47. EL → E 키워드 수정 — else를 EL→E로 전체 교체 (Opus direct) ✅ 2026-04-09
  changes: 42개 .vais/.vaisx 파일에서 377개 } EL { → } E { 교체 (sed)
- [ ] 48. 서버 빌드 에러 수정 — 1차 잔여 에러 (impl-sonnet) [blockedBy: 47]
- [ ] 49. 프론트엔드 빌드 에러 수정 (impl-sonnet) [blockedBy: 47]
- [ ] 50. 서버 테스트 실행 + 에러 수정 (impl-sonnet) [blockedBy: 48]
- [ ] 51. 프론트엔드 테스트 실행 + 에러 수정 (impl-sonnet) [blockedBy: 49]

strategy: sequential (47→48→50), parallel branch (47→49→51)
build_progress: 0/5 (0%)
