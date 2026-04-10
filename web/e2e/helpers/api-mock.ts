import type { Page, Route } from '@playwright/test'

// ---------------------------------------------------------------------------
// 타입 정의
// ---------------------------------------------------------------------------

/** mock API 응답 바디 타입 */
export type MockResponseBody = Record<string, unknown> | unknown[]

/** mockApiResponse 옵션 */
export interface MockOptions {
  /** HTTP 상태 코드 (기본값: 200) */
  status?: number
  /** 응답 헤더 */
  headers?: Record<string, string>
  /** HTTP 메서드 필터 (기본값: 모든 메서드) */
  method?: string
}

// ---------------------------------------------------------------------------
// 기본 mock 데이터
// ---------------------------------------------------------------------------

const DEFAULT_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
}

const MOCK_USER = {
  id: 1,
  email: 'test@vais-monitor.dev',
  name: 'Test User',
  role: 'member',
  team_id: 1,
}

const MOCK_ACCESS_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZW1haWwiOiJ0ZXN0QHZhaXMtbW9uaXRvci5kZXYiLCJyb2xlIjoibWVtYmVyIiwiZXhwIjo5OTk5OTk5OTk5fQ.test-signature'

const MOCK_REFRESH_TOKEN = 'test-refresh-token-xyz'

const MOCK_SERVICES = [
  {
    id: 1,
    team_id: 1,
    name: 'API Gateway',
    url: 'http://api.example.com',
    status: 'up',
    tags: 'backend,api',
    check_interval_sec: 30,
  },
  {
    id: 2,
    team_id: 1,
    name: 'Database',
    url: 'http://db.example.com',
    status: 'up',
    tags: 'database',
    check_interval_sec: 60,
  },
]

const MOCK_METRICS = [
  { id: 1, service_id: 1, name: 'cpu_usage', value: 45.5, timestamp: Date.now() },
  { id: 2, service_id: 1, name: 'memory_usage', value: 62.3, timestamp: Date.now() },
]

const MOCK_ALERTS = [
  {
    id: 1,
    service_id: 1,
    name: 'High CPU Alert',
    condition_metric: 'cpu_usage',
    condition_op: 'gt',
    condition_value: 90,
    severity: 'critical',
    enabled: true,
  },
]

const MOCK_INCIDENTS = [
  {
    id: 1,
    alert_id: 1,
    service_id: 1,
    status: 'open',
    triggered_at: Math.floor(Date.now() / 1000) - 3600,
    acknowledged_at: null,
    resolved_at: null,
  },
]

// ---------------------------------------------------------------------------
// 핵심 mock 유틸리티
// ---------------------------------------------------------------------------

/**
 * 특정 API 경로에 대한 응답을 mock합니다.
 * page.route()의 래퍼로, JSON 응답을 간편하게 설정합니다.
 *
 * @param page     Playwright Page 인스턴스
 * @param path     mock할 API 경로 (예: '/api/v1/auth/login', glob 패턴 가능)
 * @param response 응답으로 반환할 JSON 객체
 * @param options  상태 코드, 헤더, 메서드 필터 옵션
 *
 * @example
 * await mockApiResponse(page, '/api/v1/auth/login', { user: {...}, access_token: '...' }, { status: 200 })
 */
export async function mockApiResponse(
  page: Page,
  path: string,
  response: MockResponseBody,
  options: MockOptions = {},
): Promise<void> {
  const { status = 200, headers = {}, method } = options

  await page.route(path, async (route: Route) => {
    // 메서드 필터가 지정된 경우 해당 메서드만 mock
    if (method && route.request().method() !== method.toUpperCase()) {
      await route.continue()
      return
    }

    await route.fulfill({
      status,
      headers: { ...DEFAULT_HEADERS, ...headers },
      body: JSON.stringify(response),
    })
  })
}

// ---------------------------------------------------------------------------
// 인증 API mock 세트
// ---------------------------------------------------------------------------

/**
 * 인증 관련 API 엔드포인트 전체를 mock합니다.
 *
 * 대상 엔드포인트:
 * - POST /api/v1/auth/login
 * - POST /api/v1/auth/register
 * - POST /api/v1/auth/logout
 * - POST /api/v1/auth/refresh
 * - GET  /api/v1/auth/me
 *
 * @param page Playwright Page 인스턴스
 */
export async function mockAuthApi(page: Page): Promise<void> {
  // POST /api/v1/auth/login — 성공 응답
  await mockApiResponse(
    page,
    '/api/v1/auth/login',
    {
      user: MOCK_USER,
      access_token: MOCK_ACCESS_TOKEN,
      refresh_token: MOCK_REFRESH_TOKEN,
    },
    { status: 200, method: 'POST' },
  )

  // POST /api/v1/auth/register — 성공 응답
  await mockApiResponse(
    page,
    '/api/v1/auth/register',
    {
      user: MOCK_USER,
      access_token: MOCK_ACCESS_TOKEN,
      refresh_token: MOCK_REFRESH_TOKEN,
    },
    { status: 201, method: 'POST' },
  )

  // POST /api/v1/auth/logout — 성공 응답
  await mockApiResponse(
    page,
    '/api/v1/auth/logout',
    { message: 'Logged out' },
    { status: 200, method: 'POST' },
  )

  // POST /api/v1/auth/refresh — 새 토큰 발급
  await mockApiResponse(
    page,
    '/api/v1/auth/refresh',
    { access_token: MOCK_ACCESS_TOKEN },
    { status: 200, method: 'POST' },
  )

  // GET /api/v1/auth/me — 현재 사용자 정보
  await mockApiResponse(
    page,
    '/api/v1/auth/me',
    { user: MOCK_USER },
    { status: 200, method: 'GET' },
  )
}

// ---------------------------------------------------------------------------
// 서비스 API mock 세트
// ---------------------------------------------------------------------------

/**
 * 서비스 CRUD API 엔드포인트 전체를 mock합니다.
 *
 * 대상 엔드포인트:
 * - GET    /api/v1/services
 * - POST   /api/v1/services
 * - GET    /api/v1/services/:id
 * - PUT    /api/v1/services/:id
 * - DELETE /api/v1/services/:id
 *
 * @param page Playwright Page 인스턴스
 */
export async function mockServiceApi(page: Page): Promise<void> {
  // GET /api/v1/services — 목록 조회
  await mockApiResponse(
    page,
    '/api/v1/services',
    {
      services: MOCK_SERVICES,
      total: MOCK_SERVICES.length,
      page: 1,
      limit: 20,
    },
    { status: 200, method: 'GET' },
  )

  // POST /api/v1/services — 서비스 생성
  await mockApiResponse(
    page,
    '/api/v1/services',
    { service: MOCK_SERVICES[0] },
    { status: 201, method: 'POST' },
  )

  // GET /api/v1/services/:id — 서비스 상세 조회 (glob 패턴)
  await mockApiResponse(
    page,
    '/api/v1/services/*',
    {
      service: MOCK_SERVICES[0],
      dependencies: [],
      dependents: [],
    },
    { status: 200, method: 'GET' },
  )

  // PUT /api/v1/services/:id — 서비스 수정
  await mockApiResponse(
    page,
    '/api/v1/services/*',
    { service: { ...MOCK_SERVICES[0], check_interval_sec: 60 } },
    { status: 200, method: 'PUT' },
  )

  // DELETE /api/v1/services/:id — 서비스 삭제
  await mockApiResponse(
    page,
    '/api/v1/services/*',
    { message: 'Service deleted successfully', id: 1 },
    { status: 200, method: 'DELETE' },
  )

  // GET /api/v1/metrics — 메트릭 조회
  await mockApiResponse(
    page,
    '/api/v1/metrics*',
    {
      metrics: MOCK_METRICS,
      total: MOCK_METRICS.length,
      page: 1,
      limit: 100,
    },
    { status: 200 },
  )

  // GET /api/v1/alerts — 알림 룰 목록
  await mockApiResponse(
    page,
    '/api/v1/alerts',
    {
      alerts: MOCK_ALERTS,
      total: MOCK_ALERTS.length,
      page: 1,
      limit: 20,
    },
    { status: 200, method: 'GET' },
  )

  // GET /api/v1/incidents — 인시던트 목록
  await mockApiResponse(
    page,
    '/api/v1/incidents*',
    {
      incidents: MOCK_INCIDENTS,
      total: MOCK_INCIDENTS.length,
      page: 1,
      limit: 20,
    },
    { status: 200, method: 'GET' },
  )
}

// ---------------------------------------------------------------------------
// WebSocket mock
// ---------------------------------------------------------------------------

/**
 * WebSocket 연결을 mock합니다.
 * Playwright의 page.routeWebSocket()을 사용하여 ws:// 경로를 가로챕니다.
 *
 * 대상 엔드포인트:
 * - ws://localhost:8080/ws/metrics
 * - ws://localhost:8080/ws/alerts
 * - ws://localhost:8080/ws/status
 *
 * @param page Playwright Page 인스턴스
 */
export async function mockWebSocket(page: Page): Promise<void> {
  // /ws/metrics — 실시간 메트릭 스트림 mock
  await page.routeWebSocket('/ws/metrics', (ws) => {
    ws.onopen(() => {
      // 연결 직후 초기 메트릭 데이터 전송
      ws.send(
        JSON.stringify({
          type: 'metrics',
          data: MOCK_METRICS,
          timestamp: Date.now(),
        }),
      )
    })

    ws.onmessage(() => {
      // 클라이언트 메시지에 응답 (구독 요청 등)
      ws.send(
        JSON.stringify({
          type: 'metrics',
          data: MOCK_METRICS,
          timestamp: Date.now(),
        }),
      )
    })
  })

  // /ws/alerts — 실시간 알림 스트림 mock
  await page.routeWebSocket('/ws/alerts', (ws) => {
    ws.onopen(() => {
      ws.send(
        JSON.stringify({
          type: 'alerts',
          data: MOCK_ALERTS,
          timestamp: Date.now(),
        }),
      )
    })

    ws.onmessage(() => {
      ws.send(
        JSON.stringify({
          type: 'alerts',
          data: MOCK_ALERTS,
          timestamp: Date.now(),
        }),
      )
    })
  })

  // /ws/status — 서비스 상태 스트림 mock
  await page.routeWebSocket('/ws/status', (ws) => {
    ws.onopen(() => {
      ws.send(
        JSON.stringify({
          type: 'status',
          data: MOCK_SERVICES.map((s) => ({ id: s.id, status: s.status })),
          timestamp: Date.now(),
        }),
      )
    })

    ws.onmessage(() => {
      ws.send(
        JSON.stringify({
          type: 'status',
          data: MOCK_SERVICES.map((s) => ({ id: s.id, status: s.status })),
          timestamp: Date.now(),
        }),
      )
    })
  })
}
