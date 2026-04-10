import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import * as path from 'path'

// ---------------------------------------------------------------------------
// 페이지 로드 유틸리티
// ---------------------------------------------------------------------------

/**
 * 페이지가 완전히 로드될 때까지 대기합니다.
 * 'networkidle' 상태 — 500ms 동안 네트워크 요청이 없을 때 완료로 판단합니다.
 *
 * @param page Playwright Page 인스턴스
 */
export async function waitForPageLoad(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle')
}

// ---------------------------------------------------------------------------
// 셀렉터 헬퍼
// ---------------------------------------------------------------------------

/**
 * data-testid 속성으로 요소를 선택하는 헬퍼입니다.
 * [data-testid="<id>"] 셀렉터를 반환합니다.
 *
 * @param page Playwright Page 인스턴스
 * @param id   data-testid 값
 * @returns    Locator 인스턴스
 *
 * @example
 * const btn = getByTestId(page, 'submit-button')
 * await btn.click()
 */
export function getByTestId(page: Page, id: string): Locator {
  return page.locator(`[data-testid="${id}"]`)
}

// ---------------------------------------------------------------------------
// 토스트 알림 검증
// ---------------------------------------------------------------------------

/**
 * 토스트(toast) 알림 메시지가 화면에 표시되는지 확인합니다.
 *
 * 토스트 컨테이너 셀렉터 후보를 순서대로 시도합니다:
 * 1. [data-testid="toast"]
 * 2. .toast
 * 3. .notification
 * 4. [role="alert"]
 *
 * @param page    Playwright Page 인스턴스
 * @param message 확인할 메시지 텍스트 (부분 일치)
 * @param timeout 대기 타임아웃 (ms, 기본값: 5000)
 */
export async function expectToast(
  page: Page,
  message: string,
  timeout: number = 5000,
): Promise<void> {
  // 토스트 컨테이너 셀렉터 — 프레임워크별 클래스를 순서대로 시도
  const toastSelectors = [
    '[data-testid="toast"]',
    '.toast',
    '.notification',
    '[role="alert"]',
    '.alert',
  ]

  // 지정한 메시지가 포함된 토스트 요소 탐색
  let toastLocator: Locator | null = null

  for (const selector of toastSelectors) {
    const locator = page.locator(selector).filter({ hasText: message })
    const count = await locator.count()
    if (count > 0) {
      toastLocator = locator
      break
    }
  }

  // 즉시 찾지 못한 경우 첫 번째 셀렉터로 대기
  if (!toastLocator) {
    toastLocator = page.locator(toastSelectors[0]).filter({ hasText: message })
  }

  await expect(toastLocator.first()).toBeVisible({ timeout })
  await expect(toastLocator.first()).toContainText(message)
}

// ---------------------------------------------------------------------------
// 스크린샷 유틸리티
// ---------------------------------------------------------------------------

/**
 * 스크린샷을 지정한 이름으로 저장합니다.
 * 저장 경로: ./test-results/screenshots/<name>-<timestamp>.png
 *
 * @param page Playwright Page 인스턴스
 * @param name 파일 이름 식별자 (확장자 제외)
 *
 * @example
 * await takeScreenshot(page, 'dashboard-initial-state')
 * // -> ./test-results/screenshots/dashboard-initial-state-1712620800000.png
 */
export async function takeScreenshot(page: Page, name: string): Promise<void> {
  const timestamp = Date.now()
  const filename = `${name}-${timestamp}.png`
  const screenshotsDir = path.join(__dirname, '..', 'test-results', 'screenshots')
  const filePath = path.join(screenshotsDir, filename)

  await page.screenshot({
    path: filePath,
    fullPage: true,
  })
}

// ---------------------------------------------------------------------------
// 추가 범용 유틸리티
// ---------------------------------------------------------------------------

/**
 * 지정한 URL로 이동하고 페이지가 완전히 로드될 때까지 대기합니다.
 *
 * @param page Playwright Page 인스턴스
 * @param url  이동할 URL (절대 경로 또는 baseURL 기준 상대 경로)
 */
export async function navigateAndWait(page: Page, url: string): Promise<void> {
  await page.goto(url)
  await waitForPageLoad(page)
}

/**
 * 특정 텍스트가 페이지에 표시될 때까지 대기합니다.
 *
 * @param page    Playwright Page 인스턴스
 * @param text    대기할 텍스트
 * @param timeout 타임아웃 (ms, 기본값: 5000)
 */
export async function waitForText(
  page: Page,
  text: string,
  timeout: number = 5000,
): Promise<void> {
  await expect(page.getByText(text).first()).toBeVisible({ timeout })
}

/**
 * 로딩 스피너/인디케이터가 사라질 때까지 대기합니다.
 *
 * @param page    Playwright Page 인스턴스
 * @param timeout 타임아웃 (ms, 기본값: 10000)
 */
export async function waitForLoadingToFinish(
  page: Page,
  timeout: number = 10000,
): Promise<void> {
  // 로딩 인디케이터 셀렉터 후보
  const loadingSelectors = [
    '.btn-spinner',
    '[data-testid="loading"]',
    '.loading',
    '.spinner',
  ]

  for (const selector of loadingSelectors) {
    const locator = page.locator(selector)
    const count = await locator.count()
    if (count > 0) {
      await expect(locator.first()).not.toBeVisible({ timeout })
    }
  }
}

/**
 * 현재 페이지의 localStorage에서 값을 읽어옵니다.
 *
 * @param page Playwright Page 인스턴스
 * @param key  localStorage 키
 * @returns    저장된 값 또는 null
 */
export async function getLocalStorageItem(
  page: Page,
  key: string,
): Promise<string | null> {
  return page.evaluate((k: string) => localStorage.getItem(k), key)
}

/**
 * 현재 페이지의 localStorage에 값을 저장합니다.
 *
 * @param page  Playwright Page 인스턴스
 * @param key   localStorage 키
 * @param value 저장할 값
 */
export async function setLocalStorageItem(
  page: Page,
  key: string,
  value: string,
): Promise<void> {
  await page.evaluate(
    ({ k, v }: { k: string; v: string }) => localStorage.setItem(k, v),
    { k: key, v: value },
  )
}
