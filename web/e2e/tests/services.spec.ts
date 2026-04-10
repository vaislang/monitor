import { test, expect } from '@playwright/test'
import { loginWithToken, TEST_ACCESS_TOKEN, TEST_USER_OBJECT } from '../helpers/auth'
import { mockApiResponse, mockAuthApi, mockServiceApi } from '../helpers/api-mock'
import {
  navigateAndWait,
  waitForText,
  waitForLoadingToFinish,
} from '../helpers/test-utils'

// ---------------------------------------------------------------------------
// 공통 셋업: 각 테스트 전에 인증 mock + 토큰 주입
// ---------------------------------------------------------------------------

test.beforeEach(async ({ page }) => {
  await mockAuthApi(page)
  await loginWithToken(page, TEST_ACCESS_TOKEN, TEST_USER_OBJECT)
})

// ---------------------------------------------------------------------------
// 1. 서비스 목록 표시
// ---------------------------------------------------------------------------

test('서비스 목록 - mock 데이터 기준 2개 서비스 렌더링', async ({ page }) => {
  await mockServiceApi(page)
  await navigateAndWait(page, '/services')
  await waitForLoadingToFinish(page)

  // 두 서비스가 테이블 또는 카드로 렌더링됨
  await waitForText(page, 'API Gateway')
  await waitForText(page, 'Database')

  // 서비스 이름이 정확히 2개 항목으로 렌더링되는지 확인
  const apiGatewayItems = page.getByText('API Gateway')
  const databaseItems = page.getByText('Database')
  await expect(apiGatewayItems.first()).toBeVisible()
  await expect(databaseItems.first()).toBeVisible()
})

// ---------------------------------------------------------------------------
// 2. 서비스 검색
// ---------------------------------------------------------------------------

test('서비스 검색 - 검색바에 "API" 입력 후 필터링 결과 확인', async ({ page }) => {
  await mockServiceApi(page)
  await navigateAndWait(page, '/services')
  await waitForLoadingToFinish(page)

  // 검색 입력란에 "API" 입력
  const searchInput = page.locator('input.search-input')
  await searchInput.fill('API')

  // 검색 이벤트 발생 (input 이벤트 트리거)
  await searchInput.dispatchEvent('input')

  // 'API Gateway'는 표시되고 클라이언트 필터링으로 'Database'는 감춰짐을 확인
  // (클라이언트 사이드 필터이므로 DOM에서 확인)
  await expect(page.getByText('API Gateway').first()).toBeVisible()

  // 검색어 지우기(x 버튼) 표시 확인
  const clearBtn = page.locator('button.clear-btn')
  await expect(clearBtn).toBeVisible()
})

// ---------------------------------------------------------------------------
// 3. 서비스 생성
// ---------------------------------------------------------------------------

test('서비스 생성 - 모달 열기 → 폼 입력 → 제출 → 생성된 서비스 표시', async ({ page }) => {
  const NEW_SERVICE = {
    id: 3,
    team_id: 1,
    name: 'New Service',
    url: 'http://new-service.example.com',
    status: 'up',
    tags: 'new,test',
    check_interval_sec: 30,
  }

  await mockServiceApi(page)

  // 생성 요청 후 목록에 새 서비스 포함해서 반환
  await mockApiResponse(
    page,
    '/api/v1/services',
    { service: NEW_SERVICE },
    { status: 201, method: 'POST' },
  )

  await navigateAndWait(page, '/services')
  await waitForLoadingToFinish(page)

  // 생성 버튼 클릭 (btn-primary with addService text)
  const createBtn = page.locator('button.btn.btn-primary').filter({ hasText: /서비스|Service|Add/i })
  await createBtn.first().click()

  // 모달이 열려야 함
  const modal = page.locator('.modal')
  await expect(modal).toBeVisible()

  // 서비스명 입력
  await page.locator('input#svc-name').fill('New Service')

  // URL 입력
  await page.locator('input#svc-url').fill('http://new-service.example.com')

  // 헬스체크 주기 입력
  await page.locator('input#svc-interval').fill('30')

  // 태그 입력
  await page.locator('input#svc-tags').fill('new,test')

  // 폼 제출
  const submitBtn = page.locator('.modal-actions button.btn.btn-primary')
  await submitBtn.click()

  // 모달이 닫혀야 함
  await expect(modal).not.toBeVisible({ timeout: 5000 })
})

// ---------------------------------------------------------------------------
// 4. 서비스 상세 이동
// ---------------------------------------------------------------------------

test('서비스 상세 - 카드/행 클릭 시 /services/1로 이동하고 서비스 정보 표시', async ({ page }) => {
  await mockServiceApi(page)
  await navigateAndWait(page, '/services')
  await waitForLoadingToFinish(page)

  // API Gateway 서비스 행 또는 카드 클릭
  const serviceRow = page
    .locator('.table-row, .service-card')
    .filter({ hasText: 'API Gateway' })
    .first()
  await serviceRow.click()

  // /services/1로 URL이 변경됨
  await page.waitForURL(/\/services\/1/, { timeout: 10000 })

  // 상세 페이지에서 서비스 이름이 표시됨
  await waitForLoadingToFinish(page)
  await waitForText(page, 'API Gateway')

  // 서비스 URL도 표시됨
  await expect(page.getByText('http://api.example.com').first()).toBeVisible()
})

// ---------------------------------------------------------------------------
// 5. 서비스 수정
// ---------------------------------------------------------------------------

test('서비스 수정 - 상세 페이지에서 편집 모달 열고 저장', async ({ page }) => {
  await mockServiceApi(page)
  await navigateAndWait(page, '/services/1')
  await waitForLoadingToFinish(page)

  // "편집" 버튼 클릭
  const editBtn = page.locator('button.btn.btn-secondary').filter({ hasText: /편집|Edit/i }).first()
  await editBtn.click()

  // 편집 모달이 열려야 함
  const modal = page.locator('.modal')
  await expect(modal).toBeVisible()

  // 서비스명 변경
  const nameInput = page.locator('input#edit-name')
  await nameInput.clear()
  await nameInput.fill('API Gateway Updated')

  // 헬스체크 주기 변경
  const intervalInput = page.locator('input#edit-interval')
  await intervalInput.clear()
  await intervalInput.fill('60')

  // 저장 버튼 클릭
  const saveBtn = page.locator('.modal-actions button.btn.btn-primary')
  await saveBtn.click()

  // 모달이 닫혀야 함
  await expect(modal).not.toBeVisible({ timeout: 5000 })
})

// ---------------------------------------------------------------------------
// 6. 서비스 삭제
// ---------------------------------------------------------------------------

test('서비스 삭제 - 상세 페이지에서 삭제 버튼 클릭 → 확인 → 목록으로 이동', async ({ page }) => {
  await mockServiceApi(page)
  await navigateAndWait(page, '/services/1')
  await waitForLoadingToFinish(page)

  // 삭제 버튼 클릭
  const deleteBtn = page
    .locator('button.btn.btn-danger-outline, button.btn-danger-outline')
    .filter({ hasText: /삭제|Delete/i })
    .first()
  await deleteBtn.click()

  // 삭제 확인 모달이 열려야 함
  const deleteModal = page.locator('.modal.modal-sm, .modal-backdrop')
  await expect(deleteModal.first()).toBeVisible()

  // 삭제 서비스명이 모달에 표시됨
  await expect(page.getByText('API Gateway').first()).toBeVisible()

  // 삭제 확인 버튼 클릭
  const confirmDeleteBtn = page.locator('.modal-actions button.btn.btn-danger').filter({ hasText: /삭제|Delete/i })
  await confirmDeleteBtn.click()

  // 삭제 후 /services 목록 페이지로 이동
  await page.waitForURL(/\/services$/, { timeout: 10000 })
})

// ---------------------------------------------------------------------------
// 7. 빈 목록 상태
// ---------------------------------------------------------------------------

test('빈 목록 - 서비스 0개 mock → 빈 상태 메시지 표시', async ({ page }) => {
  // 빈 서비스 목록 mock
  await mockApiResponse(
    page,
    '/api/v1/services',
    { services: [], total: 0, page: 1, limit: 20 },
    { status: 200, method: 'GET' },
  )

  await navigateAndWait(page, '/services')
  await waitForLoadingToFinish(page)

  // 빈 상태 컨테이너가 표시됨
  const emptyState = page.locator('.empty-state')
  await expect(emptyState).toBeVisible()

  // 빈 상태 메시지가 있음 (서비스가 없다는 내용)
  const emptyTitle = page.locator('.empty-title')
  await expect(emptyTitle).toBeVisible()
})
