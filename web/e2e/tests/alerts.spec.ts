import { test, expect } from '@playwright/test'
import { loginWithToken, TEST_ACCESS_TOKEN, TEST_USER_OBJECT } from '../helpers/auth'
import { mockApiResponse, mockAuthApi, mockServiceApi } from '../helpers/api-mock'
import {
  navigateAndWait,
  waitForText,
  waitForLoadingToFinish,
} from '../helpers/test-utils'

// ---------------------------------------------------------------------------
// Mock 데이터 상수
// ---------------------------------------------------------------------------

const MOCK_ALERT = {
  id: 1,
  service_id: 1,
  name: 'High CPU Alert',
  condition_metric: 'cpu_usage',
  condition_op: 'gt',
  condition_value: 90,
  severity: 'critical',
  enabled: true,
}

const MOCK_ALERT_DISABLED = { ...MOCK_ALERT, enabled: false }

const MOCK_ALERT_NEW = {
  id: 2,
  service_id: 1,
  name: 'High Memory Alert',
  condition_metric: 'memory_usage',
  condition_op: 'gt',
  condition_value: 85,
  severity: 'warning',
  enabled: true,
}

const MOCK_INCIDENT_OPEN = {
  id: 1,
  alert_id: 1,
  service_id: 1,
  status: 'open',
  triggered_at: Math.floor(Date.now() / 1000) - 3600,
  acknowledged_at: null,
  resolved_at: null,
}

const MOCK_INCIDENT_ACKNOWLEDGED = {
  ...MOCK_INCIDENT_OPEN,
  status: 'acknowledged',
  acknowledged_at: Math.floor(Date.now() / 1000) - 1800,
}

const MOCK_INCIDENT_RESOLVED = {
  ...MOCK_INCIDENT_ACKNOWLEDGED,
  status: 'resolved',
  resolved_at: Math.floor(Date.now() / 1000) - 600,
}

const MOCK_INCIDENT_TIMELINE = [
  { event: 'triggered', timestamp: MOCK_INCIDENT_OPEN.triggered_at, message: 'Alert triggered' },
  {
    event: 'acknowledged',
    timestamp: MOCK_INCIDENT_ACKNOWLEDGED.acknowledged_at,
    message: 'Incident acknowledged',
  },
  {
    event: 'resolved',
    timestamp: MOCK_INCIDENT_RESOLVED.resolved_at,
    message: 'Incident resolved',
  },
]

// ---------------------------------------------------------------------------
// 공통 setup 헬퍼
// ---------------------------------------------------------------------------

async function setupAlertsPage(page: Parameters<typeof mockAuthApi>[0]) {
  await mockAuthApi(page)
  await mockServiceApi(page)

  // alerts 목록 API
  await mockApiResponse(
    page,
    '/api/v1/alerts',
    { alerts: [MOCK_ALERT], total: 1, page: 1, limit: 20 },
    { status: 200, method: 'GET' },
  )

  await loginWithToken(page, TEST_ACCESS_TOKEN, TEST_USER_OBJECT)
  await navigateAndWait(page, '/alerts')
  await waitForLoadingToFinish(page)
}

async function setupIncidentsPage(page: Parameters<typeof mockAuthApi>[0]) {
  await mockAuthApi(page)
  await mockServiceApi(page)

  // incidents 목록 API — open/acknowledged/resolved 세 가지 포함
  await mockApiResponse(
    page,
    '/api/v1/incidents',
    {
      incidents: [MOCK_INCIDENT_OPEN, MOCK_INCIDENT_ACKNOWLEDGED, MOCK_INCIDENT_RESOLVED],
      total: 3,
      page: 1,
      limit: 20,
    },
    { status: 200, method: 'GET' },
  )

  await loginWithToken(page, TEST_ACCESS_TOKEN, TEST_USER_OBJECT)
  await navigateAndWait(page, '/incidents')
  await waitForLoadingToFinish(page)
}

// ---------------------------------------------------------------------------
// 알림 룰 테스트
// ---------------------------------------------------------------------------

test.describe('알림 룰 관리', () => {
  // 1. 알림 룰 목록 표시
  test('알림 룰 목록을 mock 데이터 기준으로 렌더링한다', async ({ page }) => {
    await setupAlertsPage(page)

    // 테이블 혹은 목록 컨테이너가 표시되는지 확인
    const alertsContainer = page.locator(
      '[data-testid="alerts-table"], table, [data-testid="alerts-list"]',
    )
    await expect(alertsContainer.first()).toBeVisible()

    // mock 알림 이름이 표시되는지 확인
    await waitForText(page, 'High CPU Alert')

    // severity 뱃지(critical) 표시 확인
    const severityBadge = page.locator(
      '[data-testid="severity-badge"], .severity-badge, .badge',
    ).filter({ hasText: /critical/i })
    await expect(severityBadge.first()).toBeVisible()

    // 조건 메트릭 정보 표시 확인
    await expect(page.getByText(/cpu_usage/i).first()).toBeVisible()
  })

  // 2. 알림 룰 생성
  test('/alerts/new 폼으로 알림 룰을 생성하고 목록에 반영된다', async ({ page }) => {
    await mockAuthApi(page)
    await mockServiceApi(page)

    // POST /api/v1/alerts — 생성 응답
    await mockApiResponse(
      page,
      '/api/v1/alerts',
      { alert: MOCK_ALERT_NEW },
      { status: 201, method: 'POST' },
    )

    // 생성 후 목록 조회 응답 (새 항목 포함)
    await mockApiResponse(
      page,
      '/api/v1/alerts',
      { alerts: [MOCK_ALERT, MOCK_ALERT_NEW], total: 2, page: 1, limit: 20 },
      { status: 200, method: 'GET' },
    )

    await loginWithToken(page, TEST_ACCESS_TOKEN, TEST_USER_OBJECT)
    await navigateAndWait(page, '/alerts/new')
    await waitForLoadingToFinish(page)

    // 폼이 표시되는지 확인
    const form = page.locator('form, [data-testid="alert-form"]')
    await expect(form.first()).toBeVisible()

    // 이름 입력
    const nameInput = page.locator(
      'input[name="name"], input[id="name"], [data-testid="alert-name-input"]',
    )
    await nameInput.first().fill('High Memory Alert')

    // 서비스 선택 (select 또는 combobox)
    const serviceSelect = page.locator(
      'select[name="service_id"], select[name="service"], [data-testid="service-select"]',
    )
    if ((await serviceSelect.count()) > 0) {
      await serviceSelect.first().selectOption({ index: 0 })
    }

    // 메트릭 입력
    const metricInput = page.locator(
      'input[name="condition_metric"], select[name="condition_metric"], [data-testid="metric-input"]',
    )
    if ((await metricInput.count()) > 0) {
      const tag = await metricInput.first().evaluate((el) => el.tagName.toLowerCase())
      if (tag === 'select') {
        await metricInput.first().selectOption('memory_usage')
      } else {
        await metricInput.first().fill('memory_usage')
      }
    }

    // 조건 op 선택 (gt)
    const opSelect = page.locator(
      'select[name="condition_op"], [data-testid="condition-op-select"]',
    )
    if ((await opSelect.count()) > 0) {
      await opSelect.first().selectOption('gt')
    }

    // 임계값 입력
    const thresholdInput = page.locator(
      'input[name="condition_value"], input[name="threshold"], [data-testid="threshold-input"]',
    )
    if ((await thresholdInput.count()) > 0) {
      await thresholdInput.first().fill('85')
    }

    // severity 선택 (warning)
    const severitySelect = page.locator(
      'select[name="severity"], [data-testid="severity-select"]',
    )
    if ((await severitySelect.count()) > 0) {
      await severitySelect.first().selectOption('warning')
    }

    // 폼 제출
    const submitBtn = page.locator(
      'button[type="submit"], [data-testid="submit-alert-btn"]',
    )
    await submitBtn.first().click()

    // 제출 후 목록 페이지로 이동 또는 성공 메시지 확인
    await page.waitForURL(/\/alerts$/, { timeout: 10000 }).catch(async () => {
      // 페이지 이동 없이 성공 메시지가 표시되는 경우
      const successIndicator = page.locator(
        '[data-testid="toast"], .toast, [role="alert"], .notification',
      ).filter({ hasText: /success|created|생성/i })
      await expect(successIndicator.first()).toBeVisible({ timeout: 5000 })
    })
  })

  // 3. 알림 룰 토글
  test('알림 룰 활성/비활성을 토글할 수 있다', async ({ page }) => {
    // 초기에는 enabled: true
    await mockAuthApi(page)
    await mockServiceApi(page)

    await mockApiResponse(
      page,
      '/api/v1/alerts',
      { alerts: [MOCK_ALERT], total: 1, page: 1, limit: 20 },
      { status: 200, method: 'GET' },
    )

    // PUT /api/v1/alerts/1 — 토글 응답 (비활성화)
    await mockApiResponse(
      page,
      '/api/v1/alerts/1',
      { alert: MOCK_ALERT_DISABLED },
      { status: 200, method: 'PUT' },
    )

    await loginWithToken(page, TEST_ACCESS_TOKEN, TEST_USER_OBJECT)
    await navigateAndWait(page, '/alerts')
    await waitForLoadingToFinish(page)

    // 알림 목록에서 토글 버튼 혹은 스위치 찾기
    const toggleBtn = page.locator(
      '[data-testid="alert-toggle"], input[type="checkbox"], button[aria-label*="toggle"], button[aria-label*="enable"]',
    ).first()
    await expect(toggleBtn).toBeVisible()

    // 현재 상태 기록
    const initialChecked = await toggleBtn
      .evaluate((el) => {
        if (el instanceof HTMLInputElement) return el.checked
        return el.getAttribute('aria-checked') === 'true'
      })
      .catch(() => null)

    // 토글 클릭
    await toggleBtn.click()

    // 상태가 변경되었는지 확인 (토글 후 API 호출 성공)
    await waitForLoadingToFinish(page)

    // 토글 후 상태가 변경되었거나 성공 피드백이 있어야 함
    if (initialChecked !== null) {
      const afterChecked = await toggleBtn
        .evaluate((el) => {
          if (el instanceof HTMLInputElement) return el.checked
          return el.getAttribute('aria-checked') === 'true'
        })
        .catch(() => null)
      expect(afterChecked).not.toBe(initialChecked)
    }
  })

  // 4. 알림 룰 삭제
  test('알림 룰을 삭제하고 목록에서 제거된다', async ({ page }) => {
    await mockAuthApi(page)
    await mockServiceApi(page)

    await mockApiResponse(
      page,
      '/api/v1/alerts',
      { alerts: [MOCK_ALERT], total: 1, page: 1, limit: 20 },
      { status: 200, method: 'GET' },
    )

    // DELETE /api/v1/alerts/1 — 삭제 응답
    await mockApiResponse(
      page,
      '/api/v1/alerts/1',
      { message: 'Alert deleted', id: 1 },
      { status: 200, method: 'DELETE' },
    )

    await loginWithToken(page, TEST_ACCESS_TOKEN, TEST_USER_OBJECT)
    await navigateAndWait(page, '/alerts')
    await waitForLoadingToFinish(page)

    // 알림 이름이 표시되는지 먼저 확인
    await waitForText(page, 'High CPU Alert')

    // 삭제 버튼 클릭
    const deleteBtn = page.locator(
      '[data-testid="alert-delete-btn"], button[aria-label*="delete"], button[aria-label*="삭제"]',
    ).first()
    await expect(deleteBtn).toBeVisible()
    await deleteBtn.click()

    // 확인 다이얼로그 처리 (confirm 대화상자 또는 모달)
    page.on('dialog', async (dialog) => {
      await dialog.accept()
    })

    // 모달 내 확인 버튼이 있는 경우
    const confirmBtn = page.locator(
      '[data-testid="confirm-delete-btn"], button[aria-label*="confirm"], .modal button',
    ).filter({ hasText: /confirm|delete|삭제|확인/i })
    if ((await confirmBtn.count()) > 0) {
      await confirmBtn.first().click()
    }

    await waitForLoadingToFinish(page)

    // 삭제 후 'High CPU Alert'가 목록에서 사라졌는지 확인
    await expect(page.getByText('High CPU Alert')).toHaveCount(0, { timeout: 5000 })
  })
})

// ---------------------------------------------------------------------------
// 인시던트 관리 테스트
// ---------------------------------------------------------------------------

test.describe('인시던트 관리', () => {
  // 5. 인시던트 목록 — 상태 뱃지 표시
  test('인시던트 목록에 open/acknowledged/resolved 상태 뱃지가 표시된다', async ({ page }) => {
    await setupIncidentsPage(page)

    // 테이블 혹은 목록이 표시되는지 확인
    const incidentContainer = page.locator(
      '[data-testid="incidents-table"], table, [data-testid="incidents-list"]',
    )
    await expect(incidentContainer.first()).toBeVisible()

    // 각 상태 뱃지 확인
    const openBadge = page
      .locator('[data-testid="status-badge"], .status-badge, .badge')
      .filter({ hasText: /open/i })
    await expect(openBadge.first()).toBeVisible()

    const acknowledgedBadge = page
      .locator('[data-testid="status-badge"], .status-badge, .badge')
      .filter({ hasText: /acknowledged/i })
    await expect(acknowledgedBadge.first()).toBeVisible()

    const resolvedBadge = page
      .locator('[data-testid="status-badge"], .status-badge, .badge')
      .filter({ hasText: /resolved/i })
    await expect(resolvedBadge.first()).toBeVisible()
  })

  // 6. 인시던트 상세 — 타임라인 이벤트 목록 표시
  test('인시던트 상세 페이지에서 타임라인 이벤트 목록이 표시된다', async ({ page }) => {
    await mockAuthApi(page)
    await mockServiceApi(page)

    // 인시던트 상세 API
    await mockApiResponse(
      page,
      '/api/v1/incidents/1',
      {
        incident: MOCK_INCIDENT_RESOLVED,
        timeline: MOCK_INCIDENT_TIMELINE,
      },
      { status: 200, method: 'GET' },
    )

    await loginWithToken(page, TEST_ACCESS_TOKEN, TEST_USER_OBJECT)
    await navigateAndWait(page, '/incidents/1')
    await waitForLoadingToFinish(page)

    // 타임라인 컨테이너가 표시되는지 확인
    const timeline = page.locator(
      '[data-testid="incident-timeline"], .timeline, [data-testid="timeline"]',
    )
    await expect(timeline.first()).toBeVisible()

    // 타임라인 이벤트 항목들이 존재하는지 확인
    const timelineItems = page.locator(
      '[data-testid="timeline-item"], .timeline-item, .timeline li',
    )
    await expect(timelineItems.first()).toBeVisible()

    // 이벤트 메시지가 하나 이상 표시되는지 확인
    const triggeredEvent = page.getByText(/triggered|Alert triggered/i)
    await expect(triggeredEvent.first()).toBeVisible()
  })

  // 7. 인시던트 acknowledge
  test('인시던트 acknowledge 버튼을 클릭하면 상태가 acknowledged로 변경된다', async ({
    page,
  }) => {
    await mockAuthApi(page)
    await mockServiceApi(page)

    // 인시던트 상세 API — 초기 상태: open
    await mockApiResponse(
      page,
      '/api/v1/incidents/1',
      { incident: MOCK_INCIDENT_OPEN, timeline: [] },
      { status: 200, method: 'GET' },
    )

    // PUT /api/v1/incidents/1/acknowledge — acknowledge 응답
    await mockApiResponse(
      page,
      '/api/v1/incidents/1/acknowledge',
      { incident: MOCK_INCIDENT_ACKNOWLEDGED },
      { status: 200, method: 'PUT' },
    )

    await loginWithToken(page, TEST_ACCESS_TOKEN, TEST_USER_OBJECT)
    await navigateAndWait(page, '/incidents/1')
    await waitForLoadingToFinish(page)

    // acknowledge 버튼 찾기
    const acknowledgeBtn = page.locator(
      '[data-testid="acknowledge-btn"], button[aria-label*="acknowledge"], button',
    ).filter({ hasText: /acknowledge/i })
    await expect(acknowledgeBtn.first()).toBeVisible()
    await acknowledgeBtn.first().click()

    await waitForLoadingToFinish(page)

    // 상태가 acknowledged로 변경되었는지 확인
    const acknowledgedStatus = page
      .locator('[data-testid="incident-status"], .status-badge, .badge, [data-testid="status"]')
      .filter({ hasText: /acknowledged/i })
    await expect(acknowledgedStatus.first()).toBeVisible({ timeout: 5000 })
  })

  // 8. 인시던트 resolve
  test('인시던트 resolve 버튼을 클릭하면 상태가 resolved로 변경된다', async ({ page }) => {
    await mockAuthApi(page)
    await mockServiceApi(page)

    // 인시던트 상세 API — 초기 상태: acknowledged
    await mockApiResponse(
      page,
      '/api/v1/incidents/1',
      { incident: MOCK_INCIDENT_ACKNOWLEDGED, timeline: [] },
      { status: 200, method: 'GET' },
    )

    // PUT /api/v1/incidents/1/resolve — resolve 응답
    await mockApiResponse(
      page,
      '/api/v1/incidents/1/resolve',
      { incident: MOCK_INCIDENT_RESOLVED },
      { status: 200, method: 'PUT' },
    )

    await loginWithToken(page, TEST_ACCESS_TOKEN, TEST_USER_OBJECT)
    await navigateAndWait(page, '/incidents/1')
    await waitForLoadingToFinish(page)

    // resolve 버튼 찾기
    const resolveBtn = page.locator(
      '[data-testid="resolve-btn"], button[aria-label*="resolve"], button',
    ).filter({ hasText: /resolve/i })
    await expect(resolveBtn.first()).toBeVisible()
    await resolveBtn.first().click()

    await waitForLoadingToFinish(page)

    // 상태가 resolved로 변경되었는지 확인
    const resolvedStatus = page
      .locator('[data-testid="incident-status"], .status-badge, .badge, [data-testid="status"]')
      .filter({ hasText: /resolved/i })
    await expect(resolvedStatus.first()).toBeVisible({ timeout: 5000 })
  })
})
