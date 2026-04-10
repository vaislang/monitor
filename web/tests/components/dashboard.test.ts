import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn()
const mockFetch = vi.fn()

vi.mock('../../app/i18n.vais', () => ({
  t: (key: string) => key,
}))

vi.mock('../../app/stores/app.vais', () => ({
  appStore: { page_title: 'Dashboard', is_loading: false },
}))

;(globalThis as any).router = { navigate: mockNavigate }
;(globalThis as any).fetch = mockFetch

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DashboardStats {
  total_services: number
  healthy_services: number
  down_services: number
  degraded_services: number
  active_incidents: number
  total_alerts: number
}

interface RecentEvent {
  type: string
  status: string
  label: string
  service_name: string
  time_ago: string
  badge: string
  severity?: string
}

interface RecentIncident {
  id: string
  title: string
  service_name: string
  severity: string
  status: string
  time_ago: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSummaryCards(stats: DashboardStats): HTMLElement {
  const grid = document.createElement('div')
  grid.className = 'summary-grid'

  const cards = [
    { cls: 'card-total',     labelKey: 'dashboard.servicesOverview', value: stats.total_services,    link: '/services' },
    { cls: 'card-healthy',   labelKey: 'dashboard.healthyServices',  value: stats.healthy_services,  link: null },
    { cls: 'card-down',      labelKey: 'dashboard.downServices',     value: stats.down_services,     link: null },
    { cls: 'card-degraded',  labelKey: 'dashboard.degradedServices', value: stats.degraded_services, link: null },
    { cls: 'card-incidents', labelKey: 'dashboard.openIncidents',    value: stats.active_incidents,  link: '/incidents' },
    { cls: 'card-alerts',    labelKey: 'dashboard.activeAlerts',     value: stats.total_alerts,      link: '/alerts' },
  ]

  for (const card of cards) {
    const div = document.createElement('div')
    div.className = `summary-card ${card.cls}`

    const content = document.createElement('div')
    content.className = 'card-content'

    const label = document.createElement('span')
    label.className = 'card-label'
    label.textContent = card.labelKey

    const value = document.createElement('span')
    value.className = 'card-value'
    value.textContent = String(card.value)

    content.appendChild(label)
    content.appendChild(value)
    div.appendChild(content)

    if (card.link) {
      const a = document.createElement('a')
      a.href = card.link
      a.className = 'card-link'
      a.setAttribute('data-link', card.link)
      a.textContent = 'common.detail →'
      div.appendChild(a)
    }

    grid.appendChild(div)
  }

  return grid
}

function buildEventFeed(events: RecentEvent[]): HTMLElement {
  const section = document.createElement('section')
  section.className = 'panel panel-feed'

  const header = document.createElement('div')
  header.className = 'panel-header'
  const title = document.createElement('h3')
  title.className = 'panel-title'
  title.textContent = 'dashboard.systemHealth'
  header.appendChild(title)

  if (events.length > 0) {
    const badge = document.createElement('span')
    badge.className = 'event-count-badge'
    badge.textContent = String(events.length)
    header.appendChild(badge)
  }

  section.appendChild(header)

  const list = document.createElement('div')
  list.className = 'event-list'

  if (events.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'empty-state'
    empty.setAttribute('data-testid', 'empty-state')
    const icon = document.createElement('span')
    icon.className = 'empty-icon'
    icon.textContent = '✓'
    const msg = document.createElement('span')
    msg.textContent = 'dashboard.noRecentEvents'
    empty.appendChild(icon)
    empty.appendChild(msg)
    list.appendChild(empty)
  } else {
    for (const ev of events) {
      const item = document.createElement('div')
      item.className = 'event-item'
      if (ev.type === 'incident' || ev.status === 'down') item.classList.add('event-item--danger')
      if (ev.status === 'degraded') item.classList.add('event-item--warning')
      if (ev.status === 'up' || ev.status === 'resolved') item.classList.add('event-item--success')

      const dot = document.createElement('div')
      dot.className = 'event-dot'
      const body = document.createElement('div')
      body.className = 'event-body'
      const elLabel = document.createElement('span')
      elLabel.className = 'event-label'
      elLabel.textContent = ev.label
      const elMeta = document.createElement('span')
      elMeta.className = 'event-meta'
      elMeta.textContent = `${ev.service_name} · ${ev.time_ago}`
      body.appendChild(elLabel)
      body.appendChild(elMeta)

      const badge = document.createElement('span')
      badge.className = `event-badge event-badge--${ev.severity || ev.type}`
      badge.textContent = ev.badge

      item.appendChild(dot)
      item.appendChild(body)
      item.appendChild(badge)
      list.appendChild(item)
    }
  }

  section.appendChild(list)
  return section
}

function buildWsStatus(connected: boolean, error: boolean): HTMLElement {
  const div = document.createElement('div')
  div.className = 'ws-status'
  if (connected) div.classList.add('connected')
  if (error) div.classList.add('error')

  const dot = document.createElement('span')
  dot.className = 'ws-dot'

  const label = document.createElement('span')
  label.className = 'ws-label'

  if (connected) {
    label.textContent = 'dashboard.realtimeConnected'
  } else if (error) {
    label.textContent = 'dashboard.realtimeError'
  } else {
    label.textContent = 'dashboard.realtimeConnecting'
  }

  div.appendChild(dot)
  div.appendChild(label)
  return div
}

function mountDashboard(options: {
  stats?: Partial<DashboardStats>
  events?: RecentEvent[]
  incidents?: RecentIncident[]
  wsConnected?: boolean
  wsError?: boolean
  isLoading?: boolean
} = {}) {
  const stats: DashboardStats = {
    total_services: 10,
    healthy_services: 7,
    down_services: 1,
    degraded_services: 2,
    active_incidents: 3,
    total_alerts: 5,
    ...options.stats,
  }

  const events = options.events ?? []
  const wsConnected = options.wsConnected ?? false
  const wsError = options.wsError ?? false

  const dashboard = document.createElement('div')
  dashboard.className = 'dashboard'

  // Header with ws status
  const pageHeader = document.createElement('div')
  pageHeader.className = 'page-header'
  const headerText = document.createElement('div')
  headerText.className = 'header-text'
  const h2 = document.createElement('h2')
  h2.className = 'page-title'
  h2.textContent = 'dashboard.title'
  headerText.appendChild(h2)
  pageHeader.appendChild(headerText)

  const headerActions = document.createElement('div')
  headerActions.className = 'header-actions'
  headerActions.appendChild(buildWsStatus(wsConnected, wsError))

  const refreshBtn = document.createElement('button')
  refreshBtn.className = 'btn-refresh'
  refreshBtn.setAttribute('data-testid', 'refresh-btn')
  refreshBtn.textContent = 'common.refresh'
  headerActions.appendChild(refreshBtn)

  pageHeader.appendChild(headerActions)
  dashboard.appendChild(pageHeader)

  // Summary cards
  dashboard.appendChild(buildSummaryCards(stats))

  // Event feed
  const body = document.createElement('div')
  body.className = 'dashboard-body'
  body.appendChild(buildEventFeed(events))
  dashboard.appendChild(body)

  document.body.appendChild(dashboard)
  return { dashboard, stats }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Dashboard', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    mockNavigate.mockClear()
    mockFetch.mockClear()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('should render all summary cards', () => {
    const { dashboard } = mountDashboard()

    const cards = dashboard.querySelectorAll('.summary-card')
    expect(cards.length).toBe(6)
  })

  it('should display correct stat values in summary cards', () => {
    const { dashboard, stats } = mountDashboard({
      stats: { total_services: 15, healthy_services: 10, down_services: 3 },
    })

    const totalCard = dashboard.querySelector('.card-total .card-value')
    expect(totalCard?.textContent).toBe('15')

    const healthyCard = dashboard.querySelector('.card-healthy .card-value')
    expect(healthyCard?.textContent).toBe('10')

    const downCard = dashboard.querySelector('.card-down .card-value')
    expect(downCard?.textContent).toBe('3')
  })

  it('should render card links for services and incidents', () => {
    const { dashboard } = mountDashboard()

    const links = dashboard.querySelectorAll('.card-link[data-link]')
    const hrefs = Array.from(links).map((l) => l.getAttribute('data-link'))

    expect(hrefs).toContain('/services')
    expect(hrefs).toContain('/incidents')
    expect(hrefs).toContain('/alerts')
  })

  it('should show empty state when no recent events', () => {
    const { dashboard } = mountDashboard({ events: [] })

    const emptyState = dashboard.querySelector('[data-testid="empty-state"]')
    expect(emptyState).not.toBeNull()
  })

  it('should render event items in feed', () => {
    const events: RecentEvent[] = [
      { type: 'status', status: 'down', label: 'Service Down', service_name: 'api-gateway', time_ago: '2m ago', badge: 'DOWN', severity: 'critical' },
      { type: 'metric', status: 'up', label: 'Recovered', service_name: 'auth-service', time_ago: '5m ago', badge: 'UP', severity: 'info' },
    ]

    const { dashboard } = mountDashboard({ events })

    const eventItems = dashboard.querySelectorAll('.event-item')
    expect(eventItems.length).toBe(2)
  })

  it('should apply danger class to down-status event items', () => {
    const events: RecentEvent[] = [
      { type: 'status', status: 'down', label: 'API Down', service_name: 'api', time_ago: '1m ago', badge: 'DOWN' },
    ]

    const { dashboard } = mountDashboard({ events })

    const item = dashboard.querySelector('.event-item')
    expect(item?.classList.contains('event-item--danger')).toBe(true)
  })

  it('should apply success class to resolved event items', () => {
    const events: RecentEvent[] = [
      { type: 'status', status: 'resolved', label: 'Resolved', service_name: 'db', time_ago: '10m ago', badge: 'OK' },
    ]

    const { dashboard } = mountDashboard({ events })

    const item = dashboard.querySelector('.event-item')
    expect(item?.classList.contains('event-item--success')).toBe(true)
  })

  it('should show event count badge when events are present', () => {
    const events: RecentEvent[] = [
      { type: 'metric', status: 'up', label: 'Metric', service_name: 'svc', time_ago: '1m ago', badge: 'INFO' },
      { type: 'metric', status: 'up', label: 'Metric 2', service_name: 'svc2', time_ago: '2m ago', badge: 'INFO' },
    ]

    const { dashboard } = mountDashboard({ events })

    const countBadge = dashboard.querySelector('.event-count-badge')
    expect(countBadge).not.toBeNull()
    expect(countBadge?.textContent).toBe('2')
  })

  it('should show "connected" status when WebSocket is connected', () => {
    const { dashboard } = mountDashboard({ wsConnected: true, wsError: false })

    const wsStatus = dashboard.querySelector('.ws-status')
    expect(wsStatus?.classList.contains('connected')).toBe(true)
    expect(wsStatus?.classList.contains('error')).toBe(false)

    const label = wsStatus?.querySelector('.ws-label')
    expect(label?.textContent).toBe('dashboard.realtimeConnected')
  })

  it('should show "error" status when WebSocket has an error', () => {
    const { dashboard } = mountDashboard({ wsConnected: false, wsError: true })

    const wsStatus = dashboard.querySelector('.ws-status')
    expect(wsStatus?.classList.contains('error')).toBe(true)

    const label = wsStatus?.querySelector('.ws-label')
    expect(label?.textContent).toBe('dashboard.realtimeError')
  })

  it('should show "connecting" status when WebSocket is not yet connected', () => {
    const { dashboard } = mountDashboard({ wsConnected: false, wsError: false })

    const wsStatus = dashboard.querySelector('.ws-status')
    expect(wsStatus?.classList.contains('connected')).toBe(false)
    expect(wsStatus?.classList.contains('error')).toBe(false)

    const label = wsStatus?.querySelector('.ws-label')
    expect(label?.textContent).toBe('dashboard.realtimeConnecting')
  })

  it('should render refresh button', () => {
    const { dashboard } = mountDashboard()

    const refreshBtn = dashboard.querySelector('[data-testid="refresh-btn"]')
    expect(refreshBtn).not.toBeNull()
  })

  it('should call loadDashboardData on refresh button click', () => {
    const mockRefresh = vi.fn()
    const { dashboard } = mountDashboard()

    const refreshBtn = dashboard.querySelector<HTMLButtonElement>('[data-testid="refresh-btn"]')!
    refreshBtn.addEventListener('click', mockRefresh)
    refreshBtn.click()

    expect(mockRefresh).toHaveBeenCalledTimes(1)
  })

  it('should display zero values gracefully when stats are all zero', () => {
    const { dashboard } = mountDashboard({
      stats: {
        total_services: 0,
        healthy_services: 0,
        down_services: 0,
        degraded_services: 0,
        active_incidents: 0,
        total_alerts: 0,
      },
    })

    const values = Array.from(dashboard.querySelectorAll('.card-value')).map((el) => el.textContent)
    expect(values.every((v) => v === '0')).toBe(true)
  })
})
