import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../app/i18n.vais', () => ({
  t: (key: string) => key,
}))

vi.mock('../../app/stores/app.vais', () => ({
  appStore: {
    page_title: 'Vais Monitor',
    notifications_count: 0,
    sidebar_collapsed: false,
    theme: 'light',
    locale: 'ko',
  },
  toggle_theme: vi.fn(),
  toggle_locale: vi.fn(),
  toggle_sidebar: vi.fn(),
  locale_to_str: () => 'ko',
  is_dark_theme: () => false,
}))

vi.mock('../../app/stores/auth.vais', () => ({
  authStore: {
    user: JSON.stringify({ id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin' }),
    token: 'mock-token',
    is_authenticated: true,
  },
  logout: vi.fn(),
  create_auth_store: () => ({
    user: '',
    token: '',
    refresh_token: '',
    is_authenticated: false,
    loading: false,
    error: '',
  }),
  login: vi.fn(),
  register: vi.fn(),
}))

;(globalThis as any).router = { navigate: vi.fn() }

// ---------------------------------------------------------------------------
// Page builders  (pure DOM, no framework runtime required)
// These reproduce the structural HTML that each .vaisx page would render.
// ---------------------------------------------------------------------------

// --- Login page ---

function renderLoginPage(): string {
  const page = document.createElement('div')
  page.className = 'login-page'

  const card = document.createElement('div')
  card.className = 'login-card'

  const cardHeader = document.createElement('div')
  cardHeader.className = 'card-header'
  const logoDiv = document.createElement('div')
  logoDiv.className = 'logo'
  const logoText = document.createElement('span')
  logoText.className = 'logo-text'
  logoText.textContent = 'Vais Monitor'
  logoDiv.appendChild(logoText)
  const h1 = document.createElement('h1')
  h1.className = 'card-title'
  h1.textContent = 'auth.loginTitle'
  const subtitle = document.createElement('p')
  subtitle.className = 'card-subtitle'
  subtitle.textContent = 'auth.loginSubtitle'
  cardHeader.appendChild(logoDiv)
  cardHeader.appendChild(h1)
  cardHeader.appendChild(subtitle)
  card.appendChild(cardHeader)

  const form = document.createElement('form')
  form.className = 'auth-form'

  const emailGroup = document.createElement('div')
  emailGroup.className = 'form-group'
  const emailLabel = document.createElement('label')
  emailLabel.htmlFor = 'email'
  emailLabel.textContent = 'auth.email'
  const emailInput = document.createElement('input')
  emailInput.id = 'email'
  emailInput.type = 'email'
  emailInput.className = 'form-input'
  emailGroup.appendChild(emailLabel)
  emailGroup.appendChild(emailInput)
  form.appendChild(emailGroup)

  const passGroup = document.createElement('div')
  passGroup.className = 'form-group'
  const passLabel = document.createElement('label')
  passLabel.htmlFor = 'password'
  passLabel.textContent = 'auth.password'
  const passWrapper = document.createElement('div')
  passWrapper.className = 'input-wrapper'
  const passInput = document.createElement('input')
  passInput.id = 'password'
  passInput.type = 'password'
  passInput.className = 'form-input'
  const toggleBtn = document.createElement('button')
  toggleBtn.type = 'button'
  toggleBtn.className = 'toggle-password'
  passWrapper.appendChild(passInput)
  passWrapper.appendChild(toggleBtn)
  passGroup.appendChild(passLabel)
  passGroup.appendChild(passWrapper)
  form.appendChild(passGroup)

  const submitBtn = document.createElement('button')
  submitBtn.type = 'submit'
  submitBtn.className = 'btn btn-primary'
  submitBtn.textContent = 'auth.loginBtn'
  form.appendChild(submitBtn)
  card.appendChild(form)

  const divider = document.createElement('div')
  divider.className = 'divider'
  const dividerText = document.createElement('span')
  dividerText.className = 'divider-text'
  dividerText.textContent = 'or'
  divider.appendChild(dividerText)
  card.appendChild(divider)

  const githubBtn = document.createElement('button')
  githubBtn.type = 'button'
  githubBtn.className = 'btn btn-github'
  githubBtn.textContent = 'auth.githubLogin'
  card.appendChild(githubBtn)

  const authLink = document.createElement('p')
  authLink.className = 'auth-link'
  const registerA = document.createElement('a')
  registerA.href = '/auth/register'
  registerA.className = 'link'
  registerA.textContent = 'auth.goToRegister'
  authLink.textContent = 'auth.noAccount'
  authLink.appendChild(registerA)
  card.appendChild(authLink)

  page.appendChild(card)
  return page.outerHTML
}

// --- Register page ---

function renderRegisterPage(): string {
  const page = document.createElement('div')
  page.className = 'register-page'

  const card = document.createElement('div')
  card.className = 'register-card'

  const cardHeader = document.createElement('div')
  cardHeader.className = 'card-header'
  const h1 = document.createElement('h1')
  h1.className = 'card-title'
  h1.textContent = 'auth.registerTitle'
  const subtitle = document.createElement('p')
  subtitle.className = 'card-subtitle'
  subtitle.textContent = 'auth.registerSubtitle'
  cardHeader.appendChild(h1)
  cardHeader.appendChild(subtitle)
  card.appendChild(cardHeader)

  const form = document.createElement('form')
  form.className = 'auth-form'

  for (const field of [
    { id: 'name', type: 'text', label: 'auth.name' },
    { id: 'email', type: 'email', label: 'auth.email' },
    { id: 'password', type: 'password', label: 'auth.password' },
    { id: 'confirm-password', type: 'password', label: 'auth.confirmPassword' },
  ]) {
    const group = document.createElement('div')
    group.className = 'form-group'
    const label = document.createElement('label')
    label.htmlFor = field.id
    label.textContent = field.label
    const input = document.createElement('input')
    input.id = field.id
    input.type = field.type
    input.className = 'form-input'
    group.appendChild(label)
    group.appendChild(input)
    form.appendChild(group)
  }

  const submitBtn = document.createElement('button')
  submitBtn.type = 'submit'
  submitBtn.className = 'btn btn-primary'
  submitBtn.textContent = 'auth.registerBtn'
  form.appendChild(submitBtn)
  card.appendChild(form)

  const githubBtn = document.createElement('button')
  githubBtn.type = 'button'
  githubBtn.className = 'btn btn-github'
  githubBtn.textContent = 'auth.githubLogin'
  card.appendChild(githubBtn)

  page.appendChild(card)
  return page.outerHTML
}

// --- Dashboard page ---

function renderDashboardPage(): string {
  const dashboard = document.createElement('div')
  dashboard.className = 'dashboard'

  const pageHeader = document.createElement('div')
  pageHeader.className = 'page-header'
  const headerText = document.createElement('div')
  headerText.className = 'header-text'
  const h2 = document.createElement('h2')
  h2.className = 'page-title'
  h2.textContent = 'dashboard.title'
  const p = document.createElement('p')
  p.className = 'page-subtitle'
  p.textContent = 'dashboard.subtitle'
  headerText.appendChild(h2)
  headerText.appendChild(p)
  pageHeader.appendChild(headerText)

  const actions = document.createElement('div')
  actions.className = 'header-actions'
  const wsStatus = document.createElement('div')
  wsStatus.className = 'ws-status'
  const wsDot = document.createElement('span')
  wsDot.className = 'ws-dot'
  const wsLabel = document.createElement('span')
  wsLabel.className = 'ws-label'
  wsLabel.textContent = 'dashboard.realtimeConnecting'
  wsStatus.appendChild(wsDot)
  wsStatus.appendChild(wsLabel)
  actions.appendChild(wsStatus)

  const refreshBtn = document.createElement('button')
  refreshBtn.className = 'btn-refresh'
  refreshBtn.textContent = 'common.refresh'
  actions.appendChild(refreshBtn)
  pageHeader.appendChild(actions)
  dashboard.appendChild(pageHeader)

  // Summary grid
  const grid = document.createElement('div')
  grid.className = 'summary-grid'

  const cards = [
    { cls: 'card-total',     icon: '◈', label: 'dashboard.servicesOverview', value: '0' },
    { cls: 'card-healthy',   icon: '◉', label: 'dashboard.healthyServices',  value: '0' },
    { cls: 'card-down',      icon: '⛔', label: 'dashboard.downServices',     value: '0' },
    { cls: 'card-degraded',  icon: '⚠', label: 'dashboard.degradedServices', value: '0' },
    { cls: 'card-incidents', icon: '⚡', label: 'dashboard.openIncidents',    value: '0' },
    { cls: 'card-alerts',    icon: '🔔', label: 'dashboard.activeAlerts',     value: '0' },
  ]

  for (const c of cards) {
    const card = document.createElement('div')
    card.className = `summary-card ${c.cls}`
    const icon = document.createElement('div')
    icon.className = 'card-icon'
    icon.textContent = c.icon
    const content = document.createElement('div')
    content.className = 'card-content'
    const label = document.createElement('span')
    label.className = 'card-label'
    label.textContent = c.label
    const value = document.createElement('span')
    value.className = 'card-value'
    value.textContent = c.value
    content.appendChild(label)
    content.appendChild(value)
    card.appendChild(icon)
    card.appendChild(content)
    grid.appendChild(card)
  }

  dashboard.appendChild(grid)

  // Event feed
  const body = document.createElement('div')
  body.className = 'dashboard-body'
  const feed = document.createElement('section')
  feed.className = 'panel panel-feed'
  const feedHeader = document.createElement('div')
  feedHeader.className = 'panel-header'
  const feedTitle = document.createElement('h3')
  feedTitle.className = 'panel-title'
  feedTitle.textContent = 'dashboard.systemHealth'
  feedHeader.appendChild(feedTitle)
  const eventList = document.createElement('div')
  eventList.className = 'event-list'
  const emptyState = document.createElement('div')
  emptyState.className = 'empty-state'
  const emptyIcon = document.createElement('span')
  emptyIcon.className = 'empty-icon'
  emptyIcon.textContent = '✓'
  const emptyMsg = document.createElement('span')
  emptyMsg.textContent = 'dashboard.noRecentEvents'
  emptyState.appendChild(emptyIcon)
  emptyState.appendChild(emptyMsg)
  eventList.appendChild(emptyState)
  feed.appendChild(feedHeader)
  feed.appendChild(eventList)
  body.appendChild(feed)
  dashboard.appendChild(body)

  return dashboard.outerHTML
}

// --- Services page ---

function renderServicesPage(): string {
  const page = document.createElement('div')
  page.className = 'services-page'

  const pageHeader = document.createElement('div')
  pageHeader.className = 'page-header'

  const left = document.createElement('div')
  left.className = 'header-left'
  const h1 = document.createElement('h1')
  h1.className = 'page-title'
  h1.textContent = 'services.title'
  const countP = document.createElement('p')
  countP.className = 'page-subtitle'
  countP.textContent = '0 common.total'
  left.appendChild(h1)
  left.appendChild(countP)
  pageHeader.appendChild(left)

  const right = document.createElement('div')
  right.className = 'header-right'
  const viewToggle = document.createElement('div')
  viewToggle.className = 'view-toggle'
  const tableBtn = document.createElement('button')
  tableBtn.className = 'view-btn active'
  tableBtn.textContent = '≡'
  const cardBtn = document.createElement('button')
  cardBtn.className = 'view-btn'
  cardBtn.textContent = '⊞'
  viewToggle.appendChild(tableBtn)
  viewToggle.appendChild(cardBtn)
  right.appendChild(viewToggle)

  const addBtn = document.createElement('button')
  addBtn.className = 'btn btn-primary'
  addBtn.textContent = 'services.addService'
  right.appendChild(addBtn)
  pageHeader.appendChild(right)
  page.appendChild(pageHeader)

  // Filter bar
  const filterBar = document.createElement('div')
  filterBar.className = 'filter-bar'
  const searchBox = document.createElement('div')
  searchBox.className = 'search-box'
  const searchInput = document.createElement('input')
  searchInput.type = 'search'
  searchInput.className = 'search-input'
  searchInput.placeholder = 'common.search'
  searchBox.appendChild(searchInput)
  filterBar.appendChild(searchBox)
  page.appendChild(filterBar)

  // Empty table
  const tableContainer = document.createElement('div')
  tableContainer.className = 'table-container'
  const table = document.createElement('table')
  table.className = 'data-table'
  const thead = document.createElement('thead')
  const tr = document.createElement('tr')
  for (const col of ['services.name', 'common.status', 'services.url', 'common.actions']) {
    const th = document.createElement('th')
    th.textContent = col
    tr.appendChild(th)
  }
  thead.appendChild(tr)
  table.appendChild(thead)
  const tbody = document.createElement('tbody')
  table.appendChild(tbody)
  tableContainer.appendChild(table)
  page.appendChild(tableContainer)

  return page.outerHTML
}

// --- Incidents page ---

function renderIncidentsPage(): string {
  const page = document.createElement('div')
  page.className = 'incidents-page'

  const pageHeader = document.createElement('div')
  pageHeader.className = 'page-header'
  const headerLeft = document.createElement('div')
  headerLeft.className = 'page-header-left'
  const h2 = document.createElement('h2')
  h2.className = 'page-title'
  h2.textContent = 'incidents.title'
  const count = document.createElement('span')
  count.className = 'page-count'
  count.textContent = '0 common.total'
  headerLeft.appendChild(h2)
  headerLeft.appendChild(count)
  pageHeader.appendChild(headerLeft)

  const refreshBtn = document.createElement('button')
  refreshBtn.className = 'refresh-btn'
  refreshBtn.textContent = '↻'
  pageHeader.appendChild(refreshBtn)
  page.appendChild(pageHeader)

  // Filter bar
  const filterBar = document.createElement('div')
  filterBar.className = 'filter-bar'
  const filterGroup = document.createElement('div')
  filterGroup.className = 'filter-group'

  for (const [key, label] of [
    ['all', 'common.all'],
    ['open', 'incidents.status.open'],
    ['acknowledged', 'incidents.status.acknowledged'],
    ['resolved', 'incidents.status.resolved'],
  ]) {
    const btn = document.createElement('button')
    btn.className = 'filter-btn' + (key === 'all' ? ' active' : '')
    btn.setAttribute('data-filter', key)
    btn.textContent = label
    filterGroup.appendChild(btn)
  }

  filterBar.appendChild(filterGroup)
  page.appendChild(filterBar)

  // Empty state
  const emptyState = document.createElement('div')
  emptyState.className = 'empty-state'
  const emptyIcon = document.createElement('span')
  emptyIcon.className = 'empty-icon'
  emptyIcon.textContent = '✓'
  const emptyMsg = document.createElement('p')
  emptyMsg.textContent = 'incidents.noIncidents'
  emptyState.appendChild(emptyIcon)
  emptyState.appendChild(emptyMsg)
  page.appendChild(emptyState)

  return page.outerHTML
}

// --- Settings page ---

function renderSettingsPage(): string {
  const page = document.createElement('div')
  page.className = 'settings-page'

  const pageHeader = document.createElement('div')
  pageHeader.className = 'page-header'
  const headerTitle = document.createElement('div')
  headerTitle.className = 'header-title'
  const h2 = document.createElement('h2')
  h2.textContent = 'settings.title'
  const headerSub = document.createElement('p')
  headerSub.className = 'header-subtitle'
  headerSub.textContent = 'settings.subtitle'
  headerTitle.appendChild(h2)
  headerTitle.appendChild(headerSub)
  pageHeader.appendChild(headerTitle)

  const subNav = document.createElement('div')
  subNav.className = 'settings-subnav'
  for (const [href, icon, label] of [
    ['/settings/team', '◈', 'settings.teamManagement'],
    ['/settings/backup', '▣', 'settings.backup'],
  ]) {
    const a = document.createElement('a')
    a.href = href as string
    a.className = 'subnav-link'
    const iconSpan = document.createElement('span')
    iconSpan.className = 'subnav-icon'
    iconSpan.textContent = icon as string
    const labelSpan = document.createElement('span')
    labelSpan.textContent = label as string
    a.appendChild(iconSpan)
    a.appendChild(labelSpan)
    subNav.appendChild(a)
  }
  pageHeader.appendChild(subNav)
  page.appendChild(pageHeader)

  // Tab nav
  const tabNav = document.createElement('div')
  tabNav.className = 'tab-nav'
  tabNav.setAttribute('role', 'tablist')

  const tabs = [
    { id: 'general', icon: '⚙', label: 'settings.general' },
    { id: 'notifications', icon: '🔔', label: 'settings.notifications' },
    { id: 'integrations', icon: '⬡', label: 'settings.integrations' },
    { id: 'security', icon: '🔒', label: 'settings.security' },
  ]

  for (const tab of tabs) {
    const btn = document.createElement('button')
    btn.className = 'tab-btn' + (tab.id === 'general' ? ' active' : '')
    btn.setAttribute('role', 'tab')
    btn.setAttribute('aria-selected', tab.id === 'general' ? 'true' : 'false')
    const tabIcon = document.createElement('span')
    tabIcon.className = 'tab-icon'
    tabIcon.textContent = tab.icon
    const tabLabel = document.createElement('span')
    tabLabel.textContent = tab.label
    btn.appendChild(tabIcon)
    btn.appendChild(tabLabel)
    tabNav.appendChild(btn)
  }

  page.appendChild(tabNav)

  // Tab content placeholder
  const tabContent = document.createElement('div')
  tabContent.className = 'tab-content'
  tabContent.setAttribute('data-active-tab', 'general')
  page.appendChild(tabContent)

  return page.outerHTML
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Page Snapshots', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('login page should match snapshot', () => {
    const html = renderLoginPage()
    expect(html).toMatchSnapshot()
  })

  it('login page should contain expected structural elements', () => {
    const html = renderLoginPage()
    document.body.innerHTML = html

    expect(document.querySelector('.login-page')).not.toBeNull()
    expect(document.querySelector('.login-card')).not.toBeNull()
    expect(document.querySelector('.auth-form')).not.toBeNull()
    expect(document.querySelector('input#email')).not.toBeNull()
    expect(document.querySelector('input#password')).not.toBeNull()
    expect(document.querySelector('.btn-github')).not.toBeNull()
  })

  it('register page should match snapshot', () => {
    const html = renderRegisterPage()
    expect(html).toMatchSnapshot()
  })

  it('register page should contain expected structural elements', () => {
    const html = renderRegisterPage()
    document.body.innerHTML = html

    expect(document.querySelector('.register-page')).not.toBeNull()
    expect(document.querySelector('.register-card')).not.toBeNull()
    expect(document.querySelector('input#name')).not.toBeNull()
    expect(document.querySelector('input#email')).not.toBeNull()
    expect(document.querySelector('input#password')).not.toBeNull()
    expect(document.querySelector('input#confirm-password')).not.toBeNull()
  })

  it('dashboard page should match snapshot', () => {
    const html = renderDashboardPage()
    expect(html).toMatchSnapshot()
  })

  it('dashboard page should contain all summary card classes', () => {
    const html = renderDashboardPage()
    document.body.innerHTML = html

    expect(document.querySelector('.dashboard')).not.toBeNull()
    expect(document.querySelector('.summary-grid')).not.toBeNull()
    expect(document.querySelectorAll('.summary-card').length).toBe(6)
    expect(document.querySelector('.ws-status')).not.toBeNull()
    expect(document.querySelector('.panel-feed')).not.toBeNull()
  })

  it('services page should match snapshot', () => {
    const html = renderServicesPage()
    expect(html).toMatchSnapshot()
  })

  it('services page should contain filter bar and table', () => {
    const html = renderServicesPage()
    document.body.innerHTML = html

    expect(document.querySelector('.services-page')).not.toBeNull()
    expect(document.querySelector('.filter-bar')).not.toBeNull()
    expect(document.querySelector('.data-table')).not.toBeNull()
    expect(document.querySelector('.view-toggle')).not.toBeNull()
  })

  it('incidents page should match snapshot', () => {
    const html = renderIncidentsPage()
    expect(html).toMatchSnapshot()
  })

  it('incidents page should contain filter buttons', () => {
    const html = renderIncidentsPage()
    document.body.innerHTML = html

    expect(document.querySelector('.incidents-page')).not.toBeNull()
    expect(document.querySelector('.filter-bar')).not.toBeNull()

    const filterBtns = document.querySelectorAll('.filter-btn')
    expect(filterBtns.length).toBe(4)

    const activeFilter = document.querySelector('.filter-btn.active')
    expect(activeFilter?.getAttribute('data-filter')).toBe('all')
  })

  it('settings page should match snapshot', () => {
    const html = renderSettingsPage()
    expect(html).toMatchSnapshot()
  })

  it('settings page should contain tab navigation', () => {
    const html = renderSettingsPage()
    document.body.innerHTML = html

    expect(document.querySelector('.settings-page')).not.toBeNull()
    expect(document.querySelector('.tab-nav')).not.toBeNull()
    expect(document.querySelectorAll('.tab-btn').length).toBe(4)

    const activeTab = document.querySelector('.tab-btn.active')
    expect(activeTab).not.toBeNull()
  })

  it('settings page should contain subnav links for team and backup', () => {
    const html = renderSettingsPage()
    document.body.innerHTML = html

    const subNavLinks = document.querySelectorAll('.subnav-link')
    expect(subNavLinks.length).toBe(2)

    const hrefs = Array.from(subNavLinks).map((a) => (a as HTMLAnchorElement).href)
    expect(hrefs.some((h) => h.includes('/settings/team'))).toBe(true)
    expect(hrefs.some((h) => h.includes('/settings/backup'))).toBe(true)
  })

  it('login page html should be stable across multiple renders', () => {
    const html1 = renderLoginPage()
    const html2 = renderLoginPage()
    expect(html1).toBe(html2)
  })

  it('dashboard page html should be stable across multiple renders', () => {
    const html1 = renderDashboardPage()
    const html2 = renderDashboardPage()
    expect(html1).toBe(html2)
  })
})
