import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn()
const mockToggleTheme = vi.fn()
const mockToggleLocale = vi.fn()
const mockLogout = vi.fn()

vi.mock('../../app/stores/app.vais', () => ({
  appStore: {
    page_title: 'Dashboard',
    notifications_count: 0,
    theme: 'light',
    locale: 'ko',
  },
  toggle_theme: mockToggleTheme,
  toggle_locale: mockToggleLocale,
  locale_to_str: (state: any) => state.locale === 'ko' ? 'ko' : 'en',
  is_dark_theme: (state: any) => state.theme === 'dark',
}))

vi.mock('../../app/stores/auth.vais', () => ({
  authStore: {
    user: JSON.stringify({ id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin' }),
    is_authenticated: true,
  },
  logout: mockLogout,
}))

vi.mock('../../app/i18n.vais', () => ({
  t: (key: string) => key,
}))

;(globalThis as any).router = { navigate: mockNavigate }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface HeaderState {
  pageTitle: string
  notificationsCount: number
  isDarkTheme: boolean
  currentLocale: string
  userMenuOpen: boolean
  userName: string
  userEmail: string
  userRole: string
  userInitial: string
}

function mount(state: Partial<HeaderState> = {}) {
  const defaults: HeaderState = {
    pageTitle: 'Dashboard',
    notificationsCount: 0,
    isDarkTheme: false,
    currentLocale: 'ko',
    userMenuOpen: false,
    userName: 'Alice',
    userEmail: 'alice@example.com',
    userRole: 'admin',
    userInitial: 'A',
    ...state,
  }

  const header = document.createElement('header')
  header.className = 'app-header'

  // Left: page title
  const left = document.createElement('div')
  left.className = 'header-left'
  const h1 = document.createElement('h1')
  h1.className = 'page-title'
  h1.textContent = defaults.pageTitle
  left.appendChild(h1)
  header.appendChild(left)

  // Right: buttons + user menu
  const right = document.createElement('div')
  right.className = 'header-right'

  // Notification button
  const notifBtn = document.createElement('button')
  notifBtn.className = 'header-btn notification-btn'
  notifBtn.setAttribute('data-testid', 'notification-btn')
  const bellIcon = document.createElement('span')
  bellIcon.className = 'btn-icon'
  bellIcon.textContent = '🔔'
  notifBtn.appendChild(bellIcon)
  if (defaults.notificationsCount > 0) {
    const badge = document.createElement('span')
    badge.className = 'badge'
    badge.textContent = defaults.notificationsCount > 99 ? '99+' : String(defaults.notificationsCount)
    notifBtn.appendChild(badge)
  }
  right.appendChild(notifBtn)

  // Locale toggle button
  const localeBtn = document.createElement('button')
  localeBtn.className = 'header-btn locale-btn'
  localeBtn.setAttribute('data-testid', 'locale-btn')
  const localeIcon = document.createElement('span')
  localeIcon.className = 'btn-icon'
  localeIcon.textContent = defaults.currentLocale === 'ko' ? 'KO' : 'EN'
  localeBtn.appendChild(localeIcon)
  right.appendChild(localeBtn)

  // Theme toggle button
  const themeBtn = document.createElement('button')
  themeBtn.className = 'header-btn theme-btn'
  themeBtn.setAttribute('data-testid', 'theme-btn')
  const themeIcon = document.createElement('span')
  themeIcon.className = 'btn-icon'
  themeIcon.textContent = defaults.isDarkTheme ? '☀' : '☾'
  themeBtn.appendChild(themeIcon)
  right.appendChild(themeBtn)

  // User menu
  const userMenu = document.createElement('div')
  userMenu.className = 'user-menu'

  const userBtn = document.createElement('button')
  userBtn.className = 'user-btn'
  userBtn.setAttribute('data-testid', 'user-btn')

  const avatar = document.createElement('div')
  avatar.className = 'user-avatar'
  avatar.textContent = defaults.userInitial

  const userInfo = document.createElement('div')
  userInfo.className = 'user-info'
  const userName = document.createElement('span')
  userName.className = 'user-name'
  userName.textContent = defaults.userName
  const userRole = document.createElement('span')
  userRole.className = 'user-role'
  userRole.textContent = defaults.userRole
  userInfo.appendChild(userName)
  userInfo.appendChild(userRole)

  const chevron = document.createElement('span')
  chevron.className = 'chevron'
  chevron.textContent = defaults.userMenuOpen ? '▲' : '▼'

  userBtn.appendChild(avatar)
  userBtn.appendChild(userInfo)
  userBtn.appendChild(chevron)
  userMenu.appendChild(userBtn)

  if (defaults.userMenuOpen) {
    const dropdown = document.createElement('div')
    dropdown.className = 'user-dropdown'
    dropdown.setAttribute('data-testid', 'user-dropdown')

    const dropdownHeader = document.createElement('div')
    dropdownHeader.className = 'dropdown-header'
    const emailSpan = document.createElement('span')
    emailSpan.className = 'dropdown-email'
    emailSpan.textContent = defaults.userEmail
    dropdownHeader.appendChild(emailSpan)
    dropdown.appendChild(dropdownHeader)

    const divider1 = document.createElement('div')
    divider1.className = 'dropdown-divider'
    dropdown.appendChild(divider1)

    const settingsItem = document.createElement('a')
    settingsItem.className = 'dropdown-item'
    settingsItem.setAttribute('data-testid', 'settings-item')
    settingsItem.href = '/settings'
    settingsItem.innerHTML = '<span class="item-icon">⚙</span><span>header.settings</span>'
    dropdown.appendChild(settingsItem)

    const divider2 = document.createElement('div')
    divider2.className = 'dropdown-divider'
    dropdown.appendChild(divider2)

    const logoutItem = document.createElement('button')
    logoutItem.className = 'dropdown-item logout-item'
    logoutItem.setAttribute('data-testid', 'logout-btn')
    logoutItem.innerHTML = '<span class="item-icon">→</span><span>header.logout</span>'
    dropdown.appendChild(logoutItem)

    userMenu.appendChild(dropdown)
  }

  right.appendChild(userMenu)
  header.appendChild(right)
  document.body.appendChild(header)
  return header
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Header', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    mockNavigate.mockClear()
    mockToggleTheme.mockClear()
    mockToggleLocale.mockClear()
    mockLogout.mockClear()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('should render page title', () => {
    const header = mount({ pageTitle: 'Dashboard' })

    const title = header.querySelector('.page-title')
    expect(title).not.toBeNull()
    expect(title?.textContent).toBe('Dashboard')
  })

  it('should display user name and role', () => {
    const header = mount({ userName: 'Alice', userRole: 'admin' })

    const name = header.querySelector('.user-name')
    const role = header.querySelector('.user-role')

    expect(name?.textContent).toBe('Alice')
    expect(role?.textContent).toBe('admin')
  })

  it('should display user initial avatar', () => {
    const header = mount({ userInitial: 'A' })

    const avatar = header.querySelector('.user-avatar')
    expect(avatar?.textContent).toBe('A')
  })

  it('should show notification badge when count > 0', () => {
    const header = mount({ notificationsCount: 5 })

    const badge = header.querySelector('.badge')
    expect(badge).not.toBeNull()
    expect(badge?.textContent).toBe('5')
  })

  it('should show "99+" badge when notifications exceed 99', () => {
    const header = mount({ notificationsCount: 120 })

    const badge = header.querySelector('.badge')
    expect(badge?.textContent).toBe('99+')
  })

  it('should not show badge when notification count is zero', () => {
    const header = mount({ notificationsCount: 0 })

    const badge = header.querySelector('.badge')
    expect(badge).toBeNull()
  })

  it('should show moon icon in light theme', () => {
    const header = mount({ isDarkTheme: false })

    const themeBtn = header.querySelector('[data-testid="theme-btn"] .btn-icon')
    expect(themeBtn?.textContent).toBe('☾')
  })

  it('should show sun icon in dark theme', () => {
    const header = mount({ isDarkTheme: true })

    const themeBtn = header.querySelector('[data-testid="theme-btn"] .btn-icon')
    expect(themeBtn?.textContent).toBe('☀')
  })

  it('should call toggleTheme on theme button click', () => {
    const header = mount({ isDarkTheme: false })

    const themeBtn = header.querySelector<HTMLButtonElement>('[data-testid="theme-btn"]')!
    themeBtn.addEventListener('click', (e) => {
      e.preventDefault()
      mockToggleTheme({})
    })
    themeBtn.click()

    expect(mockToggleTheme).toHaveBeenCalledTimes(1)
  })

  it('should display KO label when locale is Korean', () => {
    const header = mount({ currentLocale: 'ko' })

    const localeBtn = header.querySelector('[data-testid="locale-btn"] .btn-icon')
    expect(localeBtn?.textContent).toBe('KO')
  })

  it('should display EN label when locale is English', () => {
    const header = mount({ currentLocale: 'en' })

    const localeBtn = header.querySelector('[data-testid="locale-btn"] .btn-icon')
    expect(localeBtn?.textContent).toBe('EN')
  })

  it('should call toggleLocale on locale button click', () => {
    const header = mount({ currentLocale: 'ko' })

    const localeBtn = header.querySelector<HTMLButtonElement>('[data-testid="locale-btn"]')!
    localeBtn.addEventListener('click', (e) => {
      e.preventDefault()
      mockToggleLocale({})
    })
    localeBtn.click()

    expect(mockToggleLocale).toHaveBeenCalledTimes(1)
  })

  it('should not show user dropdown when menu is closed', () => {
    const header = mount({ userMenuOpen: false })

    const dropdown = header.querySelector('[data-testid="user-dropdown"]')
    expect(dropdown).toBeNull()
  })

  it('should show user dropdown with email when menu is open', () => {
    const header = mount({ userMenuOpen: true, userEmail: 'alice@example.com' })

    const dropdown = header.querySelector('[data-testid="user-dropdown"]')
    expect(dropdown).not.toBeNull()

    const email = header.querySelector('.dropdown-email')
    expect(email?.textContent).toBe('alice@example.com')
  })

  it('should call logout and navigate on logout button click', async () => {
    mockLogout.mockResolvedValue(undefined)
    const header = mount({ userMenuOpen: true })

    const logoutBtn = header.querySelector<HTMLButtonElement>('[data-testid="logout-btn"]')!
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault()
      await mockLogout({})
      mockNavigate('/auth/login')
    })
    logoutBtn.click()

    await vi.waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1)
    })
  })

  it('should navigate to notifications on bell button click', () => {
    const header = mount()

    const notifBtn = header.querySelector<HTMLButtonElement>('[data-testid="notification-btn"]')!
    notifBtn.addEventListener('click', (e) => {
      e.preventDefault()
      mockNavigate('/alerts')
    })
    notifBtn.click()

    expect(mockNavigate).toHaveBeenCalledWith('/alerts')
  })
})
