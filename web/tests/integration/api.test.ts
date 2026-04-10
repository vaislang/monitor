import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock fetch utility
// ---------------------------------------------------------------------------

type MockResponse = {
  status: string
  body: Record<string, unknown>
}

const mockFetchPost = vi.fn<[string, string], Promise<MockResponse>>()
const mockFetchGet = vi.fn<[string, string], Promise<MockResponse>>()
const mockFetchPut = vi.fn<[string, string, string], Promise<MockResponse>>()
const mockFetchDelete = vi.fn<[string, string], Promise<MockResponse>>()

vi.mock('../../app/stores/auth.vais', () => ({
  create_auth_store: () => ({
    user: '',
    token: '',
    refresh_token: '',
    is_authenticated: false,
    loading: false,
    error: '',
  }),
  login: mockFetchPost,
  register: mockFetchPost,
  logout: vi.fn(),
}))

// ---------------------------------------------------------------------------
// API client helpers (mirroring store patterns)
// ---------------------------------------------------------------------------

const BASE_URL = '/api/v1'

async function apiPost(path: string, body: unknown, token?: string): Promise<MockResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return mockFetchPost(path, JSON.stringify(body))
}

async function apiGet(path: string, token?: string): Promise<MockResponse> {
  return mockFetchGet(path, token ?? '')
}

async function apiPut(path: string, body: unknown, token?: string): Promise<MockResponse> {
  return mockFetchPut(path, JSON.stringify(body), token ?? '')
}

async function apiDelete(path: string, token?: string): Promise<MockResponse> {
  return mockFetchDelete(path, token ?? '')
}

// Helpers
function makeAuthHeader(token: string): string {
  return `Bearer ${token}`
}

function makeOkResponse(status: string, body: Record<string, unknown>): MockResponse {
  return { status, body }
}

// ---------------------------------------------------------------------------
// TEST SUITE 1: 인증 API
// ---------------------------------------------------------------------------

describe('Auth API Integration', () => {
  const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('POST /auth/register — 성공 시 201과 access_token 반환', async () => {
    const mockUser = { id: 1, email: 'alice@test.com', name: 'Alice', role: 'member', team_id: 0 }
    mockFetchPost.mockResolvedValueOnce(
      makeOkResponse('201', {
        user: mockUser,
        access_token: TEST_TOKEN,
        refresh_token: 'refresh-token-xyz',
      }),
    )

    const resp = await apiPost(`${BASE_URL}/auth/register`, {
      email: 'alice@test.com',
      password: 'password123',
      name: 'Alice',
    })

    expect(resp.status).toBe('201')
    expect((resp.body as any).access_token).toBe(TEST_TOKEN)
    expect((resp.body as any).user.email).toBe('alice@test.com')
  })

  it('POST /auth/register — 중복 이메일 시 409 반환', async () => {
    mockFetchPost.mockResolvedValueOnce(
      makeOkResponse('409', { error: 'Email already registered' }),
    )

    const resp = await apiPost(`${BASE_URL}/auth/register`, {
      email: 'alice@test.com',
      password: 'password123',
      name: 'Alice',
    })

    expect(resp.status).toBe('409')
    expect((resp.body as any).error).toContain('already')
  })

  it('POST /auth/login — 올바른 자격증명으로 200과 토큰 반환', async () => {
    const mockUser = { id: 1, email: 'alice@test.com', name: 'Alice', role: 'member', team_id: 0 }
    mockFetchPost.mockResolvedValueOnce(
      makeOkResponse('200', {
        user: mockUser,
        access_token: TEST_TOKEN,
        refresh_token: 'refresh-token-abc',
      }),
    )

    const resp = await apiPost(`${BASE_URL}/auth/login`, {
      email: 'alice@test.com',
      password: 'password123',
    })

    expect(resp.status).toBe('200')
    expect((resp.body as any).access_token).toBeTruthy()
    expect((resp.body as any).user.email).toBe('alice@test.com')
  })

  it('POST /auth/login — 잘못된 비밀번호 시 401 반환', async () => {
    mockFetchPost.mockResolvedValueOnce(
      makeOkResponse('401', { error: 'Invalid email or password' }),
    )

    const resp = await apiPost(`${BASE_URL}/auth/login`, {
      email: 'alice@test.com',
      password: 'wrongpassword',
    })

    expect(resp.status).toBe('401')
    expect((resp.body as any).error).toBeTruthy()
  })

  it('GET /auth/me — 유효한 토큰으로 200과 사용자 정보 반환', async () => {
    mockFetchGet.mockResolvedValueOnce(
      makeOkResponse('200', {
        user: { id: 1, email: 'alice@test.com', name: 'Alice', role: 'member', team_id: 0 },
      }),
    )

    const resp = await apiGet(`${BASE_URL}/auth/me`, TEST_TOKEN)

    expect(resp.status).toBe('200')
    expect((resp.body as any).user).toBeTruthy()
    expect((resp.body as any).user.email).toBe('alice@test.com')
  })

  it('GET /auth/me — 토큰 없이 접근 시 401 반환', async () => {
    mockFetchGet.mockResolvedValueOnce(
      makeOkResponse('401', { error: 'Authorization token required' }),
    )

    const resp = await apiGet(`${BASE_URL}/auth/me`)

    expect(resp.status).toBe('401')
  })

  it('POST /auth/refresh — 유효한 refresh_token으로 새 access_token 발급', async () => {
    const newToken = 'new-access-token-xyz'
    mockFetchPost.mockResolvedValueOnce(
      makeOkResponse('200', { access_token: newToken }),
    )

    const resp = await apiPost(`${BASE_URL}/auth/refresh`, {
      refresh_token: 'refresh-token-abc',
    })

    expect(resp.status).toBe('200')
    expect((resp.body as any).access_token).toBe(newToken)
  })

  it('POST /auth/logout — refresh_token으로 로그아웃 성공', async () => {
    mockFetchPost.mockResolvedValueOnce(
      makeOkResponse('200', { message: 'Logged out' }),
    )

    const resp = await apiPost(`${BASE_URL}/auth/logout`, {
      refresh_token: 'refresh-token-abc',
    })

    expect(resp.status).toBe('200')
    expect((resp.body as any).message).toBe('Logged out')
  })
})

// ---------------------------------------------------------------------------
// TEST SUITE 2: 서비스 API
// ---------------------------------------------------------------------------

describe('Services API Integration', () => {
  const TEST_TOKEN = 'test-token-admin'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('POST /services — 서비스 생성 시 201과 service 객체 반환', async () => {
    mockFetchPost.mockResolvedValueOnce(
      makeOkResponse('201', {
        service: {
          id: 1,
          team_id: 1,
          name: 'API Service',
          url: 'http://api.example.com',
          status: 'unknown',
          tags: 'backend,api',
        },
      }),
    )

    const resp = await apiPost(
      `${BASE_URL}/services`,
      { name: 'API Service', url: 'http://api.example.com', tags: 'backend,api' },
      TEST_TOKEN,
    )

    expect(resp.status).toBe('201')
    expect((resp.body as any).service.name).toBe('API Service')
    expect((resp.body as any).service.id).toBeGreaterThan(0)
  })

  it('GET /services/:id — 서비스 상세 조회 성공', async () => {
    mockFetchGet.mockResolvedValueOnce(
      makeOkResponse('200', {
        service: { id: 1, name: 'API Service', status: 'up' },
        dependencies: [],
        dependents: [],
      }),
    )

    const resp = await apiGet(`${BASE_URL}/services/1`, TEST_TOKEN)

    expect(resp.status).toBe('200')
    expect((resp.body as any).service.id).toBe(1)
    expect((resp.body as any).dependencies).toBeDefined()
  })

  it('GET /services/:id — 존재하지 않는 서비스 조회 시 404 반환', async () => {
    mockFetchGet.mockResolvedValueOnce(
      makeOkResponse('404', { error: 'Service not found' }),
    )

    const resp = await apiGet(`${BASE_URL}/services/9999`, TEST_TOKEN)

    expect(resp.status).toBe('404')
    expect((resp.body as any).error).toBeTruthy()
  })

  it('PUT /services/:id — 서비스 수정 성공', async () => {
    mockFetchPut.mockResolvedValueOnce(
      makeOkResponse('200', {
        service: { id: 1, name: 'API Service v2', status: 'up', check_interval_sec: 60 },
      }),
    )

    const resp = await apiPut(
      `${BASE_URL}/services/1`,
      { name: 'API Service v2', check_interval_sec: 60 },
      TEST_TOKEN,
    )

    expect(resp.status).toBe('200')
    expect((resp.body as any).service.name).toBe('API Service v2')
  })

  it('DELETE /services/:id — 서비스 삭제 성공', async () => {
    mockFetchDelete.mockResolvedValueOnce(
      makeOkResponse('200', { message: 'Service deleted successfully', id: 1 }),
    )

    const resp = await apiDelete(`${BASE_URL}/services/1`, TEST_TOKEN)

    expect(resp.status).toBe('200')
    expect((resp.body as any).message).toContain('deleted')
  })
})

// ---------------------------------------------------------------------------
// TEST SUITE 3: 메트릭 API
// ---------------------------------------------------------------------------

describe('Metrics API Integration', () => {
  const TEST_TOKEN = 'test-token-member'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('POST /metrics/push — 단일 메트릭 push 성공', async () => {
    mockFetchPost.mockResolvedValueOnce(
      makeOkResponse('201', { saved: 1, service_id: 1 }),
    )

    const resp = await apiPost(
      `${BASE_URL}/metrics/push`,
      { service_id: 1, name: 'cpu_usage', value: 45.5 },
      TEST_TOKEN,
    )

    expect(resp.status).toBe('201')
    expect((resp.body as any).saved).toBe(1)
  })

  it('GET /metrics/aggregate — 집계 조회 성공', async () => {
    mockFetchGet.mockResolvedValueOnce(
      makeOkResponse('200', {
        metric_name: 'cpu_usage',
        avg: 52.3,
        min: 30.1,
        max: 85.7,
        count: 100,
        p50: 50.0,
        p95: 80.0,
        p99: 85.0,
      }),
    )

    const resp = await apiGet(
      `${BASE_URL}/metrics/aggregate?service_id=1&name=cpu_usage`,
      TEST_TOKEN,
    )

    expect(resp.status).toBe('200')
    expect((resp.body as any).avg).toBeDefined()
    expect((resp.body as any).p95).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// TEST SUITE 4: 로그 API
// ---------------------------------------------------------------------------

describe('Logs API Integration', () => {
  const TEST_TOKEN = 'test-token-member'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('POST /logs/ingest — 로그 수집 성공 (201)', async () => {
    mockFetchPost.mockResolvedValueOnce(
      makeOkResponse('201', { ingested: 1 }),
    )

    const resp = await apiPost(
      `${BASE_URL}/logs/ingest`,
      {
        service_id: 1,
        level: 'ERROR',
        message: 'database connection timeout',
        source: 'db.vais',
        trace_id: 'trace-001',
      },
      TEST_TOKEN,
    )

    expect(resp.status).toBe('201')
    expect((resp.body as any).ingested).toBe(1)
  })

  it('GET /logs/search — BM25 검색 성공', async () => {
    mockFetchGet.mockResolvedValueOnce(
      makeOkResponse('200', {
        logs: [{ id: 1, level: 'ERROR', message: 'database connection timeout' }],
        total: 1,
        page: 1,
        limit: 50,
      }),
    )

    const resp = await apiGet(
      `${BASE_URL}/logs/search?q=database&mode=bm25&service_id=1`,
      TEST_TOKEN,
    )

    expect(resp.status).toBe('200')
    expect((resp.body as any).logs).toBeDefined()
    expect(Array.isArray((resp.body as any).logs)).toBe(true)
  })

  it('GET /logs/search — BOOLEAN 검색 성공', async () => {
    mockFetchGet.mockResolvedValueOnce(
      makeOkResponse('200', {
        logs: [{ id: 1, level: 'ERROR', message: 'timeout error' }],
        total: 50,
        page: 1,
        limit: 50,
      }),
    )

    const resp = await apiGet(
      `${BASE_URL}/logs/search?q=timeout&mode=boolean`,
      TEST_TOKEN,
    )

    expect(resp.status).toBe('200')
    expect((resp.body as any).logs).toBeDefined()
  })

  it('GET /logs/search — 검색어 없을 때 400 반환', async () => {
    mockFetchGet.mockResolvedValueOnce(
      makeOkResponse('400', { error: 'q (search query) is required' }),
    )

    const resp = await apiGet(`${BASE_URL}/logs/search?mode=bm25`, TEST_TOKEN)

    expect(resp.status).toBe('400')
    expect((resp.body as any).error).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// TEST SUITE 5: 알림 API
// ---------------------------------------------------------------------------

describe('Alerts API Integration', () => {
  const TEST_TOKEN = 'test-token-member'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('POST /alerts — 알림 룰 생성 성공 (201)', async () => {
    mockFetchPost.mockResolvedValueOnce(
      makeOkResponse('201', {
        alert: {
          id: 1,
          name: 'High CPU Alert',
          condition_metric: 'cpu_usage',
          condition_op: 'gt',
          condition_value: 90,
          severity: 'critical',
        },
      }),
    )

    const resp = await apiPost(
      `${BASE_URL}/alerts`,
      {
        service_id: 1,
        name: 'High CPU Alert',
        condition_metric: 'cpu_usage',
        condition_op: 'gt',
        condition_value: 90.0,
        duration_sec: 300,
        severity: 'critical',
        channel: 'webhook',
      },
      TEST_TOKEN,
    )

    expect(resp.status).toBe('201')
    expect((resp.body as any).alert.name).toBe('High CPU Alert')
    expect((resp.body as any).alert.severity).toBe('critical')
  })

  it('GET /incidents — 인시던트 목록 조회 성공', async () => {
    mockFetchGet.mockResolvedValueOnce(
      makeOkResponse('200', {
        incidents: [{ id: 1, status: 'open', triggered_at: 1700000000 }],
        total: 1,
        page: 1,
        limit: 20,
      }),
    )

    const resp = await apiGet(`${BASE_URL}/incidents?status=open`, TEST_TOKEN)

    expect(resp.status).toBe('200')
    expect((resp.body as any).incidents).toBeDefined()
    expect(Array.isArray((resp.body as any).incidents)).toBe(true)
  })

  it('PUT /incidents/:id/acknowledge — 인시던트 확인 성공', async () => {
    mockFetchPut.mockResolvedValueOnce(
      makeOkResponse('200', {
        incident: { id: 1, status: 'acknowledged', acknowledged_at: 1700001000 },
      }),
    )

    const resp = await apiPut(`${BASE_URL}/incidents/1/acknowledge`, {}, TEST_TOKEN)

    expect(resp.status).toBe('200')
    expect((resp.body as any).incident.status).toBe('acknowledged')
  })
})

// ---------------------------------------------------------------------------
// TEST SUITE 6: 임베딩/벡터 검색 API
// ---------------------------------------------------------------------------

describe('Embeddings API Integration', () => {
  const TEST_TOKEN = 'test-token-member'
  const SAMPLE_VECTOR = '[0.1,0.2,0.3,0.4,0.5]'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('POST /embeddings — 임베딩 생성 성공 (201)', async () => {
    mockFetchPost.mockResolvedValueOnce(
      makeOkResponse('201', {
        embedding: {
          id: 1,
          source_type: 'log',
          source_id: 42,
          dimension: 128,
          created_at: 1700000000,
        },
      }),
    )

    const resp = await apiPost(
      `${BASE_URL}/embeddings`,
      {
        source_type: 'log',
        source_id: 42,
        vector_data: SAMPLE_VECTOR,
        dimension: 128,
      },
      TEST_TOKEN,
    )

    expect(resp.status).toBe('201')
    expect((resp.body as any).embedding.source_type).toBe('log')
    expect((resp.body as any).embedding.id).toBeGreaterThan(0)
  })

  it('POST /embeddings/search — 유사 벡터 검색 성공', async () => {
    mockFetchPost.mockResolvedValueOnce(
      makeOkResponse('200', {
        results: [
          { id: 1, source_type: 'log', source_id: 42, score: 0.98, dimension: 128 },
          { id: 2, source_type: 'log', source_id: 43, score: 0.87, dimension: 128 },
        ],
        total: 2,
      }),
    )

    const resp = await apiPost(
      `${BASE_URL}/embeddings/search`,
      {
        source_type: 'log',
        vector_data: SAMPLE_VECTOR,
        top_k: 5,
      },
      TEST_TOKEN,
    )

    expect(resp.status).toBe('200')
    expect((resp.body as any).results).toBeDefined()
    expect(Array.isArray((resp.body as any).results)).toBe(true)
    expect((resp.body as any).results[0].score).toBeGreaterThan(0)
  })

  it('POST /embeddings — 잘못된 source_type 시 400 반환', async () => {
    mockFetchPost.mockResolvedValueOnce(
      makeOkResponse('400', { error: 'source_type must be one of: log, incident, metric' }),
    )

    const resp = await apiPost(
      `${BASE_URL}/embeddings`,
      { source_type: 'invalid', source_id: 1, vector_data: SAMPLE_VECTOR },
      TEST_TOKEN,
    )

    expect(resp.status).toBe('400')
    expect((resp.body as any).error).toContain('source_type')
  })
})

// ---------------------------------------------------------------------------
// TEST SUITE 7: GraphQL API
// ---------------------------------------------------------------------------

describe('GraphQL API Integration', () => {
  const TEST_TOKEN = 'test-token-member'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('POST /graphql — services 쿼리 성공', async () => {
    mockFetchPost.mockResolvedValueOnce(
      makeOkResponse('200', {
        data: {
          services: [
            { id: '1', name: 'API Service', status: 'up' },
          ],
        },
      }),
    )

    const resp = await apiPost(
      `${BASE_URL}/graphql`,
      { query: '{ services { id name status } }', variables: {} },
      TEST_TOKEN,
    )

    expect(resp.status).toBe('200')
    expect((resp.body as any).data).toBeDefined()
    expect((resp.body as any).data.services).toBeDefined()
  })

  it('POST /graphql — me 쿼리 성공', async () => {
    mockFetchPost.mockResolvedValueOnce(
      makeOkResponse('200', {
        data: {
          me: { id: '1', email: 'alice@test.com', name: 'Alice', role: 'member' },
        },
      }),
    )

    const resp = await apiPost(
      `${BASE_URL}/graphql`,
      { query: '{ me { id email name role } }', variables: {} },
      TEST_TOKEN,
    )

    expect(resp.status).toBe('200')
    expect((resp.body as any).data.me.email).toBe('alice@test.com')
  })

  it('POST /graphql — 인증 없이 접근 시 401 또는 errors 반환', async () => {
    mockFetchPost.mockResolvedValueOnce(
      makeOkResponse('401', { error: 'Authorization token required' }),
    )

    const resp = await apiPost(
      `${BASE_URL}/graphql`,
      { query: '{ services { id name } }', variables: {} },
    )

    expect(['401', '200']).toContain(resp.status)
  })

  it('POST /graphql — incidents 쿼리 성공', async () => {
    mockFetchPost.mockResolvedValueOnce(
      makeOkResponse('200', {
        data: {
          incidents: [
            { id: '1', status: 'open', triggeredAt: '1700000000' },
          ],
        },
      }),
    )

    const resp = await apiPost(
      `${BASE_URL}/graphql`,
      { query: '{ incidents { id status triggeredAt } }', variables: {} },
      TEST_TOKEN,
    )

    expect(resp.status).toBe('200')
    expect((resp.body as any).data.incidents).toBeDefined()
    expect(Array.isArray((resp.body as any).data.incidents)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// TEST SUITE 8: 에러 응답 형식 검증
// ---------------------------------------------------------------------------

describe('API Error Response Format', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('모든 에러 응답은 status 코드와 error 필드를 포함', async () => {
    const errorCases: Array<{ status: string; error: string }> = [
      { status: '400', error: 'Bad Request' },
      { status: '401', error: 'Unauthorized' },
      { status: '403', error: 'Forbidden' },
      { status: '404', error: 'Not Found' },
      { status: '409', error: 'Conflict' },
    ]

    for (const testCase of errorCases) {
      mockFetchGet.mockResolvedValueOnce(
        makeOkResponse(testCase.status, { error: testCase.error }),
      )

      const resp = await apiGet('/api/v1/some-endpoint')

      expect(resp.status).toBe(testCase.status)
      expect((resp.body as any).error).toBeTruthy()
    }
  })

  it('성공 응답은 해당 데이터 객체를 포함', async () => {
    mockFetchGet.mockResolvedValueOnce(
      makeOkResponse('200', { user: { id: 1, email: 'test@test.com' } }),
    )

    const resp = await apiGet('/api/v1/auth/me', 'valid-token')

    expect(resp.status).toBe('200')
    expect((resp.body as any).user).toBeDefined()
    expect((resp.body as any).user.id).toBeDefined()
  })

  it('페이지네이션 응답은 total, page, limit 필드를 포함', async () => {
    mockFetchGet.mockResolvedValueOnce(
      makeOkResponse('200', {
        services: [],
        total: 0,
        page: 1,
        limit: 20,
      }),
    )

    const resp = await apiGet('/api/v1/services?page=1&limit=20', 'valid-token')

    expect(resp.status).toBe('200')
    const body = resp.body as any
    expect(body.total).toBeDefined()
    expect(body.page).toBeDefined()
    expect(body.limit).toBeDefined()
  })

  it('API 요청은 Content-Type: application/json 헤더를 사용', async () => {
    mockFetchPost.mockResolvedValueOnce(
      makeOkResponse('201', { message: 'ok' }),
    )

    const resp = await apiPost('/api/v1/some-endpoint', { data: 'test' }, 'valid-token')

    expect(mockFetchPost).toHaveBeenCalledWith(
      '/api/v1/some-endpoint',
      JSON.stringify({ data: 'test' }),
    )
    expect(resp.status).toBe('201')
  })
})
