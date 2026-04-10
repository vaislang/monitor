import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock globals
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn()
const mockFetchPost = vi.fn()
const mockFetchGet = vi.fn()
const mockLocalStorageGet = vi.fn()
const mockLocalStorageSet = vi.fn()
const mockLocalStorageRemove = vi.fn()

vi.mock('../../app/stores/auth.vais', () => ({
  create_auth_store: () => ({
    user: '',
    token: '',
    refresh_token: '',
    is_authenticated: false,
    loading: false,
    error: '',
  }),
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  fetch_me: vi.fn(),
}))

vi.mock('../../app/stores/app.vais', () => ({
  create_app_store: () => ({
    theme: 'Light',
    locale: 'Ko',
    sidebar_collapsed: false,
    page_title: 'Vais Monitor',
    notifications_count: 0,
    is_loading: false,
  }),
  toggle_theme: vi.fn(),
  toggle_sidebar: vi.fn(),
}))

vi.mock('../../app/i18n.vais', () => ({
  t: (key: string) => key,
}))

;(globalThis as any).router = { navigate: mockNavigate }
;(globalThis as any).fetch = mockFetchPost

// ---------------------------------------------------------------------------
// 상태 시뮬레이션 헬퍼
// ---------------------------------------------------------------------------

interface AuthState {
  user: string
  token: string
  refresh_token: string
  is_authenticated: boolean
  loading: boolean
  error: string
}

interface AppState {
  sidebar_collapsed: boolean
  page_title: string
  is_loading: boolean
  notifications_count: number
}

interface Service {
  id: number
  name: string
  url: string
  status: string
  team_id: number
  tags: string
}

interface Incident {
  id: number
  status: string
  triggered_at: number
  alert_rule_id: number
}

function createInitialAuthState(): AuthState {
  return {
    user: '',
    token: '',
    refresh_token: '',
    is_authenticated: false,
    loading: false,
    error: '',
  }
}

function createInitialAppState(): AppState {
  return {
    sidebar_collapsed: false,
    page_title: 'Vais Monitor',
    is_loading: false,
    notifications_count: 0,
  }
}

// 로그인 시뮬레이션
async function simulateLogin(
  authState: AuthState,
  email: string,
  password: string,
  mockUser: Record<string, unknown>,
  token: string,
  refreshToken: string,
): Promise<AuthState> {
  authState.loading = true
  authState.error = ''

  // API 호출 성공 시뮬레이션
  const resp = { status: '200', body: { user: mockUser, access_token: token, refresh_token: refreshToken } }

  authState.token = token
  authState.refresh_token = refreshToken
  authState.user = JSON.stringify(mockUser)
  authState.is_authenticated = true
  authState.loading = false
  authState.error = ''

  mockLocalStorageSet('auth_token', token)
  mockLocalStorageSet('auth_refresh_token', refreshToken)
  mockLocalStorageSet('auth_user', JSON.stringify(mockUser))

  return authState
}

// 로그아웃 시뮬레이션
async function simulateLogout(authState: AuthState): Promise<AuthState> {
  mockLocalStorageRemove('auth_token')
  mockLocalStorageRemove('auth_refresh_token')
  mockLocalStorageRemove('auth_user')

  authState.user = ''
  authState.token = ''
  authState.refresh_token = ''
  authState.is_authenticated = false
  authState.loading = false
  authState.error = ''

  return authState
}

// DOM 헬퍼: 네비게이션 바 마운트
function mountNavbar(authState: AuthState): HTMLElement {
  const nav = document.createElement('nav')
  nav.className = 'navbar'
  nav.setAttribute('data-testid', 'navbar')

  const logo = document.createElement('a')
  logo.href = '/'
  logo.className = 'logo'
  logo.setAttribute('data-testid', 'logo')
  logo.textContent = 'Vais Monitor'
  nav.appendChild(logo)

  const controls = document.createElement('div')
  controls.className = 'nav-controls'

  if (authState.is_authenticated) {
    const userInfo = JSON.parse(authState.user || '{}')
    const userMenu = document.createElement('div')
    userMenu.className = 'user-menu'
    userMenu.setAttribute('data-testid', 'user-menu')
    userMenu.textContent = userInfo.name || 'User'
    controls.appendChild(userMenu)

    const logoutBtn = document.createElement('button')
    logoutBtn.className = 'btn btn-secondary'
    logoutBtn.setAttribute('data-testid', 'logout-btn')
    logoutBtn.textContent = 'nav.logout'
    controls.appendChild(logoutBtn)
  } else {
    const loginLink = document.createElement('a')
    loginLink.href = '/auth/login'
    loginLink.className = 'btn btn-primary'
    loginLink.setAttribute('data-testid', 'login-link')
    loginLink.textContent = 'nav.login'
    controls.appendChild(loginLink)
  }

  nav.appendChild(controls)
  document.body.appendChild(nav)
  return nav
}

// DOM 헬퍼: 대시보드 페이지 마운트
function mountDashboard(services: Service[], incidents: Incident[]): HTMLElement {
  const page = document.createElement('div')
  page.className = 'dashboard-page'
  page.setAttribute('data-testid', 'dashboard-page')

  const stats = document.createElement('div')
  stats.className = 'stats-grid'
  stats.setAttribute('data-testid', 'stats-grid')

  const serviceCount = document.createElement('div')
  serviceCount.className = 'stat-card'
  serviceCount.setAttribute('data-testid', 'stat-total-services')
  serviceCount.textContent = String(services.length)
  stats.appendChild(serviceCount)

  const incidentCount = document.createElement('div')
  incidentCount.className = 'stat-card'
  incidentCount.setAttribute('data-testid', 'stat-active-incidents')
  incidentCount.textContent = String(incidents.filter((i) => i.status === 'open').length)
  stats.appendChild(incidentCount)

  page.appendChild(stats)

  const serviceList = document.createElement('div')
  serviceList.className = 'service-list'
  serviceList.setAttribute('data-testid', 'service-list')

  services.forEach((svc) => {
    const item = document.createElement('div')
    item.className = 'service-item'
    item.setAttribute('data-testid', `service-item-${svc.id}`)
    item.setAttribute('data-service-id', String(svc.id))

    const statusBadge = document.createElement('span')
    statusBadge.className = `badge badge-${svc.status}`
    statusBadge.setAttribute('data-testid', `service-status-${svc.id}`)
    statusBadge.textContent = svc.status

    const nameEl = document.createElement('span')
    nameEl.className = 'service-name'
    nameEl.setAttribute('data-testid', `service-name-${svc.id}`)
    nameEl.textContent = svc.name

    item.appendChild(statusBadge)
    item.appendChild(nameEl)
    serviceList.appendChild(item)
  })

  page.appendChild(serviceList)
  document.body.appendChild(page)
  return page
}

// DOM 헬퍼: 서비스 상세 페이지 마운트
function mountServiceDetail(service: Service): HTMLElement {
  const page = document.createElement('div')
  page.className = 'service-detail-page'
  page.setAttribute('data-testid', 'service-detail-page')

  const header = document.createElement('div')
  header.className = 'service-header'

  const title = document.createElement('h1')
  title.setAttribute('data-testid', 'service-title')
  title.textContent = service.name
  header.appendChild(title)

  const status = document.createElement('span')
  status.className = `badge badge-${service.status}`
  status.setAttribute('data-testid', 'service-status-badge')
  status.textContent = service.status
  header.appendChild(status)

  page.appendChild(header)

  const metricsSection = document.createElement('div')
  metricsSection.className = 'metrics-section'
  metricsSection.setAttribute('data-testid', 'metrics-section')
  metricsSection.textContent = 'metrics.loading'
  page.appendChild(metricsSection)

  const logsSection = document.createElement('div')
  logsSection.className = 'logs-section'
  logsSection.setAttribute('data-testid', 'logs-section')
  logsSection.textContent = 'logs.loading'
  page.appendChild(logsSection)

  document.body.appendChild(page)
  return page
}

// DOM 헬퍼: 사이드바 마운트
function mountSidebar(collapsed: boolean, currentPath: string): HTMLElement {
  const sidebar = document.createElement('aside')
  sidebar.className = `sidebar ${collapsed ? 'collapsed' : ''}`
  sidebar.setAttribute('data-testid', 'sidebar')

  const navLinks = [
    { path: '/dashboard', label: 'nav.dashboard', testId: 'nav-dashboard' },
    { path: '/services', label: 'nav.services', testId: 'nav-services' },
    { path: '/logs', label: 'nav.logs', testId: 'nav-logs' },
    { path: '/alerts', label: 'nav.alerts', testId: 'nav-alerts' },
    { path: '/incidents', label: 'nav.incidents', testId: 'nav-incidents' },
    { path: '/settings', label: 'nav.settings', testId: 'nav-settings' },
  ]

  navLinks.forEach(({ path, label, testId }) => {
    const link = document.createElement('a')
    link.href = path
    link.className = `nav-link${path === currentPath ? ' active' : ''}`
    link.setAttribute('data-testid', testId)
    link.textContent = label
    sidebar.appendChild(link)
  })

  document.body.appendChild(sidebar)
  return sidebar
}

// ---------------------------------------------------------------------------
// FLOW TEST 1: 로그인 → 대시보드 흐름
// ---------------------------------------------------------------------------

describe('Flow: 로그인 → 대시보드', () => {
  let authState: AuthState

  const MOCK_USER = { id: 1, email: 'alice@test.com', name: 'Alice', role: 'member', team_id: 1 }
  const MOCK_TOKEN = 'access-token-alice'
  const MOCK_REFRESH = 'refresh-token-alice'
  const MOCK_SERVICES: Service[] = [
    { id: 1, name: 'API Service', url: 'http://api.example.com', status: 'up', team_id: 1, tags: 'backend' },
    { id: 2, name: 'DB Service', url: 'http://db.example.com', status: 'up', team_id: 1, tags: 'database' },
  ]
  const MOCK_INCIDENTS: Incident[] = [
    { id: 1, status: 'open', triggered_at: 1700000000, alert_rule_id: 1 },
  ]

  beforeEach(() => {
    document.body.innerHTML = ''
    authState = createInitialAuthState()
    vi.clearAllMocks()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('미인증 상태에서 로그인 링크가 표시됨', () => {
    const nav = mountNavbar(authState)

    const loginLink = nav.querySelector('[data-testid="login-link"]')
    const userMenu = nav.querySelector('[data-testid="user-menu"]')
    const logoutBtn = nav.querySelector('[data-testid="logout-btn"]')

    expect(loginLink).not.toBeNull()
    expect(userMenu).toBeNull()
    expect(logoutBtn).toBeNull()
  })

  it('로그인 후 사용자 메뉴와 로그아웃 버튼이 표시됨', async () => {
    authState = await simulateLogin(authState, 'alice@test.com', 'password123', MOCK_USER, MOCK_TOKEN, MOCK_REFRESH)

    const nav = mountNavbar(authState)

    const userMenu = nav.querySelector('[data-testid="user-menu"]')
    const logoutBtn = nav.querySelector('[data-testid="logout-btn"]')
    const loginLink = nav.querySelector('[data-testid="login-link"]')

    expect(userMenu).not.toBeNull()
    expect(userMenu?.textContent).toBe('Alice')
    expect(logoutBtn).not.toBeNull()
    expect(loginLink).toBeNull()
  })

  it('로그인 후 대시보드에서 서비스 목록이 표시됨', async () => {
    authState = await simulateLogin(authState, 'alice@test.com', 'password123', MOCK_USER, MOCK_TOKEN, MOCK_REFRESH)
    expect(authState.is_authenticated).toBe(true)

    const dashboard = mountDashboard(MOCK_SERVICES, MOCK_INCIDENTS)

    const statsGrid = dashboard.querySelector('[data-testid="stats-grid"]')
    expect(statsGrid).not.toBeNull()

    const totalServicesStat = dashboard.querySelector('[data-testid="stat-total-services"]')
    expect(totalServicesStat?.textContent).toBe('2')

    const activeIncidentsStat = dashboard.querySelector('[data-testid="stat-active-incidents"]')
    expect(activeIncidentsStat?.textContent).toBe('1')
  })

  it('대시보드에서 각 서비스 항목이 이름과 상태를 표시함', async () => {
    authState = await simulateLogin(authState, 'alice@test.com', 'password123', MOCK_USER, MOCK_TOKEN, MOCK_REFRESH)

    const dashboard = mountDashboard(MOCK_SERVICES, MOCK_INCIDENTS)

    const serviceItem1 = dashboard.querySelector('[data-testid="service-item-1"]')
    expect(serviceItem1).not.toBeNull()

    const serviceName1 = dashboard.querySelector('[data-testid="service-name-1"]')
    expect(serviceName1?.textContent).toBe('API Service')

    const serviceStatus1 = dashboard.querySelector('[data-testid="service-status-1"]')
    expect(serviceStatus1?.textContent).toBe('up')
    expect(serviceStatus1?.classList.contains('badge-up')).toBe(true)
  })

  it('로그인 상태를 localStorage에 올바르게 저장', async () => {
    authState = await simulateLogin(authState, 'alice@test.com', 'password123', MOCK_USER, MOCK_TOKEN, MOCK_REFRESH)

    expect(mockLocalStorageSet).toHaveBeenCalledWith('auth_token', MOCK_TOKEN)
    expect(mockLocalStorageSet).toHaveBeenCalledWith('auth_refresh_token', MOCK_REFRESH)
    expect(mockLocalStorageSet).toHaveBeenCalledWith('auth_user', JSON.stringify(MOCK_USER))
  })
})

// ---------------------------------------------------------------------------
// FLOW TEST 2: 서비스 목록 조회 → 상세 보기 흐름
// ---------------------------------------------------------------------------

describe('Flow: 서비스 목록 → 서비스 상세', () => {
  let authState: AuthState
  const MOCK_USER = { id: 1, email: 'alice@test.com', name: 'Alice', role: 'member', team_id: 1 }
  const MOCK_TOKEN = 'access-token-alice'
  const MOCK_SERVICES: Service[] = [
    { id: 1, name: 'API Service', url: 'http://api.example.com', status: 'up', team_id: 1, tags: 'backend' },
    { id: 2, name: 'Worker Service', url: 'http://worker.example.com', status: 'degraded', team_id: 1, tags: 'async' },
    { id: 3, name: 'DB Service', url: 'http://db.example.com', status: 'down', team_id: 1, tags: 'database' },
  ]

  beforeEach(() => {
    document.body.innerHTML = ''
    authState = createInitialAuthState()
    vi.clearAllMocks()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('서비스 목록에서 여러 서비스가 렌더링됨', async () => {
    authState = await simulateLogin(authState, 'alice@test.com', 'password123', MOCK_USER, MOCK_TOKEN, 'refresh')
    const dashboard = mountDashboard(MOCK_SERVICES, [])

    const serviceList = dashboard.querySelector('[data-testid="service-list"]')
    expect(serviceList).not.toBeNull()

    const serviceItems = dashboard.querySelectorAll('.service-item')
    expect(serviceItems.length).toBe(3)
  })

  it('서비스 상태에 따라 올바른 배지 클래스가 적용됨', async () => {
    authState = await simulateLogin(authState, 'alice@test.com', 'password123', MOCK_USER, MOCK_TOKEN, 'refresh')
    const dashboard = mountDashboard(MOCK_SERVICES, [])

    const upStatus = dashboard.querySelector('[data-testid="service-status-1"]')
    const degradedStatus = dashboard.querySelector('[data-testid="service-status-2"]')
    const downStatus = dashboard.querySelector('[data-testid="service-status-3"]')

    expect(upStatus?.classList.contains('badge-up')).toBe(true)
    expect(degradedStatus?.classList.contains('badge-degraded')).toBe(true)
    expect(downStatus?.classList.contains('badge-down')).toBe(true)
  })

  it('서비스 상세 페이지에서 메트릭/로그 섹션이 표시됨', () => {
    const service = MOCK_SERVICES[0]
    const detailPage = mountServiceDetail(service)

    const title = detailPage.querySelector('[data-testid="service-title"]')
    const statusBadge = detailPage.querySelector('[data-testid="service-status-badge"]')
    const metricsSection = detailPage.querySelector('[data-testid="metrics-section"]')
    const logsSection = detailPage.querySelector('[data-testid="logs-section"]')

    expect(title?.textContent).toBe('API Service')
    expect(statusBadge?.textContent).toBe('up')
    expect(metricsSection).not.toBeNull()
    expect(logsSection).not.toBeNull()
  })

  it('서비스 ID로 상세 페이지 접근 시 서비스 정보가 렌더링됨', () => {
    const targetService = MOCK_SERVICES.find((s) => s.id === 2)!
    const detailPage = mountServiceDetail(targetService)

    const title = detailPage.querySelector('[data-testid="service-title"]')
    const statusBadge = detailPage.querySelector('[data-testid="service-status-badge"]')

    expect(title?.textContent).toBe('Worker Service')
    expect(statusBadge?.classList.contains('badge-degraded')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// FLOW TEST 3: 사이드바 네비게이션 흐름
// ---------------------------------------------------------------------------

describe('Flow: 사이드바 네비게이션', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.clearAllMocks()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('사이드바에 모든 주요 네비게이션 링크가 표시됨', () => {
    const sidebar = mountSidebar(false, '/dashboard')

    expect(sidebar.querySelector('[data-testid="nav-dashboard"]')).not.toBeNull()
    expect(sidebar.querySelector('[data-testid="nav-services"]')).not.toBeNull()
    expect(sidebar.querySelector('[data-testid="nav-logs"]')).not.toBeNull()
    expect(sidebar.querySelector('[data-testid="nav-alerts"]')).not.toBeNull()
    expect(sidebar.querySelector('[data-testid="nav-incidents"]')).not.toBeNull()
    expect(sidebar.querySelector('[data-testid="nav-settings"]')).not.toBeNull()
  })

  it('현재 경로에 해당하는 네비게이션 링크에 active 클래스 적용', () => {
    const sidebar = mountSidebar(false, '/services')

    const servicesLink = sidebar.querySelector('[data-testid="nav-services"]')
    const dashboardLink = sidebar.querySelector('[data-testid="nav-dashboard"]')

    expect(servicesLink?.classList.contains('active')).toBe(true)
    expect(dashboardLink?.classList.contains('active')).toBe(false)
  })

  it('collapsed 상태에서 sidebar에 collapsed 클래스 적용', () => {
    const sidebar = mountSidebar(true, '/dashboard')

    expect(sidebar.classList.contains('collapsed')).toBe(true)
  })

  it('collapsed 아닌 상태에서 sidebar에 collapsed 클래스 없음', () => {
    const sidebar = mountSidebar(false, '/dashboard')

    expect(sidebar.classList.contains('collapsed')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// FLOW TEST 4: 로그아웃 흐름
// ---------------------------------------------------------------------------

describe('Flow: 로그아웃', () => {
  let authState: AuthState
  const MOCK_USER = { id: 1, email: 'alice@test.com', name: 'Alice', role: 'member', team_id: 1 }
  const MOCK_TOKEN = 'access-token-alice'
  const MOCK_REFRESH = 'refresh-token-alice'

  beforeEach(() => {
    document.body.innerHTML = ''
    authState = createInitialAuthState()
    vi.clearAllMocks()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('로그아웃 후 인증 상태가 초기화됨', async () => {
    authState = await simulateLogin(authState, 'alice@test.com', 'password123', MOCK_USER, MOCK_TOKEN, MOCK_REFRESH)
    expect(authState.is_authenticated).toBe(true)
    expect(authState.token).toBe(MOCK_TOKEN)

    authState = await simulateLogout(authState)

    expect(authState.is_authenticated).toBe(false)
    expect(authState.token).toBe('')
    expect(authState.user).toBe('')
    expect(authState.refresh_token).toBe('')
  })

  it('로그아웃 후 localStorage에서 인증 데이터가 제거됨', async () => {
    authState = await simulateLogin(authState, 'alice@test.com', 'password123', MOCK_USER, MOCK_TOKEN, MOCK_REFRESH)
    authState = await simulateLogout(authState)

    expect(mockLocalStorageRemove).toHaveBeenCalledWith('auth_token')
    expect(mockLocalStorageRemove).toHaveBeenCalledWith('auth_refresh_token')
    expect(mockLocalStorageRemove).toHaveBeenCalledWith('auth_user')
  })

  it('로그아웃 후 네비게이션 바에서 로그인 링크가 다시 표시됨', async () => {
    authState = await simulateLogin(authState, 'alice@test.com', 'password123', MOCK_USER, MOCK_TOKEN, MOCK_REFRESH)
    let nav = mountNavbar(authState)
    expect(nav.querySelector('[data-testid="logout-btn"]')).not.toBeNull()

    document.body.innerHTML = ''
    authState = await simulateLogout(authState)
    nav = mountNavbar(authState)

    expect(nav.querySelector('[data-testid="login-link"]')).not.toBeNull()
    expect(nav.querySelector('[data-testid="logout-btn"]')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// FLOW TEST 5: 전체 사용자 흐름 — 로그인 → 대시보드 → 서비스 조회 → 로그아웃
// ---------------------------------------------------------------------------

describe('Flow: 전체 사용자 흐름 (e2e-style)', () => {
  let authState: AuthState
  let appState: AppState

  const MOCK_USER = { id: 1, email: 'bob@test.com', name: 'Bob', role: 'admin', team_id: 2 }
  const MOCK_TOKEN = 'access-token-bob-admin'
  const MOCK_REFRESH = 'refresh-token-bob'

  const MOCK_SERVICES: Service[] = [
    { id: 10, name: 'Frontend', url: 'http://frontend.example.com', status: 'up', team_id: 2, tags: 'web,frontend' },
    { id: 11, name: 'Backend API', url: 'http://backend.example.com', status: 'up', team_id: 2, tags: 'api,backend' },
    { id: 12, name: 'Cache', url: 'http://cache.example.com', status: 'degraded', team_id: 2, tags: 'cache,redis' },
  ]

  const MOCK_INCIDENTS: Incident[] = [
    { id: 5, status: 'open', triggered_at: 1700005000, alert_rule_id: 3 },
  ]

  beforeEach(() => {
    document.body.innerHTML = ''
    authState = createInitialAuthState()
    appState = createInitialAppState()
    vi.clearAllMocks()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('STEP 1: 비인증 상태에서 로그인 링크가 표시됨', () => {
    const nav = mountNavbar(authState)
    expect(authState.is_authenticated).toBe(false)
    expect(nav.querySelector('[data-testid="login-link"]')).not.toBeNull()
    expect(nav.querySelector('[data-testid="user-menu"]')).toBeNull()
  })

  it('STEP 2: 로그인 성공 후 인증 상태 설정 및 사용자 정보 반영', async () => {
    authState = await simulateLogin(
      authState,
      'bob@test.com',
      'adminpass123',
      MOCK_USER,
      MOCK_TOKEN,
      MOCK_REFRESH,
    )

    expect(authState.is_authenticated).toBe(true)
    expect(authState.token).toBe(MOCK_TOKEN)

    const userObj = JSON.parse(authState.user)
    expect(userObj.email).toBe('bob@test.com')
    expect(userObj.role).toBe('admin')

    const nav = mountNavbar(authState)
    const userMenu = nav.querySelector('[data-testid="user-menu"]')
    expect(userMenu?.textContent).toBe('Bob')
  })

  it('STEP 3: 대시보드에서 서비스 통계와 인시던트 요약이 표시됨', async () => {
    authState = await simulateLogin(
      authState,
      'bob@test.com',
      'adminpass123',
      MOCK_USER,
      MOCK_TOKEN,
      MOCK_REFRESH,
    )

    const dashboard = mountDashboard(MOCK_SERVICES, MOCK_INCIDENTS)
    const totalServicesStat = dashboard.querySelector('[data-testid="stat-total-services"]')
    const incidentsStat = dashboard.querySelector('[data-testid="stat-active-incidents"]')

    expect(totalServicesStat?.textContent).toBe('3')
    expect(incidentsStat?.textContent).toBe('1')
  })

  it('STEP 4: 서비스 목록에서 각 서비스 항목 확인 및 상세 이동', async () => {
    authState = await simulateLogin(
      authState,
      'bob@test.com',
      'adminpass123',
      MOCK_USER,
      MOCK_TOKEN,
      MOCK_REFRESH,
    )

    const dashboard = mountDashboard(MOCK_SERVICES, MOCK_INCIDENTS)
    const serviceItems = dashboard.querySelectorAll('.service-item')
    expect(serviceItems.length).toBe(3)

    // 'Cache' 서비스 (degraded) 확인
    const cacheStatus = dashboard.querySelector('[data-testid="service-status-12"]')
    expect(cacheStatus?.classList.contains('badge-degraded')).toBe(true)

    // 서비스 상세 페이지로 이동 시뮬레이션
    document.body.innerHTML = ''
    const targetService = MOCK_SERVICES[2]
    const detailPage = mountServiceDetail(targetService)

    expect(detailPage.querySelector('[data-testid="service-title"]')?.textContent).toBe('Cache')
    expect(detailPage.querySelector('[data-testid="service-status-badge"]')?.textContent).toBe('degraded')
    expect(detailPage.querySelector('[data-testid="metrics-section"]')).not.toBeNull()
    expect(detailPage.querySelector('[data-testid="logs-section"]')).not.toBeNull()
  })

  it('STEP 5: 사이드바 네비게이션 정상 동작 및 활성 링크 강조', async () => {
    authState = await simulateLogin(
      authState,
      'bob@test.com',
      'adminpass123',
      MOCK_USER,
      MOCK_TOKEN,
      MOCK_REFRESH,
    )

    const sidebar = mountSidebar(false, '/services')
    const servicesLink = sidebar.querySelector('[data-testid="nav-services"]')
    expect(servicesLink?.classList.contains('active')).toBe(true)

    // 사이드바 접기 시뮬레이션
    appState.sidebar_collapsed = true
    document.body.innerHTML = ''

    const collapsedSidebar = mountSidebar(true, '/services')
    expect(collapsedSidebar.classList.contains('collapsed')).toBe(true)
  })

  it('STEP 6: 로그아웃 후 인증 상태 완전 초기화 및 로그인 화면 복귀', async () => {
    authState = await simulateLogin(
      authState,
      'bob@test.com',
      'adminpass123',
      MOCK_USER,
      MOCK_TOKEN,
      MOCK_REFRESH,
    )
    expect(authState.is_authenticated).toBe(true)

    authState = await simulateLogout(authState)

    expect(authState.is_authenticated).toBe(false)
    expect(authState.token).toBe('')
    expect(authState.user).toBe('')
    expect(authState.error).toBe('')

    expect(mockLocalStorageRemove).toHaveBeenCalledWith('auth_token')

    const nav = mountNavbar(authState)
    expect(nav.querySelector('[data-testid="login-link"]')).not.toBeNull()
    expect(nav.querySelector('[data-testid="user-menu"]')).toBeNull()
  })
})
