import { test, expect } from '@playwright/test'
import { loginWithToken, TEST_ACCESS_TOKEN, TEST_USER_OBJECT } from '../helpers/auth'
import { mockApiResponse, mockAuthApi } from '../helpers/api-mock'
import {
  navigateAndWait,
  waitForText,
  waitForLoadingToFinish,
} from '../helpers/test-utils'

// ---------------------------------------------------------------------------
// Mock 로그 데이터
// ---------------------------------------------------------------------------

const MOCK_LOGS = [
  {
    id: 'log-001',
    timestamp: '2026-04-09T10:00:00.000Z',
    level: 'info',
    service: 'API Gateway',
    message: 'Request processed successfully',
    trace_id: 'trace-abc-001',
    source: 'api-gateway',
    raw: '{"status":200,"path":"/api/health"}',
  },
  {
    id: 'log-002',
    timestamp: '2026-04-09T10:01:00.000Z',
    level: 'error',
    service: 'Database',
    message: 'Connection timeout after 30s',
    trace_id: 'trace-abc-002',
    source: 'database',
    raw: '{"error":"timeout","duration_ms":30000}',
  },
  {
    id: 'log-003',
    timestamp: '2026-04-09T10:02:00.000Z',
    level: 'warn',
    service: 'API Gateway',
    message: 'High memory usage detected: 85%',
    trace_id: 'trace-abc-003',
    source: 'api-gateway',
    raw: '{"memory_percent":85}',
  },
  {
    id: 'log-004',
    timestamp: '2026-04-09T10:03:00.000Z',
    level: 'debug',
    service: 'API Gateway',
    message: 'Cache hit for key user:42',
    trace_id: 'trace-abc-004',
    source: 'api-gateway',
    raw: '{"cache":"hit","key":"user:42"}',
  },
  {
    id: 'log-005',
    timestamp: '2026-04-09T10:04:00.000Z',
    level: 'fatal',
    service: 'Database',
    message: 'Disk full: no space left on device',
    trace_id: 'trace-abc-005',
    source: 'database',
    raw: '{"disk_free":0}',
  },
]

const MOCK_LOGS_SEARCH_RESPONSE = {
  logs: MOCK_LOGS,
  total: MOCK_LOGS.length,
  page: 1,
  page_size: 50,
}

// ---------------------------------------------------------------------------
// 공통 셋업
// ---------------------------------------------------------------------------

test.beforeEach(async ({ page }) => {
  await mockAuthApi(page)
  await loginWithToken(page, TEST_ACCESS_TOKEN, TEST_USER_OBJECT)
})

/**
 * 기본 로그 검색 API mock 설정 헬퍼
 */
async function mockLogsSearchApi(
  page: Parameters<typeof mockApiResponse>[0],
  response = MOCK_LOGS_SEARCH_RESPONSE,
) {
  await mockApiResponse(page, '/api/v1/logs/search*', response, { status: 200 })
}

// ---------------------------------------------------------------------------
// 1. 로그 목록 표시
// ---------------------------------------------------------------------------

test('로그 목록 - mock 로그 데이터 렌더링 확인', async ({ page }) => {
  await mockLogsSearchApi(page)
  await navigateAndWait(page, '/logs')
  await waitForLoadingToFinish(page)

  // 로그 행이 렌더링됨
  await waitForText(page, 'Request processed successfully')
  await waitForText(page, 'Connection timeout after 30s')
  await waitForText(page, 'High memory usage detected: 85%')

  // 로그 레벨 배지 표시 확인
  await expect(page.locator('.log-level-badge.badge-info').first()).toBeVisible()
  await expect(page.locator('.log-level-badge.badge-error').first()).toBeVisible()
  await expect(page.locator('.log-level-badge.badge-warn').first()).toBeVisible()
})

// ---------------------------------------------------------------------------
// 2. BM25 검색
// ---------------------------------------------------------------------------

test('BM25 검색 - 검색어 입력 후 결과 표시', async ({ page }) => {
  await mockLogsSearchApi(page)

  // BM25 검색 결과 mock
  await mockApiResponse(
    page,
    '/api/v1/logs/search*',
    {
      logs: [MOCK_LOGS[0]],
      total: 1,
      page: 1,
      page_size: 50,
    },
    { status: 200 },
  )

  await navigateAndWait(page, '/logs')
  await waitForLoadingToFinish(page)

  // BM25 모드 탭이 기본 활성화 확인
  const bm25Tab = page.locator('button.mode-tab').filter({ hasText: 'BM25' })
  await expect(bm25Tab).toBeVisible()
  await expect(bm25Tab).toHaveClass(/active/)

  // 검색어 입력
  const searchInput = page.locator('input.search-input')
  await searchInput.fill('Request processed')

  // 검색 버튼 클릭
  const searchBtn = page.locator('button.btn-search')
  await searchBtn.click()

  await waitForLoadingToFinish(page)

  // 검색 결과 표시
  await expect(page.locator('.log-row').first()).toBeVisible()
})

// ---------------------------------------------------------------------------
// 3. BOOLEAN 검색
// ---------------------------------------------------------------------------

test('BOOLEAN 검색 - 모드 전환 후 AND/OR 검색', async ({ page }) => {
  await mockLogsSearchApi(page)

  await navigateAndWait(page, '/logs')
  await waitForLoadingToFinish(page)

  // BOOLEAN 모드 탭 클릭
  const booleanTab = page.locator('button.mode-tab').filter({ hasText: 'Boolean' })
  await expect(booleanTab).toBeVisible()
  await booleanTab.click()

  // BOOLEAN 탭이 활성화됨
  await expect(booleanTab).toHaveClass(/active/)

  // AND 연산자 포함 검색어 입력
  const searchInput = page.locator('input.search-input')
  await searchInput.fill('error AND timeout')

  // 검색 실행 (Enter 키)
  await searchInput.press('Enter')

  await waitForLoadingToFinish(page)

  // 로그 컨테이너가 여전히 표시됨
  await expect(page.locator('.logs-container')).toBeVisible()
})

// ---------------------------------------------------------------------------
// 4. PHRASE 검색
// ---------------------------------------------------------------------------

test('PHRASE 검색 - 모드 전환 후 구문 검색', async ({ page }) => {
  await mockLogsSearchApi(page)

  await navigateAndWait(page, '/logs')
  await waitForLoadingToFinish(page)

  // PHRASE 모드 탭 클릭
  const phraseTab = page.locator('button.mode-tab').filter({ hasText: 'Phrase' })
  await expect(phraseTab).toBeVisible()
  await phraseTab.click()

  // PHRASE 탭이 활성화됨
  await expect(phraseTab).toHaveClass(/active/)

  // 구문 검색어 입력
  const searchInput = page.locator('input.search-input')
  await searchInput.fill('Connection timeout')

  // 검색 버튼 클릭
  const searchBtn = page.locator('button.btn-search')
  await searchBtn.click()

  await waitForLoadingToFinish(page)

  // 로그 컨테이너가 여전히 표시됨
  await expect(page.locator('.logs-container')).toBeVisible()
})

// ---------------------------------------------------------------------------
// 5. 레벨 필터
// ---------------------------------------------------------------------------

test('레벨 필터 - error 레벨 필터 적용', async ({ page }) => {
  await mockLogsSearchApi(page)

  // error 필터 적용 시 error 로그만 반환하는 mock
  await mockApiResponse(
    page,
    '/api/v1/logs/search*',
    {
      logs: [MOCK_LOGS[1], MOCK_LOGS[4]], // error, fatal
      total: 2,
      page: 1,
      page_size: 50,
    },
    { status: 200 },
  )

  await navigateAndWait(page, '/logs')
  await waitForLoadingToFinish(page)

  // error 레벨 필터 버튼 클릭
  const errorLevelBtn = page.locator('button.level-btn.level-error')
  await expect(errorLevelBtn).toBeVisible()
  await errorLevelBtn.click()

  await waitForLoadingToFinish(page)

  // 레벨 버튼이 활성화됨
  await expect(errorLevelBtn).toHaveClass(/active/)

  // 로그 컨테이너가 표시됨
  await expect(page.locator('.logs-container')).toBeVisible()
})

test('레벨 필터 - warn 레벨 필터 적용', async ({ page }) => {
  await mockLogsSearchApi(page)

  await navigateAndWait(page, '/logs')
  await waitForLoadingToFinish(page)

  // warn 레벨 버튼 클릭
  const warnLevelBtn = page.locator('button.level-btn.level-warn')
  await expect(warnLevelBtn).toBeVisible()
  await warnLevelBtn.click()

  // 활성화 확인
  await expect(warnLevelBtn).toHaveClass(/active/)
})

test('레벨 필터 - info 레벨 필터 적용', async ({ page }) => {
  await mockLogsSearchApi(page)

  await navigateAndWait(page, '/logs')
  await waitForLoadingToFinish(page)

  // info 레벨 버튼 클릭
  const infoLevelBtn = page.locator('button.level-btn.level-info')
  await expect(infoLevelBtn).toBeVisible()
  await infoLevelBtn.click()

  // 활성화 확인
  await expect(infoLevelBtn).toHaveClass(/active/)
})

// ---------------------------------------------------------------------------
// 6. 서비스 필터
// ---------------------------------------------------------------------------

test('서비스 필터 - 특정 서비스 이름 입력 시 해당 로그만 표시', async ({ page }) => {
  await mockLogsSearchApi(page)

  // 'Database' 서비스 필터 적용 시 해당 로그만 반환
  await mockApiResponse(
    page,
    '/api/v1/logs/search*',
    {
      logs: [MOCK_LOGS[1], MOCK_LOGS[4]], // Database 서비스 로그
      total: 2,
      page: 1,
      page_size: 50,
    },
    { status: 200 },
  )

  await navigateAndWait(page, '/logs')
  await waitForLoadingToFinish(page)

  // 서비스 필터 입력란에 'Database' 입력
  const serviceFilterInput = page.locator('input.service-filter-input')
  await expect(serviceFilterInput).toBeVisible()
  await serviceFilterInput.fill('Database')

  // input 이벤트 발생 (handleServiceFilterInput 트리거)
  await serviceFilterInput.dispatchEvent('input')

  // 검색 버튼 클릭하여 필터 적용
  const searchBtn = page.locator('button.btn-search')
  await searchBtn.click()

  await waitForLoadingToFinish(page)

  // 로그 컨테이너가 표시됨
  await expect(page.locator('.logs-container')).toBeVisible()
})

// ---------------------------------------------------------------------------
// 7. 테일 모드
// ---------------------------------------------------------------------------

test('테일 모드 - 토글 클릭 시 LIVE 상태로 전환', async ({ page }) => {
  await mockLogsSearchApi(page)
  await navigateAndWait(page, '/logs')
  await waitForLoadingToFinish(page)

  // 테일 토글 버튼 확인
  const tailToggle = page.locator('button.tail-toggle')
  await expect(tailToggle).toBeVisible()

  // 초기 상태: Tail 텍스트 표시
  await expect(tailToggle).toContainText('Tail')

  // 테일 모드 토글 클릭
  await tailToggle.click()

  // LIVE 상태로 전환됨
  await expect(tailToggle).toContainText('LIVE')

  // 테일 인디케이터(pulse dot)가 표시됨
  const tailIndicator = page.locator('.tail-indicator')
  await expect(tailIndicator).toBeVisible()

  // tail-active 클래스 추가 확인
  await expect(tailToggle).toHaveClass(/tail-active/)

  // 다시 클릭하면 Tail 모드로 복귀
  await tailToggle.click()
  await expect(tailToggle).toContainText('Tail')
  await expect(tailToggle).not.toHaveClass(/tail-active/)
})

test('테일 모드 - 활성화 시 결과 요약에 테일 배지 표시', async ({ page }) => {
  await mockLogsSearchApi(page)
  await navigateAndWait(page, '/logs')
  await waitForLoadingToFinish(page)

  // 초기 상태: 테일 배지 없음
  await expect(page.locator('.tail-badge')).not.toBeVisible()

  // 테일 모드 활성화
  const tailToggle = page.locator('button.tail-toggle')
  await tailToggle.click()

  // 결과 요약에 테일 배지 표시됨
  await expect(page.locator('.tail-badge')).toBeVisible()
})
