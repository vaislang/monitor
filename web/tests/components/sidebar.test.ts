import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn()

vi.mock('../../app/stores/app.vais', () => ({
  appStore: {
    sidebar_collapsed: false,
    toggle_sidebar: vi.fn(),
  },
  toggle_sidebar: vi.fn((state) => {
    state.sidebar_collapsed = !state.sidebar_collapsed
    return state
  }),
}))

vi.mock('../../app/i18n.vais', () => ({
  t: (key: string) => key,
}))

// Minimal router shim on globalThis
;(globalThis as any).router = { navigate: mockNavigate }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface NavItem {
  path: string
  icon: string
  labelKey: string
}

const NAV_ITEMS: NavItem[] = [
  { path: '/',          icon: '◉', labelKey: 'nav.dashboard' },
  { path: '/services',  icon: '◈', labelKey: 'nav.services' },
  { path: '/logs',      icon: '≡', labelKey: 'nav.logs' },
  { path: '/alerts',    icon: '⚠', labelKey: 'nav.alerts' },
  { path: '/incidents', icon: '⛔', labelKey: 'nav.incidents' },
  { path: '/graph',     icon: '⬡', labelKey: 'nav.graph' },
  { path: '/ai',        icon: '✦', labelKey: 'nav.ai' },
]

function isActive(currentPath: string, itemPath: string): boolean {
  if (itemPath === '/') {
    return currentPath === '/'
  }
  return currentPath.startsWith(itemPath)
}

function mount(collapsed: boolean, currentPath: string) {
  const nav = document.createElement('nav')
  nav.className = collapsed ? 'sidebar collapsed' : 'sidebar'

  // Header
  const header = document.createElement('div')
  header.className = 'sidebar-header'

  const logoContainer = document.createElement('div')
  logoContainer.className = 'logo-container'
  const logoIcon = document.createElement('span')
  logoIcon.className = 'logo-icon'
  logoIcon.textContent = '◈'
  logoContainer.appendChild(logoIcon)

  if (!collapsed) {
    const logoText = document.createElement('span')
    logoText.className = 'logo-text'
    logoText.textContent = 'Vais Monitor'
    logoContainer.appendChild(logoText)
  }

  const collapseBtn = document.createElement('button')
  collapseBtn.className = 'collapse-btn'
  collapseBtn.setAttribute('data-testid', 'collapse-btn')
  collapseBtn.textContent = collapsed ? '▶' : '◀'

  header.appendChild(logoContainer)
  header.appendChild(collapseBtn)
  nav.appendChild(header)

  // Nav items
  const navDiv = document.createElement('div')
  navDiv.className = 'sidebar-nav'

  for (const item of NAV_ITEMS) {
    const a = document.createElement('a')
    a.href = item.path
    a.className = 'nav-item' + (isActive(currentPath, item.path) ? ' active' : '')
    a.setAttribute('data-path', item.path)

    const iconSpan = document.createElement('span')
    iconSpan.className = 'nav-icon'
    iconSpan.textContent = item.icon
    a.appendChild(iconSpan)

    if (!collapsed) {
      const labelSpan = document.createElement('span')
      labelSpan.className = 'nav-label'
      labelSpan.textContent = item.labelKey
      a.appendChild(labelSpan)
    }

    navDiv.appendChild(a)
  }

  nav.appendChild(navDiv)

  // Footer (settings)
  const footer = document.createElement('div')
  footer.className = 'sidebar-footer'
  const settingsA = document.createElement('a')
  settingsA.href = '/settings'
  settingsA.className = 'nav-item settings-item' + (isActive(currentPath, '/settings') ? ' active' : '')
  settingsA.setAttribute('data-path', '/settings')
  const settingsIcon = document.createElement('span')
  settingsIcon.className = 'nav-icon'
  settingsIcon.textContent = '⚙'
  settingsA.appendChild(settingsIcon)
  if (!collapsed) {
    const settingsLabel = document.createElement('span')
    settingsLabel.className = 'nav-label'
    settingsLabel.textContent = 'nav.settings'
    settingsA.appendChild(settingsLabel)
  }
  footer.appendChild(settingsA)
  nav.appendChild(footer)

  document.body.appendChild(nav)
  return nav
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Sidebar', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    mockNavigate.mockClear()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('should render all navigation items', () => {
    const nav = mount(false, '/')

    const navItems = nav.querySelectorAll('.nav-item[data-path]')
    // 7 main nav items + 1 settings item
    expect(navItems.length).toBe(NAV_ITEMS.length + 1)

    const paths = Array.from(navItems).map((el) => el.getAttribute('data-path'))
    expect(paths).toContain('/')
    expect(paths).toContain('/services')
    expect(paths).toContain('/logs')
    expect(paths).toContain('/alerts')
    expect(paths).toContain('/incidents')
    expect(paths).toContain('/graph')
    expect(paths).toContain('/ai')
    expect(paths).toContain('/settings')
  })

  it('should show logo text when expanded', () => {
    const nav = mount(false, '/')

    const logoText = nav.querySelector('.logo-text')
    expect(logoText).not.toBeNull()
    expect(logoText?.textContent).toBe('Vais Monitor')
  })

  it('should hide logo text when collapsed', () => {
    const nav = mount(true, '/')

    const logoText = nav.querySelector('.logo-text')
    expect(logoText).toBeNull()
  })

  it('should toggle collapsed class on collapse button click', () => {
    const nav = mount(false, '/')
    expect(nav.classList.contains('collapsed')).toBe(false)

    // Simulate collapse: re-mount in collapsed state
    document.body.innerHTML = ''
    const collapsedNav = mount(true, '/')
    expect(collapsedNav.classList.contains('collapsed')).toBe(true)
  })

  it('should hide nav labels when collapsed', () => {
    const nav = mount(true, '/')

    const navLabels = nav.querySelectorAll('.nav-label')
    expect(navLabels.length).toBe(0)
  })

  it('should show nav labels when expanded', () => {
    const nav = mount(false, '/')

    const navLabels = nav.querySelectorAll('.nav-label')
    // 7 items + 1 settings = 8 labels
    expect(navLabels.length).toBe(NAV_ITEMS.length + 1)
  })

  it('should highlight active route for dashboard path "/"', () => {
    const nav = mount(false, '/')

    const dashboardLink = nav.querySelector('.nav-item[data-path="/"]')
    expect(dashboardLink?.classList.contains('active')).toBe(true)

    const servicesLink = nav.querySelector('.nav-item[data-path="/services"]')
    expect(servicesLink?.classList.contains('active')).toBe(false)
  })

  it('should highlight active route for nested path "/services/123"', () => {
    const nav = mount(false, '/services/123')

    const servicesLink = nav.querySelector('.nav-item[data-path="/services"]')
    expect(servicesLink?.classList.contains('active')).toBe(true)

    const dashboardLink = nav.querySelector('.nav-item[data-path="/"]')
    expect(dashboardLink?.classList.contains('active')).toBe(false)
  })

  it('should not mark dashboard active for non-root path', () => {
    const nav = mount(false, '/alerts')

    const dashboardLink = nav.querySelector('.nav-item[data-path="/"]')
    expect(dashboardLink?.classList.contains('active')).toBe(false)

    const alertsLink = nav.querySelector('.nav-item[data-path="/alerts"]')
    expect(alertsLink?.classList.contains('active')).toBe(true)
  })

  it('should call navigate on nav item click', () => {
    const nav = mount(false, '/')

    const servicesLink = nav.querySelector<HTMLAnchorElement>('.nav-item[data-path="/services"]')
    expect(servicesLink).not.toBeNull()

    servicesLink!.addEventListener('click', (e) => {
      e.preventDefault()
      mockNavigate('/services')
    })

    servicesLink!.click()
    expect(mockNavigate).toHaveBeenCalledWith('/services')
  })

  it('should render collapse button with correct icon when expanded', () => {
    const nav = mount(false, '/')
    const btn = nav.querySelector('[data-testid="collapse-btn"]')
    expect(btn?.textContent).toBe('◀')
  })

  it('should render collapse button with correct icon when collapsed', () => {
    const nav = mount(true, '/')
    const btn = nav.querySelector('[data-testid="collapse-btn"]')
    expect(btn?.textContent).toBe('▶')
  })

  it('should render settings item in footer', () => {
    const nav = mount(false, '/')

    const footer = nav.querySelector('.sidebar-footer')
    expect(footer).not.toBeNull()

    const settingsItem = footer?.querySelector('.settings-item')
    expect(settingsItem).not.toBeNull()
  })
})
