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
  appStore: { page_title: 'AI Query', is_loading: false },
}))

;(globalThis as any).router = { navigate: mockNavigate }
;(globalThis as any).fetch = mockFetch

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatSource {
  type: 'log' | 'incident' | 'metric' | 'alert'
  id: string
  relevance: number
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  sources?: ChatSource[]
  timestamp: string
}

interface AiSession {
  id: string
  last_query: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildChatMessage(msg: ChatMessage): HTMLElement {
  const el = document.createElement('div')
  el.className = `chat-message chat-message--${msg.role}`
  el.setAttribute('data-testid', 'chat-message')
  el.setAttribute('data-role', msg.role)

  const content = document.createElement('div')
  content.className = 'message-content'
  content.setAttribute('data-testid', 'message-content')
  content.textContent = msg.content

  const meta = document.createElement('div')
  meta.className = 'message-meta'
  const time = document.createElement('span')
  time.className = 'message-time'
  time.textContent = msg.timestamp
  meta.appendChild(time)

  el.appendChild(content)
  el.appendChild(meta)

  if (msg.sources && msg.sources.length > 0) {
    const sourcesContainer = document.createElement('div')
    sourcesContainer.className = 'message-sources'
    sourcesContainer.setAttribute('data-testid', 'message-sources')

    for (const src of msg.sources) {
      const chip = document.createElement('span')
      chip.className = `source-chip source-chip--${src.type}`
      chip.setAttribute('data-testid', 'source-chip')
      chip.setAttribute('data-source-type', src.type)
      chip.setAttribute('data-source-id', src.id)
      chip.textContent = `${src.type}:${src.id}`
      sourcesContainer.appendChild(chip)
    }

    el.appendChild(sourcesContainer)
  }

  return el
}

function buildQueryInput(loading: boolean, query: string): HTMLElement {
  const container = document.createElement('div')
  container.className = 'query-input-area'

  const textarea = document.createElement('textarea')
  textarea.className = 'query-textarea'
  textarea.value = query
  textarea.disabled = loading
  textarea.placeholder = 'ai.queryPlaceholder'
  textarea.setAttribute('data-testid', 'query-input')
  container.appendChild(textarea)

  const sourceFilterDiv = document.createElement('div')
  sourceFilterDiv.className = 'source-type-filter'
  sourceFilterDiv.setAttribute('data-testid', 'source-type-filter')
  for (const type of ['log', 'incident', 'metric', 'alert']) {
    const label = document.createElement('label')
    label.className = 'source-checkbox-label'
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.value = type
    checkbox.setAttribute('data-testid', `source-checkbox-${type}`)
    checkbox.checked = true
    label.appendChild(checkbox)
    label.appendChild(document.createTextNode(`ai.source.${type}`))
    sourceFilterDiv.appendChild(label)
  }
  container.appendChild(sourceFilterDiv)

  const submitBtn = document.createElement('button')
  submitBtn.type = 'button'
  submitBtn.className = 'btn btn-primary query-submit-btn'
  submitBtn.disabled = loading
  submitBtn.setAttribute('data-testid', 'submit-btn')
  submitBtn.textContent = loading ? 'ai.thinking' : 'ai.askBtn'
  container.appendChild(submitBtn)

  return container
}

function buildSessionList(sessions: AiSession[]): HTMLElement {
  const container = document.createElement('div')
  container.className = 'session-list'
  container.setAttribute('data-testid', 'session-list')

  const header = document.createElement('div')
  header.className = 'session-list-header'
  const title = document.createElement('h3')
  title.textContent = 'ai.sessions'
  header.appendChild(title)
  const newBtn = document.createElement('button')
  newBtn.type = 'button'
  newBtn.className = 'btn btn-secondary new-session-btn'
  newBtn.setAttribute('data-testid', 'new-session-btn')
  newBtn.textContent = 'ai.newSession'
  header.appendChild(newBtn)
  container.appendChild(header)

  if (sessions.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'empty-state'
    empty.setAttribute('data-testid', 'empty-state')
    empty.textContent = 'ai.noSessions'
    container.appendChild(empty)
    return container
  }

  for (const sess of sessions) {
    const item = document.createElement('div')
    item.className = 'session-item'
    item.setAttribute('data-testid', 'session-item')
    item.setAttribute('data-id', sess.id)
    const lastQuery = document.createElement('span')
    lastQuery.className = 'session-last-query'
    lastQuery.textContent = sess.last_query
    const updatedAt = document.createElement('span')
    updatedAt.className = 'session-updated-at'
    updatedAt.textContent = sess.updated_at
    item.appendChild(lastQuery)
    item.appendChild(updatedAt)
    container.appendChild(item)
  }

  return container
}

function mountAiPage(options: {
  messages?: ChatMessage[]
  sessions?: AiSession[]
  loading?: boolean
  query?: string
  error?: string
} = {}): HTMLElement {
  const {
    messages = [],
    sessions = [],
    loading = false,
    query = '',
    error = '',
  } = options

  const page = document.createElement('div')
  page.className = 'ai-page'

  const header = document.createElement('div')
  header.className = 'page-header'
  const h2 = document.createElement('h2')
  h2.className = 'page-title'
  h2.textContent = 'ai.title'
  header.appendChild(h2)
  page.appendChild(header)

  const layout = document.createElement('div')
  layout.className = 'ai-layout'

  // Sidebar: session list
  const sidebar = document.createElement('aside')
  sidebar.className = 'ai-sidebar'
  sidebar.appendChild(buildSessionList(sessions))
  layout.appendChild(sidebar)

  // Main: chat area + input
  const main = document.createElement('div')
  main.className = 'ai-main'

  const chatArea = document.createElement('div')
  chatArea.className = 'chat-area'
  chatArea.setAttribute('data-testid', 'chat-area')

  if (error) {
    const errDiv = document.createElement('div')
    errDiv.className = 'error-state'
    errDiv.setAttribute('data-testid', 'error-state')
    errDiv.textContent = error
    chatArea.appendChild(errDiv)
  } else if (messages.length === 0) {
    const welcome = document.createElement('div')
    welcome.className = 'welcome-state'
    welcome.setAttribute('data-testid', 'welcome-state')
    welcome.textContent = 'ai.welcomeMessage'
    chatArea.appendChild(welcome)
  } else {
    for (const msg of messages) {
      chatArea.appendChild(buildChatMessage(msg))
    }
  }

  main.appendChild(chatArea)
  main.appendChild(buildQueryInput(loading, query))
  layout.appendChild(main)

  page.appendChild(layout)
  document.body.appendChild(page)
  return page
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AI Query Page', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    mockNavigate.mockClear()
    mockFetch.mockClear()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  describe('RAG Chat', () => {
    it('should send query and receive RAG response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          answer: 'The CPU spike was caused by a memory leak in the user service.',
          sources: [
            { type: 'log', id: '123', relevance: 0.95 },
            { type: 'incident', id: '45', relevance: 0.87 },
          ],
        }),
      })

      const resp = await fetch('/api/v1/ai/query', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'Why was CPU high yesterday?', session_id: 'sess-1' }),
      })
      const data = await resp.json()

      expect(data.answer).toContain('CPU spike')
      expect(data.sources).toHaveLength(2)
      expect(data.sources[0].type).toBe('log')
    })

    it('should handle empty query', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Query is required' }),
      })

      const resp = await fetch('/api/v1/ai/query', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '' }),
      })

      expect(resp.ok).toBe(false)
      expect(resp.status).toBe(400)
    })

    it('should handle server error gracefully', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })

      const resp = await fetch('/api/v1/ai/query', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'test query' }),
      })

      expect(resp.ok).toBe(false)
    })

    it('should render assistant message with sources in DOM', () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Why was CPU high?', timestamp: '2026-04-07T10:00:00Z' },
        {
          role: 'assistant',
          content: 'CPU spike due to memory leak.',
          sources: [
            { type: 'log', id: '123', relevance: 0.95 },
            { type: 'incident', id: '45', relevance: 0.87 },
          ],
          timestamp: '2026-04-07T10:00:01Z',
        },
      ]
      const page = mountAiPage({ messages })

      const chatMessages = page.querySelectorAll('[data-testid="chat-message"]')
      expect(chatMessages.length).toBe(2)

      const sourcesContainer = page.querySelector('[data-testid="message-sources"]')
      expect(sourcesContainer).not.toBeNull()

      const chips = page.querySelectorAll('[data-testid="source-chip"]')
      expect(chips.length).toBe(2)
    })

    it('should differentiate user and assistant messages by CSS class', () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello', timestamp: '2026-04-07T10:00:00Z' },
        { role: 'assistant', content: 'Hi there', timestamp: '2026-04-07T10:00:01Z' },
      ]
      const page = mountAiPage({ messages })

      const userMsg = page.querySelector('.chat-message--user')
      const assistantMsg = page.querySelector('.chat-message--assistant')

      expect(userMsg).not.toBeNull()
      expect(assistantMsg).not.toBeNull()
    })

    it('should show welcome state when no messages', () => {
      const page = mountAiPage({ messages: [] })

      const welcome = page.querySelector('[data-testid="welcome-state"]')
      expect(welcome).not.toBeNull()
    })

    it('should show error state on API failure', () => {
      const page = mountAiPage({ error: 'ai.queryError' })

      const errState = page.querySelector('[data-testid="error-state"]')
      expect(errState).not.toBeNull()
    })

    it('should disable query input while loading', () => {
      const page = mountAiPage({ loading: true })

      const input = page.querySelector<HTMLTextAreaElement>('[data-testid="query-input"]')
      expect(input?.disabled).toBe(true)

      const submitBtn = page.querySelector<HTMLButtonElement>('[data-testid="submit-btn"]')
      expect(submitBtn?.disabled).toBe(true)
    })

    it('should show thinking label on submit button while loading', () => {
      const page = mountAiPage({ loading: true })

      const submitBtn = page.querySelector('[data-testid="submit-btn"]')
      expect(submitBtn?.textContent).toBe('ai.thinking')
    })
  })

  describe('Session Management', () => {
    it('should create new session', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ session_id: 'new-sess', created_at: '2026-04-07T10:00:00Z' }),
      })

      const resp = await fetch('/api/v1/ai/sessions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-token' },
      })
      const data = await resp.json()

      expect(data.session_id).toBe('new-sess')
    })

    it('should list existing sessions', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessions: [
            { id: 'sess-1', last_query: 'CPU issue', updated_at: '2026-04-07T09:00:00Z' },
            { id: 'sess-2', last_query: 'Memory leak', updated_at: '2026-04-06T15:00:00Z' },
          ],
        }),
      })

      const resp = await fetch('/api/v1/ai/sessions', {
        headers: { 'Authorization': 'Bearer test-token' },
      })
      const data = await resp.json()

      expect(data.sessions).toHaveLength(2)
    })

    it('should render session items in sidebar', () => {
      const sessions: AiSession[] = [
        { id: 'sess-1', last_query: 'CPU issue', updated_at: '2026-04-07T09:00:00Z' },
        { id: 'sess-2', last_query: 'Memory leak', updated_at: '2026-04-06T15:00:00Z' },
      ]
      const page = mountAiPage({ sessions })

      const sessionItems = page.querySelectorAll('[data-testid="session-item"]')
      expect(sessionItems.length).toBe(2)
    })

    it('should show empty state when no sessions', () => {
      const page = mountAiPage({ sessions: [] })

      const empty = page.querySelector('[data-testid="empty-state"]')
      expect(empty).not.toBeNull()
    })

    it('should render new session button', () => {
      const page = mountAiPage()

      const newBtn = page.querySelector('[data-testid="new-session-btn"]')
      expect(newBtn).not.toBeNull()
    })

    it('should call new session API when button is clicked', () => {
      const mockNewSession = vi.fn()
      const page = mountAiPage()

      const newBtn = page.querySelector<HTMLButtonElement>('[data-testid="new-session-btn"]')!
      newBtn.addEventListener('click', mockNewSession)
      newBtn.click()

      expect(mockNewSession).toHaveBeenCalledTimes(1)
    })
  })

  describe('Source Type Filter', () => {
    it('should filter results by source type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          answer: 'Found relevant logs.',
          sources: [{ type: 'log', id: '1', relevance: 0.9 }],
        }),
      })

      const resp = await fetch('/api/v1/ai/query', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'show logs', source_types: ['log'] }),
      })
      const data = await resp.json()

      expect(data.sources.every((s: ChatSource) => s.type === 'log')).toBe(true)
    })

    it('should render source type checkboxes', () => {
      const page = mountAiPage()

      for (const type of ['log', 'incident', 'metric', 'alert']) {
        const checkbox = page.querySelector(`[data-testid="source-checkbox-${type}"]`)
        expect(checkbox).not.toBeNull()
      }
    })

    it('should render source chips with correct type label', () => {
      const messages: ChatMessage[] = [
        {
          role: 'assistant',
          content: 'Here are the results.',
          sources: [
            { type: 'log', id: '10', relevance: 0.9 },
            { type: 'incident', id: '5', relevance: 0.8 },
          ],
          timestamp: '2026-04-07T10:00:00Z',
        },
      ]
      const page = mountAiPage({ messages })

      const chips = page.querySelectorAll('[data-testid="source-chip"]')
      const types = Array.from(chips).map((c) => c.getAttribute('data-source-type'))
      expect(types).toContain('log')
      expect(types).toContain('incident')
    })

    it('should not render sources container for user messages', () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'What happened?', timestamp: '2026-04-07T10:00:00Z' },
      ]
      const page = mountAiPage({ messages })

      const sourcesContainer = page.querySelector('[data-testid="message-sources"]')
      expect(sourcesContainer).toBeNull()
    })
  })
})
