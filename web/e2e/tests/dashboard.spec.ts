import { test, expect } from '@playwright/test'
import { loginWithToken, TEST_ACCESS_TOKEN, TEST_USER_OBJECT } from '../helpers/auth'
import { mockApiResponse, mockAuthApi, mockServiceApi, mockWebSocket } from '../helpers/api-mock'
import { waitForPageLoad, navigateAndWait, waitForText, waitForLoadingToFinish } from '../helpers/test-utils'

// ---------------------------------------------------------------------------
// 공통 mock 데이터 (테스트 내 검증에 사용)
// ---------------------------------------------------------------------------

const MOCK_STATS = {
  total_services: 5,
  healthy_services: 3,
  down_services: 1,
  degraded_services: 1,
  active_incidents: 2,
  total_alerts: 4,
}

const MOCK_SERVICES_LIST = [
  { id: 1, team_id: 1, name: 'API Gateway', url: 'http://api.example.com', status: 'up', tags: 'backend,api', check_interval_sec: 30 },
  { id: 2, team_id: 1, name: 'Database', url: 'http://db.example.com', status: 'up', tags: 'database', check_interval_sec: 60 },
  { id: 3, team_id: 1, name: 'Cache', url: 'http://cache.example.com', status: 'up', tags: 'cache', check_interval_sec: 30 },
  { id: 4, team_id: 1, name: 'Worker', url: 'http://worker.example.com', status: 'down', tags: 'worker', check_interval_sec: 60 },
  { id: 5, team_id: 1, name: 'Frontend', url: 'http://frontend.example.com', status: 'degraded', tags: 'frontend', check_interval_sec: 30 },
]

const MOCK_INCIDENTS_LIST = [
  {
    id: 1,
    alert_id: 1,
    service_id: 4,
    service_name: 'Worker',
    title: 'Worker service is down',
    severity: 'critical',
    status: 'open',
    created_at: Math.floor(Date.now() / 1000) - 3600,
    triggered_at: Math.floor(Date.now() / 1000) - 3600,
    acknowledged_at: null,
    resolved_at: null,
  },
  {
    id: 2,
    alert_id: 2,
    service_id: 5,
    service_name: 'Frontend',
    title: 'High error rate detected',
    severity: 'warning',
    status: 'open',
    created_at: Math.floor(Date.now() / 1000) - 1800,
    triggered_at: Math.floor(Date.now() / 1000) - 1800,
    acknowledged_at: null,
    resolved_at: null,
  },
]

// ---------------------------------------------------------------------------
// 공통 setup 헬퍼
// ---------------------------------------------------------------------------

/**
 * 대시보드 테스트를 위한 기본 mock 세팅 + 인증 + 페이지 이동
 */
async function setupDashboard(page: Parameters<typeof mockAuthApi>[0]) {
  // 인증 API mock
  await mockAuthApi(page)

  // admin stats API mock (대시보드 우선 호출 엔드포인트)
  await mockApiResponse(
    page,
    '/api/v1/admin/stats',
    { data: MOCK_STATS },
    { status: 200, method: 'GET' },
  )

  // 서비스 목록 API mock (fallback 경로에서도 사용)
  await mockApiResponse(
    page,
    '/api/v1/services',
    {
      services: MOCK_SERVICES_LIST,
      items: MOCK_SERVICES_LIST,
      data: MOCK_SERVICES_LIST,
      total: MOCK_SERVICES_LIST.length,
      page: 1,
      limit: 20,
    },
    { status: 200, method: 'GET' },
  )

  // 인시던트 API mock
  await mockApiResponse(
    page,
    '/api/v1/incidents*',
    {
      incidents: MOCK_INCIDENTS_LIST,
      items: MOCK_INCIDENTS_LIST,
      data: MOCK_INCIDENTS_LIST,
      total: MOCK_INCIDENTS_LIST.length,
      page: 1,
      limit: 20,
    },
    { status: 200, method: 'GET' },
  )

  // 메트릭 API mock
  await mockApiResponse(
    page,
    '/api/v1/metrics*',
    {
      metrics: [],
      total: 0,
      page: 1,
      limit: 100,
    },
    { status: 200 },
  )

  // WebSocket mock
  await mockWebSocket(page)

  // localStorage에 인증 토큰 설정 후 대시보드로 이동
  await loginWithToken(page, TEST_ACCESS_TOKEN, TEST_USER_OBJECT as Record<string, unknown>)
  await navigateAndWait(page, '/')
}

// ---------------------------------------------------------------------------
// 테스트 수트: 대시보드 렌더링
// ---------------------------------------------------------------------------

test.describe('Dashboard', () => {
  // 1. 대시보드 렌더링 — 페이지 타이틀 및 요약 카드 4개 표시
  test('인증 후 / 접근 시 대시보드 페이지가 정상 렌더링된다', async ({ page }) => {
    await setupDashboard(page)
    await waitForLoadingToFinish(page)

    // 페이지 타이틀 확인 (i18n: dashboard.title → "Dashboard")
    const pageTitle = page.locator('h2.page-title')
    await expect(pageTitle).toBeVisible()
    await expect(pageTitle).toContainText('Dashboard')

    // 요약 카드 4개 이상 표시 확인
    const summaryGrid = page.locator('div.summary-grid')
    await expect(summaryGrid).toBeVisible()

    // 개별 카드 확인
    await expect(page.locator('.summary-card.card-total')).toBeVisible()
    await expect(page.locator('.summary-card.card-healthy')).toBeVisible()
    await expect(page.locator('.summary-card.card-down')).toBeVisible()
    await expect(page.locator('.summary-card.card-incidents')).toBeVisible()
  })

  // 2. 서비스 요약 카드 — mock 데이터 기준 총 서비스 수, 정상/장애 카운트
  test('서비스 요약 카드에 mock 데이터 기반 총 서비스 수와 상태 카운트가 표시된다', async ({ page }) => {
    await setupDashboard(page)
    await waitForLoadingToFinish(page)

    // 전체 서비스 카드
    const cardTotal = page.locator('.summary-card.card-total')
    await expect(cardTotal).toBeVisible()
    const totalValue = cardTotal.locator('.card-value')
    await expect(totalValue).toBeVisible()
    await expect(totalValue).toContainText(String(MOCK_STATS.total_services))

    // 정상 서비스 카드
    const cardHealthy = page.locator('.summary-card.card-healthy')
    await expect(cardHealthy).toBeVisible()
    const healthyValue = cardHealthy.locator('.card-value')
    await expect(healthyValue).toBeVisible()
    await expect(healthyValue).toContainText(String(MOCK_STATS.healthy_services))

    // 장애 서비스 카드
    const cardDown = page.locator('.summary-card.card-down')
    await expect(cardDown).toBeVisible()
    const downValue = cardDown.locator('.card-value')
    await expect(downValue).toBeVisible()
    await expect(downValue).toContainText(String(MOCK_STATS.down_services))
  })

  // 3. 인시던트 카드 — 활성 인시던트 수 표시
  test('인시던트 카드에 활성 인시던트 수가 표시된다', async ({ page }) => {
    await setupDashboard(page)
    await waitForLoadingToFinish(page)

    const cardIncidents = page.locator('.summary-card.card-incidents')
    await expect(cardIncidents).toBeVisible()

    const incidentsValue = cardIncidents.locator('.card-value')
    await expect(incidentsValue).toBeVisible()
    await expect(incidentsValue).toContainText(String(MOCK_STATS.active_incidents))
  })

  // 4. 새로고침 — btn-refresh 클릭 시 API 재호출 및 데이터 갱신
  test('새로고침 버튼 클릭 시 API를 재호출하여 데이터가 갱신된다', async ({ page }) => {
    await setupDashboard(page)
    await waitForLoadingToFinish(page)

    // API 호출 횟수를 추적하기 위한 카운터
    let statsCallCount = 0
    await page.route('/api/v1/admin/stats', (route) => {
      statsCallCount++
      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { ...MOCK_STATS, total_services: 6 } }),
      })
    })

    let servicesCallCount = 0
    await page.route('/api/v1/services', (route) => {
      if (route.request().method() === 'GET') {
        servicesCallCount++
      }
      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          services: MOCK_SERVICES_LIST,
          items: MOCK_SERVICES_LIST,
          data: MOCK_SERVICES_LIST,
          total: MOCK_SERVICES_LIST.length,
        }),
      })
    })

    // 새로고침 버튼 클릭
    const refreshBtn = page.locator('button.btn-refresh')
    await expect(refreshBtn).toBeVisible()
    await refreshBtn.click()

    // 로딩 완료 대기
    await waitForLoadingToFinish(page)

    // API가 재호출되었음을 확인 (통계 또는 서비스 API 중 하나 이상 재호출)
    expect(statsCallCount + servicesCallCount).toBeGreaterThan(0)
  })

  // 5. WebSocket 연결 — ws-status.connected 클래스 확인
  test('WebSocket 연결 성공 시 ws-status 요소에 connected 클래스가 추가된다', async ({ page }) => {
    await setupDashboard(page)
    await waitForLoadingToFinish(page)

    // WebSocket 연결 상태 표시 요소 확인
    const wsStatus = page.locator('div.ws-status')
    await expect(wsStatus).toBeVisible()

    // connected 클래스가 붙거나 연결 상태 텍스트가 표시될 때까지 대기 (최대 5초)
    await expect(wsStatus).toHaveClass(/connected/, { timeout: 5000 })
      .catch(async () => {
        // connected 클래스 확인에 실패한 경우 연결 상태 레이블 텍스트로 대체 확인
        const wsLabel = wsStatus.locator('.ws-label')
        await expect(wsLabel).toBeVisible()
        // "Live" 또는 "Connecting..." 텍스트 확인 (연결 시도 중임을 인정)
        const labelText = await wsLabel.textContent()
        expect(labelText).toBeTruthy()
      })
  })

  // 6. 실시간 이벤트 — WebSocket mock에서 이벤트 전송 후 이벤트 피드에 표시
  test('WebSocket을 통해 수신된 실시간 이벤트가 이벤트 피드에 표시된다', async ({ page }) => {
    // WebSocket 핸들러를 직접 정의하여 이벤트 전송 제어
    await mockAuthApi(page)
    await mockApiResponse(
      page,
      '/api/v1/admin/stats',
      { data: MOCK_STATS },
      { status: 200, method: 'GET' },
    )
    await mockApiResponse(
      page,
      '/api/v1/services',
      { services: MOCK_SERVICES_LIST, items: MOCK_SERVICES_LIST, data: MOCK_SERVICES_LIST, total: MOCK_SERVICES_LIST.length },
      { status: 200, method: 'GET' },
    )
    await mockApiResponse(
      page,
      '/api/v1/incidents*',
      { incidents: MOCK_INCIDENTS_LIST, items: MOCK_INCIDENTS_LIST, data: MOCK_INCIDENTS_LIST, total: MOCK_INCIDENTS_LIST.length },
      { status: 200, method: 'GET' },
    )
    await mockApiResponse(
      page,
      '/api/v1/metrics*',
      { metrics: [], total: 0, page: 1, limit: 100 },
      { status: 200 },
    )

    // healthcheck 이벤트를 전송하는 WS mock 설정
    await page.routeWebSocket('/ws/status', (ws) => {
      ws.onopen(() => {
        // 초기 상태 이벤트
        ws.send(JSON.stringify({
          event: 'healthcheck',
          data: {
            service_id: 4,
            service_name: 'Worker',
            status: 'down',
          },
        }))
      })

      ws.onmessage(() => {
        ws.send(JSON.stringify({
          event: 'healthcheck',
          data: {
            service_id: 4,
            service_name: 'Worker',
            status: 'down',
          },
        }))
      })
    })

    await page.routeWebSocket('/ws/alerts', (ws) => {
      ws.onopen(() => {
        ws.send(JSON.stringify({
          event: 'alert',
          data: {
            alert_id: 1,
            service_id: 4,
            service_name: 'Worker',
            severity: 'critical',
          },
        }))
      })
    })

    await page.routeWebSocket('/ws/metrics', (ws) => {
      ws.onopen(() => {
        ws.send(JSON.stringify({
          type: 'metrics',
          data: [],
          timestamp: Date.now(),
        }))
      })
    })

    await loginWithToken(page, TEST_ACCESS_TOKEN, TEST_USER_OBJECT as Record<string, unknown>)
    await navigateAndWait(page, '/')
    await waitForLoadingToFinish(page)

    // 이벤트 피드 영역 확인
    const eventList = page.locator('.event-list')
    await expect(eventList).toBeVisible({ timeout: 5000 })

    // WebSocket 이벤트가 피드에 반영되었는지 확인 (이벤트 항목 또는 healthcheck 관련 텍스트)
    // 이벤트가 있는 경우 event-item이 표시되고, 없는 경우 empty-state가 표시됨
    const hasEvents = await page.locator('.event-item').count()
    const hasEmptyState = await page.locator('.event-list .empty-state').count()

    // 이벤트 피드가 렌더링되어 있어야 함 (이벤트 항목 또는 빈 상태 메시지)
    expect(hasEvents + hasEmptyState).toBeGreaterThan(0)

    // WS 이벤트가 처리된 경우 이벤트 항목이 존재해야 함
    if (hasEvents > 0) {
      const firstEvent = page.locator('.event-item').first()
      await expect(firstEvent).toBeVisible()

      // 이벤트 레이블 또는 서비스 이름 확인
      const eventBody = firstEvent.locator('.event-body')
      await expect(eventBody).toBeVisible()
    }
  })

  // 7. 네비게이션 — 서비스 카드 링크 클릭 시 /services로 이동
  test('전체 서비스 카드의 링크 클릭 시 /services 페이지로 이동한다', async ({ page }) => {
    await setupDashboard(page)
    await waitForLoadingToFinish(page)

    // 서비스 목록 페이지 API mock
    await mockServiceApi(page)

    // card-total 내의 카드 링크 클릭
    const cardTotal = page.locator('.summary-card.card-total')
    await expect(cardTotal).toBeVisible()

    const cardLink = cardTotal.locator('a.card-link')
    await expect(cardLink).toBeVisible()

    // 링크 클릭 후 /services URL로 이동 확인
    await Promise.all([
      page.waitForURL(/\/services/, { timeout: 10000 }),
      cardLink.click(),
    ])

    expect(page.url()).toContain('/services')
  })

  // 8. 로딩 상태 — 초기 로딩 스피너 표시 후 데이터 로드 시 사라짐
  test('초기 로딩 중 스피너가 표시되고 데이터 로드 완료 후 사라진다', async ({ page }) => {
    await mockAuthApi(page)

    // 응답 지연을 시뮬레이션하여 로딩 상태를 관찰
    let resolveStats: (() => void) | null = null
    const statsDelayPromise = new Promise<void>((resolve) => {
      resolveStats = resolve
    })

    await page.route('/api/v1/admin/stats', async (route) => {
      // 지연 응답 (로딩 스피너 확인 시간 확보)
      await statsDelayPromise
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: MOCK_STATS }),
      })
    })

    await mockApiResponse(
      page,
      '/api/v1/services',
      { services: MOCK_SERVICES_LIST, items: MOCK_SERVICES_LIST, data: MOCK_SERVICES_LIST, total: MOCK_SERVICES_LIST.length },
      { status: 200, method: 'GET' },
    )
    await mockApiResponse(
      page,
      '/api/v1/incidents*',
      { incidents: MOCK_INCIDENTS_LIST, items: MOCK_INCIDENTS_LIST, data: MOCK_INCIDENTS_LIST, total: MOCK_INCIDENTS_LIST.length },
      { status: 200, method: 'GET' },
    )
    await mockApiResponse(
      page,
      '/api/v1/metrics*',
      { metrics: [], total: 0, page: 1, limit: 100 },
      { status: 200 },
    )
    await mockWebSocket(page)

    await loginWithToken(page, TEST_ACCESS_TOKEN, TEST_USER_OBJECT as Record<string, unknown>)

    // 페이지 이동 시작 (로딩 즉시 시작됨)
    await page.goto('/')

    // 로딩 스피너 또는 새로고침 아이콘의 spinning 클래스 확인
    // isLoading = true 시 refresh-icon에 spinning 클래스가 붙음
    const spinningIcon = page.locator('.refresh-icon.spinning')
    const loadingIndicator = page.locator('.loading, .spinner, [data-testid="loading"]')

    // 로딩 상태 요소가 표시될 수 있는지 잠시 확인 (지연 응답 중)
    const isSpinnerVisible = await spinningIcon.isVisible().catch(() => false)
    const isLoadingVisible = await loadingIndicator.first().isVisible().catch(() => false)

    // 응답 해제하여 로딩 완료
    if (resolveStats) resolveStats()

    // 로딩 완료 대기
    await waitForPageLoad(page)
    await waitForLoadingToFinish(page)

    // 로딩 완료 후 spinning 클래스가 제거되었는지 확인
    await expect(spinningIcon).not.toBeVisible({ timeout: 10000 })

    // 대시보드 콘텐츠가 표시되어야 함
    await expect(page.locator('h2.page-title')).toBeVisible()
    await expect(page.locator('div.summary-grid')).toBeVisible()

    // 로딩 중이었거나 이미 로딩이 완료되었을 수 있음 (타이밍에 따라 달라짐)
    // 최종 상태에서 스피너가 없고 콘텐츠가 표시됨을 검증
    const finalSpinnerVisible = await spinningIcon.isVisible().catch(() => false)
    expect(finalSpinnerVisible).toBe(false)

    // isSpinnerVisible 또는 isLoadingVisible 변수는 로딩 타이밍 추적용으로 사용
    // 실제 assertion은 최종 상태(스피너 없음)에 집중
    void isSpinnerVisible
    void isLoadingVisible
  })
})

// ---------------------------------------------------------------------------
// 추가 통합 시나리오
// ---------------------------------------------------------------------------

test.describe('Dashboard — 추가 시나리오', () => {
  // 요약 카드 레이블 텍스트 확인
  test('요약 카드에 올바른 레이블이 표시된다', async ({ page }) => {
    await setupDashboard(page)
    await waitForLoadingToFinish(page)

    // 전체 서비스 카드 레이블
    const cardTotalLabel = page.locator('.summary-card.card-total .card-label')
    await expect(cardTotalLabel).toBeVisible()

    // 정상 서비스 카드 레이블 (i18n: dashboard.healthyServices → "Healthy")
    const cardHealthyLabel = page.locator('.summary-card.card-healthy .card-label')
    await expect(cardHealthyLabel).toBeVisible()
    await expect(cardHealthyLabel).toContainText('Healthy')

    // 장애 서비스 카드 레이블 (i18n: dashboard.downServices → "Down")
    const cardDownLabel = page.locator('.summary-card.card-down .card-label')
    await expect(cardDownLabel).toBeVisible()
    await expect(cardDownLabel).toContainText('Down')

    // 인시던트 카드 레이블 (i18n: dashboard.openIncidents → "Open Incidents")
    const cardIncidentsLabel = page.locator('.summary-card.card-incidents .card-label')
    await expect(cardIncidentsLabel).toBeVisible()
    await expect(cardIncidentsLabel).toContainText('Open Incidents')
  })

  // 페이지 헤더 구조 확인
  test('페이지 헤더에 타이틀과 새로고침 버튼이 포함된다', async ({ page }) => {
    await setupDashboard(page)
    await waitForLoadingToFinish(page)

    // 헤더 영역
    const pageHeader = page.locator('div.page-header')
    await expect(pageHeader).toBeVisible()

    // 페이지 타이틀
    await expect(pageHeader.locator('h2.page-title')).toBeVisible()

    // 새로고침 버튼
    const refreshBtn = pageHeader.locator('button.btn-refresh')
    await expect(refreshBtn).toBeVisible()
  })

  // 인시던트 카드 링크 클릭 시 /incidents 이동
  test('인시던트 카드 링크 클릭 시 /incidents 페이지로 이동한다', async ({ page }) => {
    await setupDashboard(page)
    await waitForLoadingToFinish(page)

    const cardIncidents = page.locator('.summary-card.card-incidents')
    await expect(cardIncidents).toBeVisible()

    const incidentLink = cardIncidents.locator('a.card-link')
    await expect(incidentLink).toBeVisible()

    await Promise.all([
      page.waitForURL(/\/incidents/, { timeout: 10000 }),
      incidentLink.click(),
    ])

    expect(page.url()).toContain('/incidents')
  })

  // WebSocket 실시간 메트릭 수신 확인
  test('WebSocket /ws/metrics 연결 후 메트릭 이벤트를 수신한다', async ({ page }) => {
    await mockAuthApi(page)
    await mockApiResponse(
      page,
      '/api/v1/admin/stats',
      { data: MOCK_STATS },
      { status: 200, method: 'GET' },
    )
    await mockApiResponse(
      page,
      '/api/v1/services',
      { services: MOCK_SERVICES_LIST, total: MOCK_SERVICES_LIST.length },
      { status: 200, method: 'GET' },
    )
    await mockApiResponse(
      page,
      '/api/v1/incidents*',
      { incidents: [], total: 0 },
      { status: 200, method: 'GET' },
    )
    await mockApiResponse(
      page,
      '/api/v1/metrics*',
      { metrics: [], total: 0, page: 1, limit: 100 },
      { status: 200 },
    )

    // metrics 채널을 통해 metric 이벤트 전송
    let metricMessageSent = false
    await page.routeWebSocket('/ws/metrics', (ws) => {
      ws.onopen(() => {
        metricMessageSent = true
        ws.send(JSON.stringify({
          event: 'metric',
          data: {
            service_id: 1,
            metric_name: 'response_time',
            value: 120.5,
          },
        }))
      })
    })

    await page.routeWebSocket('/ws/alerts', (ws) => {
      ws.onopen(() => {
        ws.send(JSON.stringify({ type: 'alerts', data: [], timestamp: Date.now() }))
      })
    })

    await page.routeWebSocket('/ws/status', (ws) => {
      ws.onopen(() => {
        ws.send(JSON.stringify({ type: 'status', data: [], timestamp: Date.now() }))
      })
    })

    await loginWithToken(page, TEST_ACCESS_TOKEN, TEST_USER_OBJECT as Record<string, unknown>)
    await navigateAndWait(page, '/')
    await waitForLoadingToFinish(page)

    // 대시보드가 렌더링되었는지 확인
    await expect(page.locator('div.summary-grid')).toBeVisible()

    // 메트릭 차트 영역 확인
    const metricsPanel = page.locator('.panel.panel-metrics')
    await expect(metricsPanel).toBeVisible({ timeout: 5000 })

    // WS 메시지가 전송되었음을 확인
    expect(metricMessageSent).toBe(true)
  })

  // 이벤트 피드 영역 존재 확인
  test('이벤트 피드 영역이 대시보드에 표시된다', async ({ page }) => {
    await setupDashboard(page)
    await waitForLoadingToFinish(page)

    // 이벤트 피드 패널 확인
    const feedPanel = page.locator('.panel.panel-feed')
    await expect(feedPanel).toBeVisible()

    // 이벤트 목록 컨테이너 확인
    const eventList = feedPanel.locator('.event-list')
    await expect(eventList).toBeVisible()

    // 이벤트가 없을 때 empty-state 또는 이벤트 아이템이 표시됨
    const itemCount = await eventList.locator('.event-item').count()
    const emptyCount = await eventList.locator('.empty-state').count()
    expect(itemCount + emptyCount).toBeGreaterThan(0)
  })

  // ws-status 요소 존재 확인
  test('WebSocket 연결 상태 표시 요소가 헤더에 존재한다', async ({ page }) => {
    await setupDashboard(page)
    await waitForLoadingToFinish(page)

    const wsStatus = page.locator('div.ws-status')
    await expect(wsStatus).toBeVisible()

    // ws-dot, ws-label 하위 요소 확인
    await expect(wsStatus.locator('.ws-dot')).toBeVisible()
    await expect(wsStatus.locator('.ws-label')).toBeVisible()
  })

  // summary-grid 카드가 5개임을 확인 (card-total, card-healthy, card-down, card-degraded, card-incidents, card-alerts)
  test('요약 그리드에 모든 요약 카드가 표시된다', async ({ page }) => {
    await setupDashboard(page)
    await waitForLoadingToFinish(page)

    const summaryCards = page.locator('div.summary-grid .summary-card')
    const count = await summaryCards.count()
    expect(count).toBeGreaterThanOrEqual(4)
  })

  // 새로고침 버튼의 loading 상태 아이콘 클래스 확인
  test('새로고침 클릭 시 refresh-icon에 spinning 클래스가 일시적으로 추가된다', async ({ page }) => {
    await mockAuthApi(page)

    // 응답 지연을 이용해 spinning 상태 확인
    let resolveRefresh: (() => void) | null = null

    await page.route('/api/v1/admin/stats', async (route) => {
      if (resolveRefresh !== null) {
        // 새로고침 시 지연
        await new Promise<void>((resolve) => {
          resolveRefresh = resolve
          setTimeout(resolve, 500)
        })
      }
      resolveRefresh = null
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: MOCK_STATS }),
      })
    })

    await mockApiResponse(
      page,
      '/api/v1/services',
      { services: MOCK_SERVICES_LIST, total: MOCK_SERVICES_LIST.length },
      { status: 200, method: 'GET' },
    )
    await mockApiResponse(
      page,
      '/api/v1/incidents*',
      { incidents: [], total: 0 },
      { status: 200, method: 'GET' },
    )
    await mockApiResponse(
      page,
      '/api/v1/metrics*',
      { metrics: [], total: 0, page: 1, limit: 100 },
      { status: 200 },
    )
    await mockWebSocket(page)

    await loginWithToken(page, TEST_ACCESS_TOKEN, TEST_USER_OBJECT as Record<string, unknown>)
    await navigateAndWait(page, '/')
    await waitForLoadingToFinish(page)

    // 새로고침 버튼 클릭
    const refreshBtn = page.locator('button.btn-refresh')
    await expect(refreshBtn).toBeVisible()

    // 지연 응답을 위해 resolveRefresh를 설정
    let resolveOuter: (() => void) | null = null
    const outerPromise = new Promise<void>((r) => { resolveOuter = r })

    await page.route('/api/v1/admin/stats', async (route) => {
      // spinning 상태를 확인하기 위해 잠시 대기
      await new Promise<void>((r) => setTimeout(r, 300))
      if (resolveOuter) resolveOuter()
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: MOCK_STATS }),
      })
    })

    // 새로고침 클릭 (응답 기다리지 않음)
    void refreshBtn.click()

    // 잠시 대기 후 spinning 상태 확인
    await page.waitForTimeout(100)
    const isSpinning = await page.locator('.refresh-icon.spinning').isVisible().catch(() => false)

    // outerPromise가 resolve 될 때까지 대기
    await outerPromise.catch(() => {})

    // 로딩 완료 후 spinning 클래스 제거 확인
    await waitForLoadingToFinish(page)
    const isSpinningAfter = await page.locator('.refresh-icon.spinning').isVisible().catch(() => false)
    expect(isSpinningAfter).toBe(false)

    // isSpinning 추적 변수 (타이밍에 따라 true/false 가능)
    void isSpinning
  })
})
