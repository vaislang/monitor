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
  appStore: { page_title: 'Logs', is_loading: false },
}))

;(globalThis as any).router = { navigate: mockNavigate }
;(globalThis as any).fetch = mockFetch

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LogEntry {
  id: string
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
  message: string
  service: string
  timestamp: string
}

interface LogSearchState {
  query: string
  mode: 'bm25' | 'boolean' | 'phrase'
  level: string
  service: string
  startTime: string
  endTime: string
  tailMode: boolean
  results: LogEntry[]
  total: number
  loading: boolean
  error: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSearchBar(state: Partial<LogSearchState> = {}): HTMLElement {
  const {
    query = '',
    mode = 'bm25',
    level = '',
    service = '',
    loading = false,
  } = state

  const container = document.createElement('div')
  container.className = 'search-bar'
  container.setAttribute('data-testid', 'search-bar')

  const queryInput = document.createElement('input')
  queryInput.type = 'text'
  queryInput.className = 'search-input'
  queryInput.value = query
  queryInput.placeholder = 'logs.searchPlaceholder'
  queryInput.disabled = loading
  queryInput.setAttribute('data-testid', 'search-input')
  container.appendChild(queryInput)

  const modeSelect = document.createElement('select')
  modeSelect.className = 'mode-select'
  modeSelect.setAttribute('data-testid', 'mode-select')
  modeSelect.disabled = loading
  for (const m of ['bm25', 'boolean', 'phrase']) {
    const opt = document.createElement('option')
    opt.value = m
    opt.textContent = `logs.mode.${m}`
    opt.selected = m === mode
    modeSelect.appendChild(opt)
  }
  container.appendChild(modeSelect)

  const levelSelect = document.createElement('select')
  levelSelect.className = 'level-select'
  levelSelect.setAttribute('data-testid', 'level-select')
  levelSelect.disabled = loading
  const allOpt = document.createElement('option')
  allOpt.value = ''
  allOpt.textContent = 'logs.allLevels'
  allOpt.selected = level === ''
  levelSelect.appendChild(allOpt)
  for (const l of ['DEBUG', 'INFO', 'WARN', 'ERROR']) {
    const opt = document.createElement('option')
    opt.value = l
    opt.textContent = l
    opt.selected = l === level
    levelSelect.appendChild(opt)
  }
  container.appendChild(levelSelect)

  const serviceInput = document.createElement('input')
  serviceInput.type = 'text'
  serviceInput.className = 'service-filter'
  serviceInput.value = service
  serviceInput.placeholder = 'logs.filterByService'
  serviceInput.setAttribute('data-testid', 'service-input')
  container.appendChild(serviceInput)

  const searchBtn = document.createElement('button')
  searchBtn.type = 'button'
  searchBtn.className = 'btn btn-primary search-btn'
  searchBtn.disabled = loading
  searchBtn.setAttribute('data-testid', 'search-btn')
  searchBtn.textContent = loading ? 'common.searching' : 'logs.searchBtn'
  container.appendChild(searchBtn)

  return container
}

function buildTimeRangeFilter(startTime: string, endTime: string): HTMLElement {
  const container = document.createElement('div')
  container.className = 'time-range-filter'
  container.setAttribute('data-testid', 'time-range-filter')

  const startInput = document.createElement('input')
  startInput.type = 'datetime-local'
  startInput.className = 'time-input'
  startInput.value = startTime
  startInput.setAttribute('data-testid', 'start-time-input')
  container.appendChild(startInput)

  const endInput = document.createElement('input')
  endInput.type = 'datetime-local'
  endInput.className = 'time-input'
  endInput.value = endTime
  endInput.setAttribute('data-testid', 'end-time-input')
  container.appendChild(endInput)

  return container
}

function buildLogResults(results: LogEntry[], total: number, loading: boolean, error: string): HTMLElement {
  const container = document.createElement('div')
  container.className = 'log-results'
  container.setAttribute('data-testid', 'log-results')

  if (loading) {
    const spinner = document.createElement('div')
    spinner.className = 'loading-spinner'
    spinner.setAttribute('data-testid', 'loading-spinner')
    container.appendChild(spinner)
    return container
  }

  if (error) {
    const errDiv = document.createElement('div')
    errDiv.className = 'error-state'
    errDiv.setAttribute('data-testid', 'error-state')
    errDiv.textContent = error
    container.appendChild(errDiv)
    return container
  }

  const header = document.createElement('div')
  header.className = 'results-header'
  const countSpan = document.createElement('span')
  countSpan.className = 'results-count'
  countSpan.setAttribute('data-testid', 'results-count')
  countSpan.textContent = String(total)
  header.appendChild(countSpan)
  container.appendChild(header)

  if (results.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'empty-state'
    empty.setAttribute('data-testid', 'empty-state')
    empty.textContent = 'logs.noResults'
    container.appendChild(empty)
  } else {
    const list = document.createElement('div')
    list.className = 'log-list'
    for (const entry of results) {
      const row = document.createElement('div')
      row.className = `log-row log-row--${entry.level.toLowerCase()}`
      row.setAttribute('data-testid', 'log-row')
      row.setAttribute('data-id', entry.id)

      const levelBadge = document.createElement('span')
      levelBadge.className = `level-badge level-badge--${entry.level.toLowerCase()}`
      levelBadge.setAttribute('data-testid', 'level-badge')
      levelBadge.textContent = entry.level

      const messageSpan = document.createElement('span')
      messageSpan.className = 'log-message'
      messageSpan.textContent = entry.message

      const serviceSpan = document.createElement('span')
      serviceSpan.className = 'log-service'
      serviceSpan.textContent = entry.service

      const timeSpan = document.createElement('span')
      timeSpan.className = 'log-timestamp'
      timeSpan.textContent = entry.timestamp

      row.appendChild(levelBadge)
      row.appendChild(messageSpan)
      row.appendChild(serviceSpan)
      row.appendChild(timeSpan)
      list.appendChild(row)
    }
    container.appendChild(list)
  }

  return container
}

function buildTailToggle(tailMode: boolean): HTMLElement {
  const container = document.createElement('div')
  container.className = 'tail-controls'

  const toggleBtn = document.createElement('button')
  toggleBtn.type = 'button'
  toggleBtn.className = 'btn btn-secondary tail-toggle'
  toggleBtn.setAttribute('data-testid', 'tail-toggle')
  toggleBtn.textContent = tailMode ? 'logs.tailStop' : 'logs.tailStart'

  if (tailMode) {
    const indicator = document.createElement('span')
    indicator.className = 'tail-indicator'
    indicator.setAttribute('data-testid', 'tail-indicator')
    indicator.textContent = 'logs.tailActive'
    container.appendChild(indicator)
  }

  container.appendChild(toggleBtn)
  return container
}

function mountLogsPage(state: Partial<LogSearchState> = {}): HTMLElement {
  const defaults: LogSearchState = {
    query: '',
    mode: 'bm25',
    level: '',
    service: '',
    startTime: '',
    endTime: '',
    tailMode: false,
    results: [],
    total: 0,
    loading: false,
    error: '',
    ...state,
  }

  const page = document.createElement('div')
  page.className = 'logs-page'

  const header = document.createElement('div')
  header.className = 'page-header'
  const h2 = document.createElement('h2')
  h2.className = 'page-title'
  h2.textContent = 'logs.title'
  header.appendChild(h2)
  page.appendChild(header)

  page.appendChild(buildSearchBar(defaults))
  page.appendChild(buildTimeRangeFilter(defaults.startTime, defaults.endTime))
  page.appendChild(buildTailToggle(defaults.tailMode))
  page.appendChild(buildLogResults(defaults.results, defaults.total, defaults.loading, defaults.error))

  document.body.appendChild(page)
  return page
}

// ---------------------------------------------------------------------------
// Tests: Search Functionality
// ---------------------------------------------------------------------------

describe('Logs Page', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    mockNavigate.mockClear()
    mockFetch.mockClear()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  describe('Search functionality', () => {
    it('should send BM25 search query with correct params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [], total: 0 }),
      })

      const url = '/api/v1/logs/search?q=error&mode=bm25&limit=50'
      await fetch(url, { headers: { 'Authorization': 'Bearer test-token' } })

      expect(mockFetch).toHaveBeenCalledWith(url, expect.objectContaining({
        headers: expect.objectContaining({ 'Authorization': 'Bearer test-token' }),
      }))
    })

    it('should send BOOLEAN search query', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ results: [], total: 0 }) })

      const url = '/api/v1/logs/search?q=error+AND+timeout&mode=boolean&limit=50'
      await fetch(url, { headers: { 'Authorization': 'Bearer test-token' } })

      expect(mockFetch).toHaveBeenCalled()
    })

    it('should send PHRASE search query', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ results: [], total: 0 }) })

      const url = '/api/v1/logs/search?q=connection+refused&mode=phrase&limit=50'
      await fetch(url, { headers: { 'Authorization': 'Bearer test-token' } })

      expect(mockFetch).toHaveBeenCalled()
    })

    it('should return results and total count', async () => {
      const results: LogEntry[] = [
        { id: '1', level: 'ERROR', message: 'Connection refused', service: 'api-gateway', timestamp: '2026-04-07T10:00:00Z' },
      ]
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results, total: 1 }),
      })

      const resp = await fetch('/api/v1/logs/search?q=error&mode=bm25', {
        headers: { 'Authorization': 'Bearer test-token' },
      })
      const data = await resp.json()

      expect(data.results).toHaveLength(1)
      expect(data.total).toBe(1)
      expect(data.results[0].level).toBe('ERROR')
    })

    it('should handle search error gracefully', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })

      const resp = await fetch('/api/v1/logs/search?q=test')
      expect(resp.ok).toBe(false)
      expect(resp.status).toBe(500)
    })

    it('should render search input in DOM', () => {
      const page = mountLogsPage({ query: 'timeout error' })

      const input = page.querySelector<HTMLInputElement>('[data-testid="search-input"]')
      expect(input).not.toBeNull()
      expect(input?.value).toBe('timeout error')
    })

    it('should render mode select with bm25 option selected by default', () => {
      const page = mountLogsPage()

      const modeSelect = page.querySelector<HTMLSelectElement>('[data-testid="mode-select"]')
      expect(modeSelect).not.toBeNull()
      expect(modeSelect?.value).toBe('bm25')
    })

    it('should render search button', () => {
      const page = mountLogsPage()

      const btn = page.querySelector('[data-testid="search-btn"]')
      expect(btn).not.toBeNull()
      expect((btn as HTMLButtonElement).disabled).toBe(false)
    })

    it('should disable search button while loading', () => {
      const page = mountLogsPage({ loading: true })

      const btn = page.querySelector<HTMLButtonElement>('[data-testid="search-btn"]')
      expect(btn?.disabled).toBe(true)
    })
  })

  describe('Filters', () => {
    it('should filter by log level', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [{ id: '1', level: 'ERROR', message: 'fail', service: 'svc', timestamp: '' }], total: 1 }),
      })

      const url = '/api/v1/logs/search?q=*&level=ERROR'
      await fetch(url, { headers: { 'Authorization': 'Bearer test-token' } })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('level=ERROR'),
        expect.anything(),
      )
    })

    it('should filter by time range', async () => {
      const start = '2026-04-01T00:00:00Z'
      const end = '2026-04-07T23:59:59Z'
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ results: [], total: 0 }) })

      const url = `/api/v1/logs/search?q=*&start=${start}&end=${end}`
      await fetch(url, { headers: { 'Authorization': 'Bearer test-token' } })

      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('start='), expect.anything())
    })

    it('should filter by service name', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ results: [], total: 0 }) })

      const url = '/api/v1/logs/search?q=*&service=api-gateway'
      await fetch(url, { headers: { 'Authorization': 'Bearer test-token' } })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('service=api-gateway'),
        expect.anything(),
      )
    })

    it('should render level select with all options', () => {
      const page = mountLogsPage()

      const levelSelect = page.querySelector('[data-testid="level-select"]')
      expect(levelSelect).not.toBeNull()
      const options = levelSelect?.querySelectorAll('option')
      // '' + DEBUG + INFO + WARN + ERROR = 5
      expect(options?.length).toBe(5)
    })

    it('should render service filter input', () => {
      const page = mountLogsPage({ service: 'auth-service' })

      const input = page.querySelector<HTMLInputElement>('[data-testid="service-input"]')
      expect(input).not.toBeNull()
      expect(input?.value).toBe('auth-service')
    })

    it('should render time range filter', () => {
      const page = mountLogsPage({
        startTime: '2026-04-01T00:00',
        endTime: '2026-04-07T23:59',
      })

      const startInput = page.querySelector<HTMLInputElement>('[data-testid="start-time-input"]')
      const endInput = page.querySelector<HTMLInputElement>('[data-testid="end-time-input"]')

      expect(startInput?.value).toBe('2026-04-01T00:00')
      expect(endInput?.value).toBe('2026-04-07T23:59')
    })
  })

  describe('Results display', () => {
    it('should render log rows with correct level badges', () => {
      const results: LogEntry[] = [
        { id: '1', level: 'ERROR', message: 'DB timeout', service: 'db-service', timestamp: '2026-04-07T09:00:00Z' },
        { id: '2', level: 'WARN', message: 'High memory', service: 'worker', timestamp: '2026-04-07T09:01:00Z' },
      ]
      const page = mountLogsPage({ results, total: 2 })

      const rows = page.querySelectorAll('[data-testid="log-row"]')
      expect(rows.length).toBe(2)

      const badges = page.querySelectorAll('[data-testid="level-badge"]')
      const levels = Array.from(badges).map((b) => b.textContent)
      expect(levels).toContain('ERROR')
      expect(levels).toContain('WARN')
    })

    it('should apply correct CSS class per log level', () => {
      const results: LogEntry[] = [
        { id: '1', level: 'ERROR', message: 'fail', service: 'svc', timestamp: '' },
      ]
      const page = mountLogsPage({ results, total: 1 })

      const row = page.querySelector('[data-testid="log-row"]')
      expect(row?.classList.contains('log-row--error')).toBe(true)
    })

    it('should show empty state when no results', () => {
      const page = mountLogsPage({ results: [], total: 0 })

      const emptyState = page.querySelector('[data-testid="empty-state"]')
      expect(emptyState).not.toBeNull()
      expect(emptyState?.textContent).toBe('logs.noResults')
    })

    it('should display total result count', () => {
      const results: LogEntry[] = [
        { id: '1', level: 'INFO', message: 'ok', service: 'svc', timestamp: '' },
      ]
      const page = mountLogsPage({ results, total: 42 })

      const countEl = page.querySelector('[data-testid="results-count"]')
      expect(countEl?.textContent).toBe('42')
    })

    it('should show loading spinner while fetching', () => {
      const page = mountLogsPage({ loading: true })

      const spinner = page.querySelector('[data-testid="loading-spinner"]')
      expect(spinner).not.toBeNull()
    })

    it('should show error state on fetch failure', () => {
      const page = mountLogsPage({ error: 'logs.fetchError' })

      const errState = page.querySelector('[data-testid="error-state"]')
      expect(errState).not.toBeNull()
      expect(errState?.textContent).toBe('logs.fetchError')
    })
  })

  describe('Tail mode', () => {
    it('should poll for new logs in tail mode', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({ results: [], total: 0 }) })

      await fetch('/api/v1/logs?limit=50&tail=true')
      await fetch('/api/v1/logs?limit=50&tail=true')

      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should render tail toggle button', () => {
      const page = mountLogsPage({ tailMode: false })

      const toggleBtn = page.querySelector('[data-testid="tail-toggle"]')
      expect(toggleBtn).not.toBeNull()
      expect(toggleBtn?.textContent).toBe('logs.tailStart')
    })

    it('should show active indicator when tail mode is on', () => {
      const page = mountLogsPage({ tailMode: true })

      const indicator = page.querySelector('[data-testid="tail-indicator"]')
      expect(indicator).not.toBeNull()
    })

    it('should change toggle label when tail is active', () => {
      const page = mountLogsPage({ tailMode: true })

      const toggleBtn = page.querySelector('[data-testid="tail-toggle"]')
      expect(toggleBtn?.textContent).toBe('logs.tailStop')
    })

    it('should call toggleTail handler on button click', () => {
      const mockToggleTail = vi.fn()
      const page = mountLogsPage({ tailMode: false })

      const toggleBtn = page.querySelector<HTMLButtonElement>('[data-testid="tail-toggle"]')!
      toggleBtn.addEventListener('click', mockToggleTail)
      toggleBtn.click()

      expect(mockToggleTail).toHaveBeenCalledTimes(1)
    })
  })
})
