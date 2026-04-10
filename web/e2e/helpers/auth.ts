import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

// ---------------------------------------------------------------------------
// 테스트용 기본 사용자 상수
// ---------------------------------------------------------------------------

/** 기본 테스트 사용자 이메일 */
export const TEST_USER = 'test@vais-monitor.dev'

/** 기본 테스트 사용자 비밀번호 */
export const TEST_PASSWORD = 'password123'

/** 기본 테스트 사용자 객체 (localStorage auth_user 값으로 사용) */
export const TEST_USER_OBJECT = {
  id: 1,
  email: TEST_USER,
  name: 'Test User',
  role: 'member',
  team_id: 1,
}

/** 기본 테스트 액세스 토큰 (JWT 형식 모사) */
export const TEST_ACCESS_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZW1haWwiOiJ0ZXN0QHZhaXMtbW9uaXRvci5kZXYiLCJyb2xlIjoibWVtYmVyIiwiZXhwIjo5OTk5OTk5OTk5fQ.test-signature'

/** 기본 테스트 리프레시 토큰 */
export const TEST_REFRESH_TOKEN = 'test-refresh-token-xyz'

// ---------------------------------------------------------------------------
// 인증 헬퍼 함수
// ---------------------------------------------------------------------------

/**
 * 로그인 폼을 통해 실제 UI 흐름으로 로그인합니다.
 *
 * 1. /auth/login 페이지로 이동
 * 2. 이메일 / 비밀번호 입력
 * 3. 폼 제출
 * 4. 대시보드(/) 로드 완료 대기
 *
 * @param page     Playwright Page 인스턴스
 * @param email    로그인할 이메일 (기본값: TEST_USER)
 * @param password 로그인할 비밀번호 (기본값: TEST_PASSWORD)
 */
export async function login(
  page: Page,
  email: string = TEST_USER,
  password: string = TEST_PASSWORD,
): Promise<void> {
  await page.goto('/auth/login')
  await page.waitForLoadState('networkidle')

  // 이메일 입력
  await page.locator('input#email').fill(email)

  // 비밀번호 입력 — PasswordInput 컴포넌트는 id="password" input을 렌더링
  await page.locator('input#password').fill(password)

  // 폼 제출
  await page.locator('form.auth-form').evaluate((form: HTMLFormElement) => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })

  // 대시보드로 리다이렉트될 때까지 대기 (최대 30초)
  await page.waitForURL('/', { timeout: 30000 })
  await page.waitForLoadState('networkidle')
}

/**
 * localStorage를 직접 조작하여 빠르게 인증 상태를 설정합니다.
 * UI 흐름 없이 인증된 상태로 시작해야 하는 테스트에 적합합니다.
 *
 * localStorage 키:
 * - auth_token        → JWT access token
 * - auth_user         → JSON 직렬화된 AuthUser 객체
 * - auth_refresh_token → refresh token
 *
 * @param page  Playwright Page 인스턴스
 * @param token 사용할 액세스 토큰 (기본값: TEST_ACCESS_TOKEN)
 * @param user  사용할 사용자 객체 (기본값: TEST_USER_OBJECT)
 */
export async function loginWithToken(
  page: Page,
  token: string = TEST_ACCESS_TOKEN,
  user: Record<string, unknown> = TEST_USER_OBJECT,
): Promise<void> {
  // 페이지가 열려있지 않으면 baseURL로 먼저 이동 (localStorage 접근을 위해 동일 출처 필요)
  const url = page.url()
  if (!url || url === 'about:blank') {
    await page.goto('/')
  }

  await page.evaluate(
    ({ token, user, refreshToken }: { token: string; user: string; refreshToken: string }) => {
      localStorage.setItem('auth_token', token)
      localStorage.setItem('auth_user', user)
      localStorage.setItem('auth_refresh_token', refreshToken)
    },
    {
      token,
      user: JSON.stringify(user),
      refreshToken: TEST_REFRESH_TOKEN,
    },
  )
}

/**
 * 로그아웃을 수행합니다.
 *
 * localStorage의 인증 관련 항목을 제거하고
 * /auth/login 페이지로 이동합니다.
 *
 * @param page Playwright Page 인스턴스
 */
export async function logout(page: Page): Promise<void> {
  // localStorage 인증 데이터 제거
  await page.evaluate(() => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    localStorage.removeItem('auth_refresh_token')
  })

  // 로그아웃 후 로그인 페이지로 이동 확인
  await page.goto('/auth/login')
  await page.waitForLoadState('networkidle')

  // 로그인 폼이 표시되는지 확인
  await expect(page.locator('form.auth-form')).toBeVisible()
}
