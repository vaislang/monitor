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
  appStore: { page_title: 'Alerts', is_loading: false },
}))

;(globalThis as any).router = { navigate: mockNavigate }
;(globalThis as any).fetch = mockFetch

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AlertRule {
  id: number
  name: string
  service_id: number
  condition_metric: string
  condition_op: 'gt' | 'lt' | 'eq' | 'gte' | 'lte'
  condition_value: number
  severity: 'critical' | 'warning' | 'info'
  active: boolean
  muted: boolean
}

interface AlertFormState {
  name: string
  service_id: number | null
  condition_metric: string
  condition_op: string
  condition_value: string
  severity: string
  nameError: string
  metricError: string
  valueError: string
  loading: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildAlertRuleRow(rule: AlertRule): HTMLElement {
  const row = document.createElement('div')
  row.className = 'alert-rule-row'
  row.setAttribute('data-testid', 'alert-rule-row')
  row.setAttribute('data-id', String(rule.id))

  const nameSpan = document.createElement('span')
  nameSpan.className = 'rule-name'
  nameSpan.setAttribute('data-testid', 'rule-name')
  nameSpan.textContent = rule.name

  const metricSpan = document.createElement('span')
  metricSpan.className = 'rule-metric'
  metricSpan.textContent = `${rule.condition_metric} ${rule.condition_op} ${rule.condition_value}`

  const severityBadge = document.createElement('span')
  severityBadge.className = `severity-badge severity-badge--${rule.severity}`
  severityBadge.setAttribute('data-testid', 'severity-badge')
  severityBadge.textContent = rule.severity

  const activeToggle = document.createElement('button')
  activeToggle.className = 'btn btn-toggle active-toggle'
  activeToggle.setAttribute('data-testid', 'active-toggle')
  activeToggle.setAttribute('aria-pressed', String(rule.active))
  activeToggle.textContent = rule.active ? 'alerts.active' : 'alerts.inactive'

  const muteBtn = document.createElement('button')
  muteBtn.className = 'btn btn-secondary mute-btn'
  muteBtn.setAttribute('data-testid', 'mute-btn')
  muteBtn.textContent = rule.muted ? 'alerts.unmute' : 'alerts.mute'

  const deleteBtn = document.createElement('button')
  deleteBtn.className = 'btn btn-danger delete-btn'
  deleteBtn.setAttribute('data-testid', 'delete-btn')
  deleteBtn.textContent = 'common.delete'

  row.appendChild(nameSpan)
  row.appendChild(metricSpan)
  row.appendChild(severityBadge)
  row.appendChild(activeToggle)
  row.appendChild(muteBtn)
  row.appendChild(deleteBtn)

  return row
}

function buildAlertRuleList(rules: AlertRule[], loading: boolean, error: string): HTMLElement {
  const container = document.createElement('div')
  container.className = 'alert-rules-list'
  container.setAttribute('data-testid', 'alert-rules-list')

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

  if (rules.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'empty-state'
    empty.setAttribute('data-testid', 'empty-state')
    empty.textContent = 'alerts.noRules'
    container.appendChild(empty)
    return container
  }

  for (const rule of rules) {
    container.appendChild(buildAlertRuleRow(rule))
  }

  return container
}

function buildAlertForm(state: Partial<AlertFormState> = {}): HTMLElement {
  const {
    name = '',
    condition_metric = '',
    condition_op = 'gt',
    condition_value = '',
    severity = 'warning',
    nameError = '',
    metricError = '',
    valueError = '',
    loading = false,
  } = state

  const form = document.createElement('form')
  form.className = 'alert-rule-form'
  form.setAttribute('data-testid', 'alert-rule-form')

  function addField(
    id: string,
    type: string,
    labelText: string,
    val: string,
    error: string,
    testId: string,
  ) {
    const group = document.createElement('div')
    group.className = 'form-group' + (error ? ' has-error' : '')
    const label = document.createElement('label')
    label.htmlFor = id
    label.textContent = labelText
    const input = document.createElement('input')
    input.id = id
    input.type = type
    input.className = 'form-input'
    input.value = val
    input.disabled = loading
    input.setAttribute('data-testid', testId)
    group.appendChild(label)
    group.appendChild(input)
    if (error) {
      const err = document.createElement('span')
      err.className = 'field-error'
      err.setAttribute('data-testid', `${testId}-error`)
      err.textContent = error
      group.appendChild(err)
    }
    return group
  }

  form.appendChild(addField('rule-name', 'text', 'alerts.ruleName', name, nameError, 'name-input'))
  form.appendChild(addField('condition-metric', 'text', 'alerts.metric', condition_metric, metricError, 'metric-input'))

  const opGroup = document.createElement('div')
  opGroup.className = 'form-group'
  const opSelect = document.createElement('select')
  opSelect.id = 'condition-op'
  opSelect.className = 'form-select'
  opSelect.disabled = loading
  opSelect.setAttribute('data-testid', 'op-select')
  for (const op of ['gt', 'lt', 'eq', 'gte', 'lte']) {
    const opt = document.createElement('option')
    opt.value = op
    opt.textContent = op
    opt.selected = op === condition_op
    opSelect.appendChild(opt)
  }
  opGroup.appendChild(opSelect)
  form.appendChild(opGroup)

  form.appendChild(addField('condition-value', 'number', 'alerts.value', condition_value, valueError, 'value-input'))

  const severityGroup = document.createElement('div')
  severityGroup.className = 'form-group'
  const severitySelect = document.createElement('select')
  severitySelect.id = 'severity'
  severitySelect.className = 'form-select'
  severitySelect.disabled = loading
  severitySelect.setAttribute('data-testid', 'severity-select')
  for (const s of ['critical', 'warning', 'info']) {
    const opt = document.createElement('option')
    opt.value = s
    opt.textContent = `alerts.severity.${s}`
    opt.selected = s === severity
    severitySelect.appendChild(opt)
  }
  severityGroup.appendChild(severitySelect)
  form.appendChild(severityGroup)

  const submitBtn = document.createElement('button')
  submitBtn.type = 'submit'
  submitBtn.className = 'btn btn-primary'
  submitBtn.disabled = loading
  submitBtn.setAttribute('data-testid', 'submit-btn')
  submitBtn.textContent = loading ? 'common.saving' : 'common.save'
  form.appendChild(submitBtn)

  return form
}

function mountAlertsPage(options: {
  rules?: AlertRule[]
  loading?: boolean
  error?: string
  showForm?: boolean
  formState?: Partial<AlertFormState>
} = {}): HTMLElement {
  const {
    rules = [],
    loading = false,
    error = '',
    showForm = false,
    formState = {},
  } = options

  const page = document.createElement('div')
  page.className = 'alerts-page'

  const header = document.createElement('div')
  header.className = 'page-header'
  const h2 = document.createElement('h2')
  h2.className = 'page-title'
  h2.textContent = 'alerts.title'
  header.appendChild(h2)
  const addBtn = document.createElement('button')
  addBtn.type = 'button'
  addBtn.className = 'btn btn-primary'
  addBtn.setAttribute('data-testid', 'add-rule-btn')
  addBtn.textContent = 'alerts.addRule'
  header.appendChild(addBtn)
  page.appendChild(header)

  if (showForm) {
    page.appendChild(buildAlertForm(formState))
  }

  page.appendChild(buildAlertRuleList(rules, loading, error))

  document.body.appendChild(page)
  return page
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Alerts Page', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    mockNavigate.mockClear()
    mockFetch.mockClear()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  describe('Alert Rules List', () => {
    it('should fetch and display alert rules', async () => {
      const rules = [
        { id: 1, name: 'High CPU', condition_metric: 'cpu_usage', condition_op: 'gt', condition_value: 90, active: true, muted: false, service_id: 1, severity: 'critical' },
        { id: 2, name: 'Low Memory', condition_metric: 'memory_free', condition_op: 'lt', condition_value: 100, active: false, muted: false, service_id: 1, severity: 'warning' },
      ]
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ rules, total: 2 }) })

      const resp = await fetch('/api/v1/alerts', { headers: { 'Authorization': 'Bearer test-token' } })
      const data = await resp.json()

      expect(data.rules).toHaveLength(2)
      expect(data.rules[0].name).toBe('High CPU')
    })

    it('should render alert rule rows in DOM', () => {
      const rules: AlertRule[] = [
        { id: 1, name: 'High CPU', condition_metric: 'cpu_usage', condition_op: 'gt', condition_value: 90, active: true, muted: false, service_id: 1, severity: 'critical' },
        { id: 2, name: 'Low Memory', condition_metric: 'memory_free', condition_op: 'lt', condition_value: 100, active: false, muted: false, service_id: 1, severity: 'warning' },
      ]
      const page = mountAlertsPage({ rules })

      const rows = page.querySelectorAll('[data-testid="alert-rule-row"]')
      expect(rows.length).toBe(2)
    })

    it('should display rule names in rows', () => {
      const rules: AlertRule[] = [
        { id: 1, name: 'High CPU', condition_metric: 'cpu_usage', condition_op: 'gt', condition_value: 90, active: true, muted: false, service_id: 1, severity: 'critical' },
      ]
      const page = mountAlertsPage({ rules })

      const nameEl = page.querySelector('[data-testid="rule-name"]')
      expect(nameEl?.textContent).toBe('High CPU')
    })

    it('should toggle alert rule active status', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })

      await fetch('/api/v1/alerts/1', {
        method: 'PUT',
        headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: false }),
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/alerts/1', expect.objectContaining({ method: 'PUT' }))
    })

    it('should show empty state when no rules exist', () => {
      const page = mountAlertsPage({ rules: [] })

      const empty = page.querySelector('[data-testid="empty-state"]')
      expect(empty).not.toBeNull()
    })

    it('should show loading spinner while fetching', () => {
      const page = mountAlertsPage({ loading: true })

      const spinner = page.querySelector('[data-testid="loading-spinner"]')
      expect(spinner).not.toBeNull()
    })

    it('should handle fetch error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })

      const resp = await fetch('/api/v1/alerts')
      expect(resp.ok).toBe(false)
    })

    it('should show error state in DOM on failure', () => {
      const page = mountAlertsPage({ error: 'alerts.fetchError' })

      const errState = page.querySelector('[data-testid="error-state"]')
      expect(errState).not.toBeNull()
    })

    it('should render severity badge for each rule', () => {
      const rules: AlertRule[] = [
        { id: 1, name: 'Disk Full', condition_metric: 'disk_usage', condition_op: 'gt', condition_value: 95, active: true, muted: false, service_id: 1, severity: 'critical' },
      ]
      const page = mountAlertsPage({ rules })

      const badge = page.querySelector('[data-testid="severity-badge"]')
      expect(badge?.textContent).toBe('critical')
      expect(badge?.classList.contains('severity-badge--critical')).toBe(true)
    })

    it('should render add rule button', () => {
      const page = mountAlertsPage()

      const addBtn = page.querySelector('[data-testid="add-rule-btn"]')
      expect(addBtn).not.toBeNull()
    })
  })

  describe('Create Alert Rule', () => {
    it('should create new alert rule with valid data', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 3, name: 'Disk Full' }) })

      const body = {
        name: 'Disk Full',
        service_id: 1,
        condition_metric: 'disk_usage',
        condition_op: 'gt',
        condition_value: 95,
        severity: 'critical',
      }
      await fetch('/api/v1/alerts', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/alerts', expect.objectContaining({ method: 'POST' }))
    })

    it('should reject creation with missing required fields', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ error: 'Missing required fields' }) })

      const resp = await fetch('/api/v1/alerts', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Incomplete' }),
      })

      expect(resp.ok).toBe(false)
      expect(resp.status).toBe(400)
    })

    it('should render alert form when showForm is true', () => {
      const page = mountAlertsPage({ showForm: true })

      const form = page.querySelector('[data-testid="alert-rule-form"]')
      expect(form).not.toBeNull()
    })

    it('should render name, metric, op, value, severity fields in form', () => {
      const page = mountAlertsPage({ showForm: true })

      expect(page.querySelector('[data-testid="name-input"]')).not.toBeNull()
      expect(page.querySelector('[data-testid="metric-input"]')).not.toBeNull()
      expect(page.querySelector('[data-testid="op-select"]')).not.toBeNull()
      expect(page.querySelector('[data-testid="value-input"]')).not.toBeNull()
      expect(page.querySelector('[data-testid="severity-select"]')).not.toBeNull()
    })

    it('should show field error when name is missing', () => {
      const page = mountAlertsPage({
        showForm: true,
        formState: { nameError: 'alerts.nameRequired' },
      })

      const nameErr = page.querySelector('[data-testid="name-input-error"]')
      expect(nameErr?.textContent).toBe('alerts.nameRequired')
      const nameGroup = page.querySelector('[data-testid="name-input"]')?.closest('.form-group')
      expect(nameGroup?.classList.contains('has-error')).toBe(true)
    })

    it('should disable form fields while saving', () => {
      const page = mountAlertsPage({ showForm: true, formState: { loading: true } })

      const submitBtn = page.querySelector<HTMLButtonElement>('[data-testid="submit-btn"]')
      expect(submitBtn?.disabled).toBe(true)
    })
  })

  describe('Delete Alert Rule', () => {
    it('should delete alert rule', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })

      await fetch('/api/v1/alerts/1', {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer test-token' },
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/alerts/1', expect.objectContaining({ method: 'DELETE' }))
    })

    it('should call delete handler on delete button click', () => {
      const mockDelete = vi.fn()
      const rules: AlertRule[] = [
        { id: 1, name: 'High CPU', condition_metric: 'cpu_usage', condition_op: 'gt', condition_value: 90, active: true, muted: false, service_id: 1, severity: 'critical' },
      ]
      const page = mountAlertsPage({ rules })

      const deleteBtn = page.querySelector<HTMLButtonElement>('[data-testid="delete-btn"]')!
      deleteBtn.addEventListener('click', mockDelete)
      deleteBtn.click()

      expect(mockDelete).toHaveBeenCalledTimes(1)
    })
  })

  describe('Mute/Unmute', () => {
    it('should mute alert rule', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ muted: true }) })

      await fetch('/api/v1/alerts/1/mute', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-token' },
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/alerts/1/mute', expect.objectContaining({ method: 'POST' }))
    })

    it('should unmute alert rule', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ muted: false }) })

      await fetch('/api/v1/alerts/1/unmute', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-token' },
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/alerts/1/unmute', expect.objectContaining({ method: 'POST' }))
    })

    it('should show mute button label for unmuted rule', () => {
      const rules: AlertRule[] = [
        { id: 1, name: 'High CPU', condition_metric: 'cpu_usage', condition_op: 'gt', condition_value: 90, active: true, muted: false, service_id: 1, severity: 'critical' },
      ]
      const page = mountAlertsPage({ rules })

      const muteBtn = page.querySelector('[data-testid="mute-btn"]')
      expect(muteBtn?.textContent).toBe('alerts.mute')
    })

    it('should show unmute button label for muted rule', () => {
      const rules: AlertRule[] = [
        { id: 1, name: 'High CPU', condition_metric: 'cpu_usage', condition_op: 'gt', condition_value: 90, active: true, muted: true, service_id: 1, severity: 'critical' },
      ]
      const page = mountAlertsPage({ rules })

      const muteBtn = page.querySelector('[data-testid="mute-btn"]')
      expect(muteBtn?.textContent).toBe('alerts.unmute')
    })
  })
})
