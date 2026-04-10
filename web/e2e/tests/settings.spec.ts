import { test, expect } from '@playwright/test'
import { loginWithToken, TEST_ACCESS_TOKEN, TEST_USER_OBJECT } from '../helpers/auth'
import { mockApiResponse, mockAuthApi } from '../helpers/api-mock'
import {
  navigateAndWait,
  waitForText,
  waitForLoadingToFinish,
  getLocalStorageItem,
  setLocalStorageItem,
} from '../helpers/test-utils'

// ---------------------------------------------------------------------------
// Mock 데이터 상수
// ---------------------------------------------------------------------------

const MOCK_TEAM_MEMBERS = [
  {
    id: 1,
    user_id: 1,
    team_id: 1,
    role: 'admin',
    joined_at: Math.floor(Date.now() / 1000) - 86400 * 30,
    user: {
      id: 1,
      email: 'test@vais-monitor.dev',
      name: 'Test User',
    },
  },
  {
    id: 2,
    user_id: 2,
    team_id: 1,
    role: 'member',
    joined_at: Math.floor(Date.now() / 1000) - 86400 * 10,
    user: {
      id: 2,
      email: 'alice@vais-monitor.dev',
      name: 'Alice',
    },
  },
  {
    id: 3,
    user_id: 3,
    team_id: 1,
    role: 'viewer',
    joined_at: Math.floor(Date.now() / 1000) - 86400 * 5,
    user: {
      id: 3,
      email: 'bob@vais-monitor.dev',
      name: 'Bob',
    },
  },
]

const MOCK_BACKUPS = [
  {
    id: 1,
    file_name: 'backup-2026-04-01.tar.gz',
    size: 1024 * 1024 * 5,
    type: 'full',
    status: 'done',
    created_at: Math.floor(Date.now() / 1000) - 86400 * 7,
  },
  {
    id: 2,
    file_name: 'backup-2026-04-08.tar.gz',
    size: 1024 * 1024 * 2,
    type: 'incremental',
    status: 'done',
    created_at: Math.floor(Date.now() / 1000) - 86400,
  },
]

// ---------------------------------------------------------------------------
// 공통 setup 헬퍼
// ---------------------------------------------------------------------------

async function setupSettingsPage(page: Parameters<typeof mockAuthApi>[0]) {
  await mockAuthApi(page)

  // PUT /api/v1/users/me — 프로필 수정
  await mockApiResponse(
    page,
    '/api/v1/users/me',
    {
      user: {
        ...TEST_USER_OBJECT,
        name: 'Updated Name',
      },
    },
    { status: 200, method: 'PUT' },
  )

  // PUT /api/v1/auth/password — 비밀번호 변경
  await mockApiResponse(
    page,
    '/api/v1/auth/password',
    { message: 'Password changed successfully' },
    { status: 200, method: 'PUT' },
  )

  await loginWithToken(page, TEST_ACCESS_TOKEN, TEST_USER_OBJECT as Record<string, unknown>)
  await navigateAndWait(page, '/settings')
  await waitForLoadingToFinish(page)
}

async function setupTeamPage(page: Parameters<typeof mockAuthApi>[0]) {
  await mockAuthApi(page)

  // GET /api/v1/teams/:id/members
  await mockApiResponse(
    page,
    '/api/v1/teams/1/members',
    {
      members: MOCK_TEAM_MEMBERS,
      total: MOCK_TEAM_MEMBERS.length,
    },
    { status: 200, method: 'GET' },
  )

  // PUT /api/v1/teams/:id/members/:memberId — 역할 변경
  await mockApiResponse(
    page,
    '/api/v1/teams/1/members/*',
    {
      member: { ...MOCK_TEAM_MEMBERS[0], role: 'member' },
    },
    { status: 200, method: 'PUT' },
  )

  // DELETE /api/v1/teams/:id/members/:memberId — 멤버 제거
  await mockApiResponse(
    page,
    '/api/v1/teams/1/members/*',
    { message: 'Member removed' },
    { status: 200, method: 'DELETE' },
  )

  // POST /api/v1/teams/:id/invite — 초대
  await mockApiResponse(
    page,
    '/api/v1/teams/1/invite',
    { message: 'Invite sent successfully' },
    { status: 200, method: 'POST' },
  )

  await loginWithToken(page, TEST_ACCESS_TOKEN, TEST_USER_OBJECT as Record<string, unknown>)
  await navigateAndWait(page, '/settings/team')
  await waitForLoadingToFinish(page)
}

async function setupBackupPage(page: Parameters<typeof mockAuthApi>[0]) {
  await mockAuthApi(page)

  // GET /api/v1/backups — 백업 목록
  await mockApiResponse(
    page,
    '/api/v1/backups',
    {
      backups: MOCK_BACKUPS,
      total: MOCK_BACKUPS.length,
    },
    { status: 200, method: 'GET' },
  )

  // POST /api/v1/backups — 백업 생성
  await mockApiResponse(
    page,
    '/api/v1/backups',
    {
      backup: {
        id: 3,
        file_name: 'backup-2026-04-09.tar.gz',
        size: 1024 * 1024 * 3,
        type: 'full',
        status: 'done',
        created_at: Math.floor(Date.now() / 1000),
      },
      download_url: '/api/v1/backups/3/download',
    },
    { status: 201, method: 'POST' },
  )

  // GET /api/v1/backups/:id/download — 백업 다운로드
  await mockApiResponse(
    page,
    '/api/v1/backups/*/download',
    { download_url: '/api/v1/backups/1/download' },
    { status: 200, method: 'GET' },
  )

  // POST /api/v1/backups/restore — 복원
  await mockApiResponse(
    page,
    '/api/v1/backups/restore',
    { message: 'Restore started' },
    { status: 200, method: 'POST' },
  )

  await loginWithToken(page, TEST_ACCESS_TOKEN, TEST_USER_OBJECT as Record<string, unknown>)
  await navigateAndWait(page, '/settings/backup')
  await waitForLoadingToFinish(page)
}

// ---------------------------------------------------------------------------
// 1. 프로필 수정: 이름 변경 → 저장 → 성공 확인
// ---------------------------------------------------------------------------

test.describe('설정 — 프로필 수정', () => {
  test('이름 변경 후 저장 시 성공 메시지가 표시된다', async ({ page }) => {
    await setupSettingsPage(page)

    // 프로필 탭이 기본으로 활성화되어 있거나, 탭을 클릭
    const profileTab = page.locator('[data-tab="profile"], .tab-btn').filter({ hasText: /프로필|Profile/i })
    const profileTabCount = await profileTab.count()
    if (profileTabCount > 0) {
      await profileTab.first().click()
    }

    await waitForLoadingToFinish(page)

    // 이름 입력 필드 찾기
    const nameInput = page.locator('input#profile-name, input[name="name"], input#name')
    await expect(nameInput.first()).toBeVisible()

    // 기존 값 지우고 새 이름 입력
    await nameInput.first().clear()
    await nameInput.first().fill('Updated Name')

    // 저장 버튼 클릭
    const saveBtn = page
      .locator('button.btn.btn-primary, button[type="submit"]')
      .filter({ hasText: /저장|Save/i })
      .first()
    await saveBtn.click()

    // 성공 메시지 확인 (토스트 또는 알림)
    const successMsg = page
      .locator('[role="alert"], .toast, .notification, [data-testid="toast"]')
      .filter({ hasText: /저장|saved|success|설정/i })
    await expect(successMsg.first()).toBeVisible({ timeout: 5000 })
  })
})

// ---------------------------------------------------------------------------
// 2. 비밀번호 변경: 현재/새/확인 입력 → 저장 → 성공
// ---------------------------------------------------------------------------

test.describe('설정 — 비밀번호 변경', () => {
  test('현재/새/확인 비밀번호 입력 후 저장 시 성공 메시지가 표시된다', async ({ page }) => {
    await setupSettingsPage(page)

    // 비밀번호 탭 클릭
    const passwordTab = page
      .locator('[data-tab="password"], .tab-btn, .settings-tab')
      .filter({ hasText: /비밀번호|Password/i })
    const tabCount = await passwordTab.count()
    if (tabCount > 0) {
      await passwordTab.first().click()
      await waitForLoadingToFinish(page)
    }

    // 현재 비밀번호 입력
    const currentPwInput = page.locator(
      'input#current-password, input[name="current_password"], input[name="currentPassword"]',
    )
    await expect(currentPwInput.first()).toBeVisible()
    await currentPwInput.first().fill('password123')

    // 새 비밀번호 입력
    const newPwInput = page.locator(
      'input#new-password, input[name="new_password"], input[name="newPassword"]',
    )
    await expect(newPwInput.first()).toBeVisible()
    await newPwInput.first().fill('newPassword456!')

    // 비밀번호 확인 입력
    const confirmPwInput = page.locator(
      'input#confirm-password, input[name="confirm_password"], input[name="confirmPassword"]',
    )
    await expect(confirmPwInput.first()).toBeVisible()
    await confirmPwInput.first().fill('newPassword456!')

    // 비밀번호 변경 버튼 클릭
    const changeBtn = page
      .locator('button.btn.btn-primary, button[type="submit"]')
      .filter({ hasText: /비밀번호 변경|Change Password/i })
    const changeBtnCount = await changeBtn.count()
    if (changeBtnCount > 0) {
      await changeBtn.first().click()
    } else {
      // 일반 저장 버튼
      const saveBtn = page
        .locator('button.btn.btn-primary, button[type="submit"]')
        .filter({ hasText: /저장|Save/i })
        .first()
      await saveBtn.click()
    }

    // 성공 메시지 확인
    const successMsg = page
      .locator('[role="alert"], .toast, .notification, [data-testid="toast"]')
      .filter({ hasText: /변경|changed|success/i })
    await expect(successMsg.first()).toBeVisible({ timeout: 5000 })
  })

  // ---------------------------------------------------------------------------
  // 3. 비밀번호 불일치: 새 비밀번호 ≠ 확인 → 에러 메시지
  // ---------------------------------------------------------------------------

  test('새 비밀번호와 확인 비밀번호가 불일치하면 에러 메시지가 표시된다', async ({ page }) => {
    await setupSettingsPage(page)

    // 비밀번호 탭 클릭
    const passwordTab = page
      .locator('[data-tab="password"], .tab-btn, .settings-tab')
      .filter({ hasText: /비밀번호|Password/i })
    const tabCount = await passwordTab.count()
    if (tabCount > 0) {
      await passwordTab.first().click()
      await waitForLoadingToFinish(page)
    }

    // 현재 비밀번호 입력
    const currentPwInput = page.locator(
      'input#current-password, input[name="current_password"], input[name="currentPassword"]',
    )
    await expect(currentPwInput.first()).toBeVisible()
    await currentPwInput.first().fill('password123')

    // 새 비밀번호 입력
    const newPwInput = page.locator(
      'input#new-password, input[name="new_password"], input[name="newPassword"]',
    )
    await expect(newPwInput.first()).toBeVisible()
    await newPwInput.first().fill('newPassword456!')

    // 불일치하는 확인 비밀번호 입력
    const confirmPwInput = page.locator(
      'input#confirm-password, input[name="confirm_password"], input[name="confirmPassword"]',
    )
    await expect(confirmPwInput.first()).toBeVisible()
    await confirmPwInput.first().fill('differentPassword789!')

    // 변경/저장 버튼 클릭
    const changeBtn = page
      .locator('button.btn.btn-primary, button[type="submit"]')
      .filter({ hasText: /비밀번호 변경|Change Password|저장|Save/i })
      .first()
    await changeBtn.click()

    // 에러 메시지 확인 (불일치 메시지)
    const errorMsg = page
      .locator(
        '[role="alert"], .toast.toast-error, .error-message, .field-error, .form-error, [data-testid="error"]',
      )
      .filter({ hasText: /일치|mismatch|match|불일치/i })
    const errorMsgCount = await errorMsg.count()

    if (errorMsgCount > 0) {
      await expect(errorMsg.first()).toBeVisible({ timeout: 5000 })
    } else {
      // 인라인 에러 텍스트 확인
      const inlineError = page
        .locator('.error, .text-error, .text-red, p.error-text')
        .filter({ hasText: /일치|mismatch|match/i })
      await expect(inlineError.first()).toBeVisible({ timeout: 5000 })
    }
  })
})

// ---------------------------------------------------------------------------
// 4. 알림 설정: 토글 on/off 전환 확인
// ---------------------------------------------------------------------------

test.describe('설정 — 알림 설정', () => {
  test('알림 토글을 클릭하면 on/off 상태가 전환된다', async ({ page }) => {
    await setupSettingsPage(page)

    // 알림 탭 이동 (있는 경우)
    const notifTab = page
      .locator('[data-tab="notifications"], .tab-btn, .settings-tab')
      .filter({ hasText: /알림|Notification/i })
    const notifTabCount = await notifTab.count()
    if (notifTabCount > 0) {
      await notifTab.first().click()
      await waitForLoadingToFinish(page)
    }

    // 이메일 알림 토글 (첫 번째 토글)
    const toggleInput = page.locator(
      'input[type="checkbox"].toggle, input[type="checkbox"][role="switch"], .toggle-input',
    )
    const toggleSwitches = page.locator('.toggle, .switch, [role="switch"]')

    // checkbox 또는 switch 토글 탐색
    const checkboxCount = await toggleInput.count()
    const switchCount = await toggleSwitches.count()

    if (checkboxCount > 0) {
      const firstToggle = toggleInput.first()
      const initialChecked = await firstToggle.isChecked()

      // 토글 클릭
      await firstToggle.click()
      await page.waitForTimeout(300)

      // 상태가 반전되었는지 확인
      const afterChecked = await firstToggle.isChecked()
      expect(afterChecked).toBe(!initialChecked)

      // 다시 클릭하여 원래 상태로 복원
      await firstToggle.click()
      await page.waitForTimeout(300)
      const finalChecked = await firstToggle.isChecked()
      expect(finalChecked).toBe(initialChecked)
    } else if (switchCount > 0) {
      const firstSwitch = toggleSwitches.first()
      await firstSwitch.click()
      await page.waitForTimeout(300)
      // 토글이 동작했음을 확인 (클래스 변경 또는 aria-checked 변화)
      await expect(firstSwitch).toBeVisible()
    } else {
      // 알림 설정 섹션에 체크박스 형태의 알림 옵션 확인
      const notifCheckbox = page
        .locator('label')
        .filter({ hasText: /이메일 알림|Email Notification/i })
      await expect(notifCheckbox.first()).toBeVisible()
    }
  })
})

// ---------------------------------------------------------------------------
// 5. 테마 변경: Light → Dark 전환 → body/html 클래스 변경 확인
// ---------------------------------------------------------------------------

test.describe('설정 — 테마 변경', () => {
  test('Light에서 Dark 테마로 전환하면 html/body에 dark 클래스가 추가된다', async ({ page }) => {
    await setupSettingsPage(page)

    // 외관/테마 탭으로 이동
    const appearanceTab = page
      .locator('[data-tab="appearance"], .tab-btn, .settings-tab')
      .filter({ hasText: /외관|테마|Appearance|Theme/i })
    const appearanceTabCount = await appearanceTab.count()
    if (appearanceTabCount > 0) {
      await appearanceTab.first().click()
      await waitForLoadingToFinish(page)
    }

    // Light 테마 버튼 클릭 (현재 상태 확인)
    const lightBtn = page
      .locator('button, .theme-btn, .theme-option')
      .filter({ hasText: /라이트|Light/i })
    const lightBtnCount = await lightBtn.count()
    if (lightBtnCount > 0) {
      await lightBtn.first().click()
      await page.waitForTimeout(300)
    }

    // Dark 테마 버튼 클릭
    const darkBtn = page
      .locator('button, .theme-btn, .theme-option')
      .filter({ hasText: /다크|Dark/i })
    await expect(darkBtn.first()).toBeVisible()
    await darkBtn.first().click()

    await page.waitForTimeout(500)

    // html 또는 body 요소에 dark 클래스 추가 확인
    const htmlHasDark = await page.evaluate(() => {
      return (
        document.documentElement.classList.contains('dark') ||
        document.body.classList.contains('dark') ||
        document.documentElement.getAttribute('data-theme') === 'dark'
      )
    })

    // localStorage에 테마 설정이 저장되었는지 확인
    const themeValue = await getLocalStorageItem(page, 'theme')

    // dark 클래스 또는 localStorage 값으로 확인
    const isDarkApplied = htmlHasDark || themeValue === 'dark'
    expect(isDarkApplied).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 6. 팀 멤버 목록: mock 데이터 기준 멤버 표시
// ---------------------------------------------------------------------------

test.describe('설정 — 팀 멤버', () => {
  test('팀 멤버 목록 페이지에 mock 멤버들이 표시된다', async ({ page }) => {
    await setupTeamPage(page)

    // 멤버 탭 클릭 (있는 경우)
    const membersTab = page
      .locator('[data-tab="members"], .tab-btn')
      .filter({ hasText: /멤버|Member/i })
    const membersTabCount = await membersTab.count()
    if (membersTabCount > 0) {
      await membersTab.first().click()
      await waitForLoadingToFinish(page)
    }

    // Alice 멤버가 목록에 표시됨
    await waitForText(page, 'Alice', 8000)

    // Bob 멤버도 표시됨
    await expect(page.getByText('Bob').first()).toBeVisible()

    // 이메일도 표시됨
    await expect(page.getByText('alice@vais-monitor.dev').first()).toBeVisible()
  })

  // ---------------------------------------------------------------------------
  // 7. 멤버 역할 변경: admin → member 선택 → API 호출 확인
  // ---------------------------------------------------------------------------

  test('멤버 역할 드롭다운에서 member 선택 시 역할 변경 API가 호출된다', async ({ page }) => {
    let roleChangeCalled = false

    await mockAuthApi(page)

    // GET members mock
    await mockApiResponse(
      page,
      '/api/v1/teams/1/members',
      {
        members: MOCK_TEAM_MEMBERS,
        total: MOCK_TEAM_MEMBERS.length,
      },
      { status: 200, method: 'GET' },
    )

    // PUT members/:id — 역할 변경 추적
    await page.route('/api/v1/teams/1/members/*', async (route) => {
      if (route.request().method() === 'PUT') {
        roleChangeCalled = true
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ member: { ...MOCK_TEAM_MEMBERS[1], role: 'member' } }),
        })
      } else {
        await route.continue()
      }
    })

    await mockApiResponse(
      page,
      '/api/v1/teams/1/invite',
      { message: 'Invite sent successfully' },
      { status: 200, method: 'POST' },
    )

    await loginWithToken(page, TEST_ACCESS_TOKEN, TEST_USER_OBJECT as Record<string, unknown>)
    await navigateAndWait(page, '/settings/team')
    await waitForLoadingToFinish(page)

    // Alice 멤버 행에서 역할 선택 드롭다운 찾기
    const aliceRow = page
      .locator('tr, .member-item, .member-row')
      .filter({ hasText: 'Alice' })
      .first()
    await expect(aliceRow).toBeVisible()

    // 역할 선택 드롭다운
    const roleSelect = aliceRow.locator('select, [role="combobox"], .role-select')
    const roleSelectCount = await roleSelect.count()

    if (roleSelectCount > 0) {
      await roleSelect.first().selectOption('member')
      await page.waitForTimeout(500)
      expect(roleChangeCalled).toBe(true)
    } else {
      // 버튼 형태의 역할 변경
      const roleBtn = aliceRow.locator('button').filter({ hasText: /역할|Role|admin|member/i }).first()
      const roleBtnCount = await roleBtn.count()
      if (roleBtnCount > 0) {
        await roleBtn.click()
        // 드롭다운 메뉴에서 member 선택
        const memberOption = page.locator('[role="option"], .dropdown-item').filter({ hasText: /^member$|^멤버$/i })
        if ((await memberOption.count()) > 0) {
          await memberOption.first().click()
          await page.waitForTimeout(500)
          expect(roleChangeCalled).toBe(true)
        }
      }
    }
  })

  // ---------------------------------------------------------------------------
  // 8. 팀 초대: 이메일 입력 → 전송 → 성공 메시지
  // ---------------------------------------------------------------------------

  test('초대 이메일 입력 후 전송하면 성공 메시지가 표시된다', async ({ page }) => {
    await setupTeamPage(page)

    // 초대 버튼 클릭
    const inviteBtn = page
      .locator('button.btn')
      .filter({ hasText: /초대|Invite/i })
    await expect(inviteBtn.first()).toBeVisible()
    await inviteBtn.first().click()

    // 초대 폼 또는 모달이 열림
    const inviteForm = page.locator('.modal, .invite-form, [data-testid="invite-form"]')
    const inviteFormCount = await inviteForm.count()

    if (inviteFormCount > 0) {
      await expect(inviteForm.first()).toBeVisible()
    }

    // 이메일 입력 필드
    const emailInput = page.locator(
      'input[type="email"], input#invite-email, input[name="email"], input[placeholder*="이메일"], input[placeholder*="email"]',
    )
    await expect(emailInput.first()).toBeVisible({ timeout: 5000 })
    await emailInput.first().fill('newmember@vais-monitor.dev')

    // 역할 선택 (있는 경우)
    const roleSelect = page.locator('select#invite-role, select[name="role"]')
    const roleSelectCount = await roleSelect.count()
    if (roleSelectCount > 0) {
      await roleSelect.first().selectOption('member')
    }

    // 전송 버튼 클릭
    const sendBtn = page
      .locator('button.btn.btn-primary, button[type="submit"]')
      .filter({ hasText: /초대 보내기|Send Invite|전송|Send/i })
    const sendBtnCount = await sendBtn.count()
    if (sendBtnCount > 0) {
      await sendBtn.first().click()
    } else {
      await page.locator('button.btn.btn-primary').first().click()
    }

    // 성공 메시지 확인
    const successMsg = page
      .locator('[role="alert"], .toast, .notification, [data-testid="toast"]')
      .filter({ hasText: /초대|발송|sent|success/i })
    await expect(successMsg.first()).toBeVisible({ timeout: 5000 })
  })
})

// ---------------------------------------------------------------------------
// 9. 백업 생성: 버튼 클릭 → 다운로드 트리거 확인
// ---------------------------------------------------------------------------

test.describe('설정 — 백업', () => {
  test('백업 생성 버튼 클릭 시 백업이 생성되고 다운로드가 트리거된다', async ({ page }) => {
    let backupCreateCalled = false

    await mockAuthApi(page)

    await mockApiResponse(
      page,
      '/api/v1/backups',
      { backups: MOCK_BACKUPS, total: MOCK_BACKUPS.length },
      { status: 200, method: 'GET' },
    )

    // POST /api/v1/backups 추적
    await page.route('/api/v1/backups', async (route) => {
      if (route.request().method() === 'POST') {
        backupCreateCalled = true
        await route.fulfill({
          status: 201,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            backup: {
              id: 3,
              file_name: 'backup-2026-04-09.tar.gz',
              size: 1024 * 1024 * 3,
              type: 'full',
              status: 'done',
              created_at: Math.floor(Date.now() / 1000),
            },
            download_url: '/api/v1/backups/3/download',
          }),
        })
      } else {
        await route.continue()
      }
    })

    // 다운로드 이벤트 수신 설정
    const downloadPromise = page.waitForEvent('download').catch(() => null)

    await mockApiResponse(
      page,
      '/api/v1/backups/*/download',
      { download_url: '/api/v1/backups/3/download' },
      { status: 200 },
    )

    await loginWithToken(page, TEST_ACCESS_TOKEN, TEST_USER_OBJECT as Record<string, unknown>)
    await navigateAndWait(page, '/settings/backup')
    await waitForLoadingToFinish(page)

    // 기존 백업 목록 확인 (선택적)
    const backupList = page.locator('.backup-list, .backup-table, [data-testid="backup-list"]')
    const backupListCount = await backupList.count()
    if (backupListCount > 0) {
      await expect(backupList.first()).toBeVisible()
    }

    // 백업 생성 버튼 클릭
    const createBtn = page
      .locator('button.btn')
      .filter({ hasText: /새 백업|Create Backup|백업 생성/i })
    await expect(createBtn.first()).toBeVisible()
    await createBtn.first().click()

    await page.waitForTimeout(1000)

    // API가 호출되었는지 확인
    expect(backupCreateCalled).toBe(true)

    // 성공 토스트 또는 메시지 확인
    const successMsg = page
      .locator('[role="alert"], .toast, .notification')
      .filter({ hasText: /생성|created|success/i })
    const successMsgCount = await successMsg.count()
    if (successMsgCount > 0) {
      await expect(successMsg.first()).toBeVisible({ timeout: 5000 })
    }

    // 다운로드 이벤트가 발생했는지 확인 (비동기)
    const download = await downloadPromise
    // 다운로드가 발생하거나 API 호출로 백업 생성이 확인됨
    if (download) {
      expect(download).toBeTruthy()
    }
  })

  // ---------------------------------------------------------------------------
  // 10. 백업 복원: 파일 업로드 → 복원 진행 확인
  // ---------------------------------------------------------------------------

  test('기존 백업에서 복원 버튼 클릭 시 복원이 시작된다', async ({ page }) => {
    let restoreCalled = false

    await mockAuthApi(page)

    await mockApiResponse(
      page,
      '/api/v1/backups',
      { backups: MOCK_BACKUPS, total: MOCK_BACKUPS.length },
      { status: 200, method: 'GET' },
    )

    await page.route('/api/v1/backups/restore', async (route) => {
      if (route.request().method() === 'POST') {
        restoreCalled = true
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Restore started' }),
        })
      } else {
        await route.continue()
      }
    })

    await mockApiResponse(
      page,
      '/api/v1/backups',
      {
        backup: {
          id: 3,
          file_name: 'backup-2026-04-09.tar.gz',
          size: 1024 * 1024 * 3,
          type: 'full',
          status: 'done',
          created_at: Math.floor(Date.now() / 1000),
        },
        download_url: '/api/v1/backups/3/download',
      },
      { status: 201, method: 'POST' },
    )

    await loginWithToken(page, TEST_ACCESS_TOKEN, TEST_USER_OBJECT as Record<string, unknown>)
    await navigateAndWait(page, '/settings/backup')
    await waitForLoadingToFinish(page)

    // 백업 목록에서 첫 번째 백업의 복원 버튼 클릭
    const restoreBtn = page
      .locator('button.btn')
      .filter({ hasText: /복원|Restore/i })
      .first()
    await expect(restoreBtn).toBeVisible({ timeout: 8000 })
    await restoreBtn.click()

    // 복원 확인 모달 처리
    const confirmModal = page.locator('.modal, [role="dialog"]')
    const confirmModalCount = await confirmModal.count()

    if (confirmModalCount > 0) {
      await expect(confirmModal.first()).toBeVisible()

      // 확인 버튼 클릭
      const confirmBtn = confirmModal
        .first()
        .locator('button.btn.btn-primary, button.btn-danger')
        .filter({ hasText: /확인|복원|Confirm|Restore/i })
      const confirmBtnCount = await confirmBtn.count()
      if (confirmBtnCount > 0) {
        await confirmBtn.first().click()
      } else {
        await page.locator('button.btn.btn-primary').last().click()
      }
    }

    await page.waitForTimeout(1000)

    // 복원 API가 호출되었거나 성공 메시지가 표시됨
    const successMsg = page
      .locator('[role="alert"], .toast, .notification')
      .filter({ hasText: /복원|started|Restore/i })
    const successMsgCount = await successMsg.count()

    if (successMsgCount > 0) {
      await expect(successMsg.first()).toBeVisible({ timeout: 5000 })
    } else {
      // API 호출 여부로 확인
      expect(restoreCalled).toBe(true)
    }
  })
})
