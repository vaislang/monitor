# Vais Monitor — Product Requirements Document

> AI 기반 인프라/서비스 모니터링 플랫폼
> vais 생태계(vais, vais-server, vaisdb, vais-web) 전 기능 쇼케이스

---

## 1. 프로젝트 개요

### 비전
단일 바이너리로 배포 가능한 **셀프호스팅 인프라 모니터링 플랫폼**.
서비스 메트릭 수집, 로그 분석, 장애 탐지, 서비스 의존성 시각화를 하나의 도구로 제공한다.

### 차별화
- **단일 바이너리**: vais 네이티브 컴파일 — 설치 없이 바로 실행
- **AI 이상 탐지**: 벡터 임베딩 기반 로그 클러스터링 + 유사 장애 검색
- **서비스 그래프**: 의존성 맵 + 장애 전파 경로 자동 추적
- **자연어 질의**: "최근 5xx 에러 원인이 뭐야?" → RAG 기반 답변

### 타겟 ��용자
- 소규모~중규모 팀의 DevOps/SRE 엔지니어
- 셀프호스팅 선호하는 스타트업

---

## 2. 핵심 기능 목록

### 2.1 대시보드 (Dashboard)
- 실시간 메트릭 스트리밍 (WebSocket)
- 서비스별 상태 카드 (UP/DOWN/DEGRADED)
- 커스텀 차트 위젯 (CPU, Memory, Latency, Error Rate)
- 시간 범위 선택기 (1h/6h/24h/7d/custom)

### 2.2 서비스 관리 (Services)
- 서비스 CRUD (이름, URL, 헬스체크 엔드포인��, 간격)
- 서비스 그룹/태그 분류
- 헬스체크 자동 실행 + 상태 기록
- 서비스 의존성 관계 설정

### 2.3 메트릭 수집 (Metrics)
- HTTP 엔드포인트 폴링 (응답시간, 상태코드)
- 커스텀 메트릭 수신 (POST /api/v1/metrics/push)
- 메트릭 집계 (avg, p50, p95, p99, max)
- 보존 정책 (TTL 기반 자동 삭제)

### 2.4 로그 관리 (Logs)
- 로그 수집 (POST /api/v1/logs/ingest)
- 풀텍스트 검색 (BM25 랭킹)
- 로그 레벨 필터 (DEBUG/INFO/WARN/ERROR/FATAL)
- 벡터 임베딩 → 유사 로그 클러스터링

### 2.5 알림 (Alerts)
- 알림 룰 CRUD (조건식: metric > threshold for duration)
- 알림 채널 (Webhook, Email placeholder)
- 알림 히스토리 + 인시던트 타임라인
- 알림 뮤트/스누즈

### 2.6 서비스 그래프 (Service Graph)
- 서비스 간 의존성 그래프 시각화
- 장애 전파 경로 하이라이트
- 최단 경로 / 순환 의존성 탐지
- 노드 클릭 → 서비스 상세 이동

### 2.7 AI 분석 (AI Insights)
- 이상 탐지: 메트릭 벡터 기반 anomaly scoring
- 유사 장애 검색: 과거 인시던트와 벡터 유사도 비교
- 자연어 질의: RAG (로그+메트릭+인시던트 문서) 기반 답변
- 근본 원인 추천: 그래프 순회 + 시간 상관관계

### 2.8 사용자 관리 (Auth & Users)
- 회원가입/로그인 (JWT + refresh token)
- OAuth 2.0 (GitHub)
- 역할 기반 접근 제어 (Admin/Member/Viewer)
- RLS: 팀별 데이터 격리

### 2.9 설정 & 운영 (Settings)
- 데이터 백업/복원 (PITR)
- DB 통계 (VACUUM, ANALYZE)
- 감사 로그 (누가 언제 무엇을)
- 다국어 (한국어/영어)

---

## 3. vais 기술 매핑

### 3.1 vais 언어 기능

| vais 기능 | 사용처 |
|-----------|--------|
| `F` 함수 정의 | 모든 모듈 |
| `S` 구조체 | Service, Metric, Alert, User, LogEntry 등 모든 도메인 모델 |
| `EN` 열거형 | ServiceStatus, AlertSeverity, LogLevel, HttpMethod |
| `W` 트레잇 | `Collector<T>`, `Searchable`, `Serializable`, `Repository<T>` |
| `X` 구현 | 각 모델의 트레잇 구현 |
| `M` 매치 | 라우팅 dispatch, 알림 조건 평가, 로그 레벨 파싱 |
| `A`/`Y` async/await | 메트릭 수집 워커, 헬스체크, WebSocket 핸들러 |
| `G` 글로벌 | 서버 설정, DB 커넥션 풀 |
| `D` defer | DB 트랜잭션 롤백 보장, 리소스 정리 |
| `Result<T,E>` / `Option<T>` | 모든 DB 쿼리, API 핸들러 에러 처리 |
| `\|>` 파이프 연산자 | 메트릭 파이프라인 (수집 → 집계 → 저장) |
| `Vec<T>`, `HashMap<K,V>` | 컬렉션 전반 |
| `spawn` / 채널 | 백그라운드 워커 (헬스체크, 메트릭 수집, 알림 평가) |
| `Mutex<T>`, `RwLock<T>` | 공유 상태 동기화 (커넥션 풀, 알림 상태) |
| 제네릭 `<T>` | Repository<T>, Collector<T>, Paginated<T> |
| `?` try 연산자 | 에러 전파 체인 |
| `#[cfg(...)]` | 환경별 설정 분기 |

### 3.2 vais-server 기능

| 기능 | 사용처 |
|------|--------|
| `App.new()` + ServerConfig | 서버 초기화 |
| `app.get/post/put/delete/patch` | REST API 전체 |
| `app.ws()` | 실시간 대시보드 메트릭 스트리밍 |
| `app.group()` | `/api/v1/services`, `/api/v1/metrics`, `/api/v1/alerts` 그룹 |
| **Logger MW** `use_mw("logger")` | 요청/응답 로깅 |
| **CORS MW** `CorsConfig` | 프론트��드 연동 |
| **Rate Limit MW** `RateLimitConfig` | API 과부하 방지 |
| **Compression MW** `use_mw("compress")` | 응답 압축 |
| **Recovery MW** `use_mw("recovery")` | 패닉 복구 |
| **JWT Auth** `JwtConfig`, `JwtClaims` | 인증/인가 |
| **OAuth 2.0** `OAuthConfig.github()` | GitHub 로그인 |
| **Password** `hash_password/verify_password` | 비밀번호 관리 |
| **WebSocket** `WsConnection`, `WsMessage` | 실시간 메트릭, 알림 알림 |
| **GraphQL** `GqlSchema`, `GqlField` | 복합 쿼리 (대시보드 위젯 데이터) |
| **QueryBuilder** | 동적 쿼리 생성 |
| **VaisClient** 트랜잭션 | 데이터 일관성 (서비스+의존성 동시 생성) |
| **Context** state | 요청별 사용자 정보 전달 |
| `Request.get_param/get_query` | 경로/쿼리 파라미터 추출 |
| `Response.ok/json/created/bad_request/...` | 표준 응답 |
| `ShutdownCoordinator` | Graceful shutdown |

### 3.3 vaisdb 기능

| 기능 | 사용처 |
|------|--------|
| **SQL — CREATE TABLE** | services, metrics, logs, alerts, users, incidents 테이블 |
| **SQL — INSERT/UPDATE/DELETE** | 모든 CRUD |
| **SQL — SELECT + JOIN** | 서비스+메트릭 조인, 알림+서비스 조인 |
| **SQL — ORDER BY, LIMIT, OFFSET** | 페이징, 정렬 |
| **SQL — GROUP BY** | 메트릭 집계 (avg, count, max) |
| **SQL — CREATE INDEX** | B-Tree 인덱스 (서비스명, 타임스탬프) |
| **SQL — BEGIN/COMMIT/ROLLBACK** | 서비스+의존성 동시 생성, 알림+인시던트 |
| **SQL — Prepared Statements** | 반복 쿼리 최적화 |
| **Vector — HNSW** | 로그 임베딩 인덱스 |
| **Vector — VECTOR_SEARCH** | 유사 로그 검색, 이상 탐지, 유사 인시던트 |
| **Vector — Distance Metrics** | Cosine (로그 유사도), L2 (메트릭 거리) |
| **Graph — CREATE NODE** | 서비스 노드 (label: SERVICE) |
| **Graph — CREATE EDGE** | 의존성 관계 (DEPENDS_ON, CALLS) |
| **Graph — GRAPH_TRAVERSE** | 장애 전파 경로 (multi-hop BFS) |
| **Graph — SHORTEST_PATH** | 서비스 간 최단 의존 경로 |
| **Graph — CYCLE_DETECT** | 순환 의존성 탐지 |
| **Full-Text — FULLTEXT_MATCH** | 로그 키워드 검색 (BM25) |
| **Full-Text — BOOLEAN** | AND/OR/NOT 로그 필터 |
| **Full-Text — PHRASE** | 정확한 에러 메시지 검색 |
| **Full-Text — CREATE FULLTEXT INDEX** | logs.message 컬럼 |
| **RAG — Document Ingestion** | 인시던트 보고서 → 자동 청킹+임베딩 |
| **RAG — RAG_SEARCH** | 자연어 질의 → 하이브리드 검색 |
| **RAG — Chunking** | 인시던트/로그 문서 분할 |
| **RAG — Agent Memory** | 사용자별 분석 컨텍스트 기억 |
| **Security — RLS** | 팀별 데이터 격리 |
| **Security — Audit Log** | 관리자 액션 기록 |
| **Ops — VACUUM ANALYZE** | 주기적 최적화 |
| **Ops — ANALYZE TABLE** | 통계 업데이트 |
| **Ops — health_check()** | DB 상태 모니터링 |
| **MVCC** | 동시 읽기/쓰기 격리 |
| **WAL** | 장애 복구 |

### 3.4 vais-web/VaisX 기능

| 기능 | 사용처 |
|------|--------|
| `$state()` / `createSignal` | 모든 페이지 상태 (필터, 폼 입력, 선택값) |
| `$derived()` / `createComputed` | 파생 데이터 (필터링된 목록, 통계 계산) |
| `$effect()` / `createEffect` | API 호출, WebSocket 연결, 차트 업데이트 |
| `onMount/onUnmount` | WebSocket 연결/해제, 타이머 시작/정리 |
| `onUpdate` | 차트 리렌더링 |
| **파일 기반 라우팅** | app/ 디렉토리 구조 |
| **동적 라우트** | `/services/:id`, `/incidents/:id` |
| **SSR** | 대시보드 초기 로딩 최적화 (SEO 불필요하나 FCP 개선) |
| **CSR** | 인터랙티브 페이지 (그��프, 차트) |
| **Writable Store** | 글로벌 상태 (현재 사용자, 테마, 로케일) |
| **Derived Store** | 권한 기반 UI 분기 |
| **Spring Animation** | 그래프 노드 물리 시뮬레이션 |
| **Transition** | 페이지 전환, 카드 진입/퇴장 |
| **Keyframe Animation** | 로딩 스피너, 상태 변경 하이라이트 |
| **Form Handling** | 서비스 등록, 알림 룰 편집, 로그인/가입 |
| **Form Validation** | 이메일, URL, 필수값, min/max |
| **Async Validation** | 서비스명 중복 확인 |
| **i18n** | 한국어/영어 전환 |
| **a11y** | 키보드 네비게이션, ARIA 레이블 |
| **Component Testing** | 주요 컴포넌트 단위 테스트 |
| **Snapshot Testing** | UI 회귀 방지 |
| **Event Delegation** | 대시보드 위젯 인터랙션 |
| **Custom Events** | 컴포넌트 간 통신 |

---

## 4. DB 스키마 설계

### 4.1 SQL 테이블

```sql
-- 사용자
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',  -- admin/member/viewer
    team_id INTEGER,
    oauth_provider TEXT,        -- 'github' or NULL
    oauth_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_team ON users(team_id);

-- 팀
CREATE TABLE teams (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL
);

-- 서비스
CREATE TABLE services (
    id INTEGER PRIMARY KEY,
    team_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    health_endpoint TEXT DEFAULT '/health',
    check_interval_sec INTEGER DEFAULT 60,
    status TEXT DEFAULT 'unknown',  -- up/down/degraded/unknown
    tags TEXT,                      -- comma-separated
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX idx_services_team ON services(team_id);
CREATE INDEX idx_services_status ON services(status);

-- 메트릭
CREATE TABLE metrics (
    id INTEGER PRIMARY KEY,
    service_id INTEGER NOT NULL,
    metric_name TEXT NOT NULL,      -- response_time, status_code, cpu, memory, error_rate
    value REAL NOT NULL,
    timestamp INTEGER NOT NULL,
    ttl_seconds INTEGER DEFAULT 2592000  -- 30일
);
CREATE INDEX idx_metrics_service_ts ON metrics(service_id, timestamp);
CREATE INDEX idx_metrics_name ON metrics(metric_name);

-- 로그
CREATE TABLE logs (
    id INTEGER PRIMARY KEY,
    service_id INTEGER NOT NULL,
    level TEXT NOT NULL,            -- DEBUG/INFO/WARN/ERROR/FATAL
    message TEXT NOT NULL,
    source TEXT,                    -- 소스 파일/모듈
    trace_id TEXT,                  -- 분산 추적 ID
    timestamp INTEGER NOT NULL,
    ttl_seconds INTEGER DEFAULT 604800  -- 7일
);
CREATE INDEX idx_logs_service_ts ON logs(service_id, timestamp);
CREATE INDEX idx_logs_level ON logs(level);
CREATE INDEX idx_logs_trace ON logs(trace_id);
CREATE FULLTEXT INDEX idx_logs_ft ON logs(message);

-- 알림 룰
CREATE TABLE alert_rules (
    id INTEGER PRIMARY KEY,
    team_id INTEGER NOT NULL,
    service_id INTEGER,            -- NULL = 전체 서비스
    name TEXT NOT NULL,
    condition_metric TEXT NOT NULL, -- metric_name
    condition_op TEXT NOT NULL,     -- gt/lt/eq/gte/lte
    condition_value REAL NOT NULL,
    duration_sec INTEGER DEFAULT 60,
    severity TEXT DEFAULT 'warning', -- info/warning/critical
    channel TEXT DEFAULT 'webhook',  -- webhook/email
    channel_config TEXT,            -- JSON: {url: "..."} 등
    enabled INTEGER DEFAULT 1,
    muted_until INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX idx_alerts_team ON alert_rules(team_id);

-- 인시던트
CREATE TABLE incidents (
    id INTEGER PRIMARY KEY,
    alert_rule_id INTEGER NOT NULL,
    service_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT NOT NULL,
    status TEXT DEFAULT 'open',    -- open/acknowledged/resolved
    started_at INTEGER NOT NULL,
    resolved_at INTEGER,
    created_at INTEGER NOT NULL
);
CREATE INDEX idx_incidents_service ON incidents(service_id);
CREATE INDEX idx_incidents_status ON incidents(status);

-- 감사 로그
CREATE TABLE audit_logs (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL,           -- create/update/delete/login/logout
    resource_type TEXT NOT NULL,    -- service/alert/user/...
    resource_id INTEGER,
    details TEXT,                   -- JSON
    ip_address TEXT,
    timestamp INTEGER NOT NULL
);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_ts ON audit_logs(timestamp);

-- 세션 (refresh token)
CREATE TABLE sessions (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    refresh_token TEXT NOT NULL UNIQUE,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);
CREATE INDEX idx_sessions_token ON sessions(refresh_token);
CREATE INDEX idx_sessions_user ON sessions(user_id);
```

### 4.2 Vector 인덱스

```sql
-- 로그 벡터 (이상 탐지 + 유사 검색)
CREATE TABLE log_vectors (
    id INTEGER PRIMARY KEY,
    log_id INTEGER NOT NULL,
    embedding VECTOR[256],         -- 로그 메시지 임베딩
    cluster_id INTEGER             -- 자동 클러스터 할당
);
CREATE VECTOR INDEX idx_log_vec ON log_vectors(embedding)
    USING HNSW (dimension: 256, metric: COSINE);

-- 메트릭 벡터 (이상 탐지)
CREATE TABLE metric_vectors (
    id INTEGER PRIMARY KEY,
    service_id INTEGER NOT NULL,
    window_start INTEGER NOT NULL,
    embedding VECTOR[64],          -- 시계열 패턴 임베딩
    is_anomaly INTEGER DEFAULT 0
);
CREATE VECTOR INDEX idx_metric_vec ON metric_vectors(embedding)
    USING HNSW (dimension: 64, metric: L2);

-- 인시던트 벡터 (유사 장애 검색)
CREATE TABLE incident_vectors (
    id INTEGER PRIMARY KEY,
    incident_id INTEGER NOT NULL,
    embedding VECTOR[256]
);
CREATE VECTOR INDEX idx_incident_vec ON incident_vectors(embedding)
    USING HNSW (dimension: 256, metric: COSINE);
```

### 4.3 Graph 구조

```
Node Labels:
  :SERVICE   — { service_id, name, status }
  :ENDPOINT  — { path, method }

Edge Types:
  :DEPENDS_ON   — 서비스 A → 서비스 B (A가 B에 의존)
  :CALLS        — 엔드포인트 A → 엔드포인트 B (API 호출 관계)
  :AFFECTS      — 인시던트 → 서비스 (장애 영향)
```

### 4.4 RAG 문서

```
Documents:
  - 인시던트 보고서 (incidents.description → auto-chunk)
  - 로그 집합 (시간 윈도우별 로그 번들)

Chunking: PARAGRAPH strategy, 512 tokens, 50 overlap
Memory: 사용자별 분석 세션 컨텍스트 (WORKING type, TTL 1일)
```

---

## 5. API 설계

### 5.1 REST API

```
Base: /api/v1

# Auth
POST   /auth/register          — 회원가입
POST   /auth/login             — 로그인 (JWT 발급)
POST   /auth/refresh           — 토큰 갱신
POST   /auth/logout            — 로그아웃
GET    /auth/oauth/github      — GitHub OAuth 시작
GET    /auth/oauth/github/callback — OAuth 콜백
GET    /auth/me                — 현재 사용자 정보

# Services
GET    /services               — 서비스 목록 (필터, 페이징)
POST   /services               — 서비스 등록
GET    /services/:id           — 서비스 상세
PUT    /services/:id           — 서비스 수정
DELETE /services/:id           — 서비스 삭제
GET    /services/:id/metrics   — 서비스 메트릭 (시간범위)
GET    /services/:id/logs      — 서비스 로그 (필터)
POST   /services/:id/dependencies — 의존성 추가
DELETE /services/:id/dependencies/:dep_id — 의존성 삭제

# Metrics
POST   /metrics/push           — 커스텀 메트릭 수신
GET    /metrics/aggregate      — 집계 조회 (avg, p95 등)

# Logs
POST   /logs/ingest            — 로그 수집
GET    /logs/search            — 풀텍스트 검색
GET    /logs/similar/:id       — 유사 로그 검색 (벡터)

# Alerts
GET    /alerts                 — 알림 룰 목록
POST   /alerts                 — 알림 룰 생성
PUT    /alerts/:id             — 알림 룰 수정
DELETE /alerts/:id             — 알림 룰 삭제
POST   /alerts/:id/mute        — 알림 뮤트
POST   /alerts/:id/unmute      — 알림 해제

# Incidents
GET    /incidents              — 인시던트 목록
GET    /incidents/:id          — 인시던트 상세
PUT    /incidents/:id/acknowledge — 인시던트 인지
PUT    /incidents/:id/resolve  — 인시던트 해결

# Graph
GET    /graph/services         — 서비스 의존성 그래프 데이터
GET    /graph/impact/:id       — 장애 전파 경로
GET    /graph/cycles           — 순환 의존성 탐지

# AI
POST   /ai/query               — 자연어 질의 (RAG)
GET    /ai/anomalies            — 이상 탐지 결과
GET    /ai/similar-incidents/:id — 유사 인시던트

# Admin
GET    /admin/stats             — DB 통계
POST   /admin/vacuum            — VACUUM 실행
GET    /admin/audit-logs         — 감사 로그
POST   /admin/backup             — 백업 생성
```

### 5.2 GraphQL API

```graphql
type Query {
    dashboard(timeRange: TimeRange!): Dashboard!
    service(id: ID!): Service
    services(filter: ServiceFilter, page: Pagination): ServiceConnection!
    metrics(serviceId: ID!, name: String!, range: TimeRange!): [MetricPoint!]!
    incidents(status: IncidentStatus, page: Pagination): IncidentConnection!
}

type Mutation {
    createService(input: CreateServiceInput!): Service!
    updateService(id: ID!, input: UpdateServiceInput!): Service!
    createAlertRule(input: CreateAlertInput!): AlertRule!
    acknowledgeIncident(id: ID!): Incident!
    resolveIncident(id: ID!): Incident!
}

type Dashboard {
    totalServices: Int!
    servicesUp: Int!
    servicesDown: Int!
    openIncidents: Int!
    metricsOverview: [MetricSummary!]!
    recentAlerts: [Alert!]!
}
```

### 5.3 WebSocket API

```
WS /ws/metrics    — 실시간 메트릭 스트리밍
  Client → { type: "subscribe", service_ids: [1,2,3] }
  Server → { type: "metric", service_id: 1, name: "cpu", value: 45.2, ts: ... }

WS /ws/alerts     — 실시간 알림 알림
  Server → { type: "alert", incident_id: 5, severity: "critical", ... }

WS /ws/status     — 서비스 상태 변경 알림
  Server → { type: "status_change", service_id: 2, old: "up", new: "down" }
```

---

## 6. 페이지/화면 구성

```
app/
  layout.vaisx                    — 앱 셸 (사이드바, 헤더, 알림 벨)
  page.vaisx                      — 대시보드 (메트릭 개요, 상태 카드, 최근 알림)

  services/
    page.vaisx                    — 서비스 목록 (검색, 필터, 상태 뱃지)
    [id]/page.vaisx               — 서비스 상세 (메트릭 차트, 로그, 의존성)
    new/page.vaisx                — 서비스 등록 폼

  logs/
    page.vaisx                    — 로그 탐색 (검색, 필터, 타임라인)

  alerts/
    page.vaisx                    — 알림 룰 관리
    new/page.vaisx                — 알림 룰 생성 폼

  incidents/
    page.vaisx                    — 인시���트 목록
    [id]/page.vaisx               — 인시던트 상세 + 타임라인

  graph/
    page.vaisx                    — 서비스 의존성 그래프 시각화

  ai/
    page.vaisx                    — AI 질의 인터페이스 + 이상 탐지 결과

  settings/
    page.vaisx                    — 일반 설정
    team/page.vaisx               — 팀 관리
    backup/page.vaisx             — 백업/복원

  auth/
    login/page.vaisx              — 로그인 (JWT + OAuth)
    register/page.vaisx           — 회원가입

  components/
    Sidebar.vaisx                 — 사이드바 네비게이션
    Header.vaisx                  — 상단 헤더 (알림 벨, 사용자 메뉴)
    MetricChart.vaisx             — 시계열 차트 위젯
    StatusBadge.vaisx             — UP/DOWN/DEGRADED 뱃지
    ServiceCard.vaisx             — 서비스 상태 카드
    AlertRuleForm.vaisx           — 알림 룰 편집 폼
    IncidentTimeline.vaisx        — 인시던트 이벤트 타임라인
    GraphCanvas.vaisx             — 서비스 그래프 캔버스 (spring 물리)
    SearchBar.vaisx               — 통합 검색 바
    Pagination.vaisx              — 페이지네이션
    Modal.vaisx                   — 모달 다이얼로그
    Toast.vaisx                   — 토스트 알림
    LoadingSpinner.vaisx          — 로딩 스피너
    DataTable.vaisx               — 데이터 테이블 (정렬, 필터)
    TimeRangePicker.vaisx         — 시간 범위 선택기

  stores/
    auth.vais                     — 인증 상태 (사용자, 토큰)
    theme.vais                    — 테마 (다크/라이트)
    locale.vais                   — i18n 로케일
    notifications.vais            — 알림 큐
    websocket.vais                — WebSocket 연결 관리
```

---

## 7. 구현 단계별 계획

### Phase 1: 기반 구조 (Foundation)
1. 프로젝트 폴더 구조 + CLAUDE.md
2. DB 스키마 생성 (SQL 테이블 + 인덱스)
3. vais-server 초기화 (App, Config, 미들웨어)
4. 인증 시스템 (JWT + OAuth + 패스워드)
5. 사용자/팀 CRUD API

### Phase 2: 핵심 기능 (Core)
6. 서비스 CRUD API + DB
7. 메트릭 수집/조회 API
8. 헬스체크 워커 (async spawn + 채널)
9. 로그 수집/검색 API (Full-Text)
10. 알림 룰 CRUD + 평가 엔진

### Phase 3: AI/고급 기능 (Advanced)
11. 벡터 임베딩 + 유사 검색 (로그, 인시던트)
12. 서비스 그래프 (Graph 엔진 — 노드/엣지/순회)
13. RAG 파이프라인 (문서 청킹 + 하이브리드 검색)
14. 이상 탐지 엔진 (메트릭 벡터 anomaly)
15. ���시던트 관리 + 타임라인

### Phase 4: ��론트엔드 (Frontend)
16. 앱 셸 + 라우팅 + 스토어 + i18n 기반
17. 인증 페이지 (로그인/가입/OAuth)
18. 대시보드 + 실시간 WebSocket
19. 서비스 관리 페이지 (CRUD + 폼)
20. 로그 탐색 + 검색 UI
21. 알림/인시던트 관리 UI
22. 서비스 그래프 시각화 (Spring 물리)
23. AI 질의 인터페이스

### Phase 5: 운영/품질 (Operations)
24. GraphQL API
25. 설정/백업/감사로그 UI
26. 컴포넌트 테스트 + 스냅샷 테스트
27. 통합 테스트

---

## 부록: 프로젝트 디렉토리 구조

```
vais-monitor/
  server/
    src/
      main.vais           — 서버 진입점, 라우팅
      config.vais         — 서버/DB 설정
      db.vais             — DB 스키마 생성, 마이그레이션
      seed.vais           — 초기 데이터 시딩
      auth.vais           — 인증 (JWT, OAuth, 패스워드)
      middleware.vais     — 커스텀 미들웨어 (auth guard)
      api/
        services.vais     — 서비스 API 핸들러
        metrics.vais      — 메트릭 API 핸들러
        logs.vais         — 로그 API 핸들러
        alerts.vais       — 알림 API 핸들러
        incidents.vais    — 인시던트 API 핸들러
        graph.vais        — 그래프 API 핸들러
        ai.vais           — AI/RAG API 핸들러
        admin.vais        — 관리자 API 핸들러
        users.vais        — 사용자 API 핸���러
      models/
        service.vais      — Service 모델 + Repository<Service>
        metric.vais       — Metric 모델 + Collector<Metric>
        log_entry.vais    — LogEntry 모델 + Searchable
        alert.vais        — AlertRule 모델
        incident.vais     — Incident 모델
        user.vais         — User 모델
      workers/
        healthcheck.vais  — 헬스체크 워커 (async spawn)
        alert_eval.vais   — 알림 평가 워커
        metric_agg.vais   — 메트릭 집계 워커
        anomaly.vais      — 이상 탐지 워커
      graph/
        service_graph.vais — 서비스 의존성 그래프 관리
      rag/
        pipeline.vais     — RAG 파이프라인 (청킹, 임베딩, 검색)
        embedding.vais    — 임베딩 생성 (간이 TF-IDF 벡터)
      graphql/
        schema.vais       — GraphQL 스키마 정의
        resolvers.vais    — 리졸버 구현
      websocket/
        handler.vais      — WebSocket 핸들러 (메트릭, 알림, 상태)
        rooms.vais        — 룸 관리 (구독/해제)
      runtime.vais        — 외부 함수 선언 (X F)
  web/
    index.html            — SPA 진입점
    style.css             — 글로벌 스타일
    app/
      layout.vaisx        — 앱 셸
      page.vaisx          — 대시보드
      services/...        — 서비스 페이지
      logs/...            — 로그 페이지
      alerts/...          — 알림 페이지
      incidents/...       — 인시던트 페이지
      graph/...           — 그래프 페이지
      ai/...              — AI 페이지
      settings/...        — 설정 페이지
      auth/...            — 인증 페이지
      components/...      — 공통 컴포넌트
      stores/...          — 글로벌 스토어
    locales/
      ko.json             — 한국어
      en.json             — 영어
    tests/
      components/         — 컴포넌트 테스트
      snapshots/          — 스냅샷 테스트
  PRD.md
  ROADMAP.md
  CLAUDE.md
```
