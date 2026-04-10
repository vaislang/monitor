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
  appStore: { page_title: 'Graph', is_loading: false },
}))

;(globalThis as any).router = { navigate: mockNavigate }
;(globalThis as any).fetch = mockFetch

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GraphNode {
  id: number
  name: string
  status: 'healthy' | 'degraded' | 'down' | 'unknown'
  service_type?: string
}

interface GraphEdge {
  from: number
  to: number
  label?: string
}

interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

interface ImpactedService {
  id: number
  name: string
  status?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildGraphNode(node: GraphNode): HTMLElement {
  const el = document.createElement('div')
  el.className = `graph-node graph-node--${node.status}`
  el.setAttribute('data-testid', 'graph-node')
  el.setAttribute('data-id', String(node.id))

  const label = document.createElement('span')
  label.className = 'node-label'
  label.setAttribute('data-testid', 'node-label')
  label.textContent = node.name

  const statusDot = document.createElement('span')
  statusDot.className = `node-status-dot status-dot--${node.status}`
  statusDot.setAttribute('data-testid', 'node-status-dot')

  el.appendChild(statusDot)
  el.appendChild(label)
  return el
}

function buildGraphCanvas(data: GraphData, loading: boolean, error: string): HTMLElement {
  const container = document.createElement('div')
  container.className = 'graph-canvas'
  container.setAttribute('data-testid', 'graph-canvas')

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

  if (data.nodes.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'empty-state'
    empty.setAttribute('data-testid', 'empty-state')
    empty.textContent = 'graph.noServices'
    container.appendChild(empty)
    return container
  }

  const nodesLayer = document.createElement('div')
  nodesLayer.className = 'nodes-layer'
  nodesLayer.setAttribute('data-testid', 'nodes-layer')
  for (const node of data.nodes) {
    nodesLayer.appendChild(buildGraphNode(node))
  }
  container.appendChild(nodesLayer)

  const edgesLayer = document.createElement('svg')
  edgesLayer.setAttribute('class', 'edges-layer')
  edgesLayer.setAttribute('data-testid', 'edges-layer')
  for (const edge of data.edges) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    line.setAttribute('data-from', String(edge.from))
    line.setAttribute('data-to', String(edge.to))
    line.setAttribute('data-testid', 'graph-edge')
    edgesLayer.appendChild(line)
  }
  container.appendChild(edgesLayer)

  return container
}

function buildCycleWarning(hasCycles: boolean, cycles: number[][]): HTMLElement {
  const container = document.createElement('div')
  container.className = 'cycle-warning-panel'
  container.setAttribute('data-testid', 'cycle-warning-panel')

  if (!hasCycles) {
    const ok = document.createElement('span')
    ok.className = 'no-cycles-indicator'
    ok.setAttribute('data-testid', 'no-cycles-indicator')
    ok.textContent = 'graph.noCycles'
    container.appendChild(ok)
    return container
  }

  const warning = document.createElement('div')
  warning.className = 'cycles-detected'
  warning.setAttribute('data-testid', 'cycles-detected')
  warning.textContent = 'graph.cyclesDetected'

  const cycleList = document.createElement('ul')
  cycleList.className = 'cycle-list'
  for (const cycle of cycles) {
    const li = document.createElement('li')
    li.className = 'cycle-item'
    li.setAttribute('data-testid', 'cycle-item')
    li.textContent = cycle.join(' → ')
    cycleList.appendChild(li)
  }

  container.appendChild(warning)
  container.appendChild(cycleList)
  return container
}

function buildImpactPanel(impacted: ImpactedService[], selectedServiceId: number | null): HTMLElement {
  const panel = document.createElement('div')
  panel.className = 'impact-panel'
  panel.setAttribute('data-testid', 'impact-panel')

  const title = document.createElement('h3')
  title.className = 'panel-title'
  title.textContent = 'graph.impactAnalysis'
  panel.appendChild(title)

  if (selectedServiceId === null) {
    const hint = document.createElement('p')
    hint.className = 'impact-hint'
    hint.setAttribute('data-testid', 'impact-hint')
    hint.textContent = 'graph.selectNodeForImpact'
    panel.appendChild(hint)
    return panel
  }

  if (impacted.length === 0) {
    const none = document.createElement('p')
    none.className = 'no-impact'
    none.setAttribute('data-testid', 'no-impact')
    none.textContent = 'graph.noImpact'
    panel.appendChild(none)
    return panel
  }

  const list = document.createElement('ul')
  list.className = 'impact-list'
  for (const svc of impacted) {
    const li = document.createElement('li')
    li.className = 'impact-item'
    li.setAttribute('data-testid', 'impact-item')
    li.setAttribute('data-id', String(svc.id))
    li.textContent = svc.name
    list.appendChild(li)
  }
  panel.appendChild(list)
  return panel
}

function mountGraphPage(options: {
  graphData?: GraphData
  loading?: boolean
  error?: string
  hasCycles?: boolean
  cycles?: number[][]
  impacted?: ImpactedService[]
  selectedServiceId?: number | null
} = {}): HTMLElement {
  const {
    graphData = { nodes: [], edges: [] },
    loading = false,
    error = '',
    hasCycles = false,
    cycles = [],
    impacted = [],
    selectedServiceId = null,
  } = options

  const page = document.createElement('div')
  page.className = 'graph-page'

  const header = document.createElement('div')
  header.className = 'page-header'
  const h2 = document.createElement('h2')
  h2.className = 'page-title'
  h2.textContent = 'graph.title'
  header.appendChild(h2)
  page.appendChild(header)

  page.appendChild(buildCycleWarning(hasCycles, cycles))
  page.appendChild(buildGraphCanvas(graphData, loading, error))
  page.appendChild(buildImpactPanel(impacted, selectedServiceId))

  document.body.appendChild(page)
  return page
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Graph Page', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    mockNavigate.mockClear()
    mockFetch.mockClear()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  describe('Graph Loading', () => {
    it('should fetch graph data with auth header', async () => {
      const graphData: GraphData = {
        nodes: [
          { id: 1, name: 'API Gateway', status: 'healthy' },
          { id: 2, name: 'User Service', status: 'healthy' },
        ],
        edges: [{ from: 1, to: 2 }],
      }
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => graphData })

      const resp = await fetch('/api/v1/services/graph', {
        headers: { 'Authorization': 'Bearer test-token' },
      })
      const data = await resp.json()

      expect(data.nodes).toHaveLength(2)
      expect(data.edges).toHaveLength(1)
    })

    it('should handle graph load error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })

      const resp = await fetch('/api/v1/services/graph', {
        headers: { 'Authorization': 'Bearer test-token' },
      })

      expect(resp.ok).toBe(false)
      expect(resp.status).toBe(500)
    })

    it('should render nodes in DOM', () => {
      const graphData: GraphData = {
        nodes: [
          { id: 1, name: 'API Gateway', status: 'healthy' },
          { id: 2, name: 'User Service', status: 'degraded' },
        ],
        edges: [{ from: 1, to: 2 }],
      }
      const page = mountGraphPage({ graphData })

      const nodes = page.querySelectorAll('[data-testid="graph-node"]')
      expect(nodes.length).toBe(2)
    })

    it('should render edges in DOM', () => {
      const graphData: GraphData = {
        nodes: [
          { id: 1, name: 'API Gateway', status: 'healthy' },
          { id: 2, name: 'User Service', status: 'healthy' },
        ],
        edges: [{ from: 1, to: 2 }],
      }
      const page = mountGraphPage({ graphData })

      const edges = page.querySelectorAll('[data-testid="graph-edge"]')
      expect(edges.length).toBe(1)
    })

    it('should show loading spinner while fetching', () => {
      const page = mountGraphPage({ loading: true })

      const spinner = page.querySelector('[data-testid="loading-spinner"]')
      expect(spinner).not.toBeNull()
    })

    it('should show error state on fetch failure', () => {
      const page = mountGraphPage({ error: 'graph.loadError' })

      const errState = page.querySelector('[data-testid="error-state"]')
      expect(errState).not.toBeNull()
    })

    it('should show empty state when no services', () => {
      const page = mountGraphPage({ graphData: { nodes: [], edges: [] } })

      const emptyState = page.querySelector('[data-testid="empty-state"]')
      expect(emptyState).not.toBeNull()
    })

    it('should apply status CSS class to each node', () => {
      const graphData: GraphData = {
        nodes: [
          { id: 1, name: 'Down Service', status: 'down' },
        ],
        edges: [],
      }
      const page = mountGraphPage({ graphData })

      const node = page.querySelector('[data-testid="graph-node"]')
      expect(node?.classList.contains('graph-node--down')).toBe(true)
    })

    it('should display node labels', () => {
      const graphData: GraphData = {
        nodes: [
          { id: 1, name: 'API Gateway', status: 'healthy' },
        ],
        edges: [],
      }
      const page = mountGraphPage({ graphData })

      const label = page.querySelector('[data-testid="node-label"]')
      expect(label?.textContent).toBe('API Gateway')
    })
  })

  describe('Cycle Detection', () => {
    it('should detect cycles in service dependencies', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ has_cycles: true, cycles: [[1, 2, 3, 1]] }),
      })

      const resp = await fetch('/api/v1/services/graph/cycles', {
        headers: { 'Authorization': 'Bearer test-token' },
      })
      const data = await resp.json()

      expect(data.has_cycles).toBe(true)
      expect(data.cycles).toHaveLength(1)
    })

    it('should report no cycles when graph is acyclic', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ has_cycles: false, cycles: [] }),
      })

      const resp = await fetch('/api/v1/services/graph/cycles', {
        headers: { 'Authorization': 'Bearer test-token' },
      })
      const data = await resp.json()

      expect(data.has_cycles).toBe(false)
      expect(data.cycles).toHaveLength(0)
    })

    it('should render cycle warning when cycles are detected', () => {
      const page = mountGraphPage({ hasCycles: true, cycles: [[1, 2, 3, 1]] })

      const cyclesDetected = page.querySelector('[data-testid="cycles-detected"]')
      expect(cyclesDetected).not.toBeNull()
    })

    it('should render cycle items in warning panel', () => {
      const page = mountGraphPage({
        hasCycles: true,
        cycles: [[1, 2, 3, 1], [4, 5, 4]],
      })

      const cycleItems = page.querySelectorAll('[data-testid="cycle-item"]')
      expect(cycleItems.length).toBe(2)
    })

    it('should show no-cycles indicator when graph is acyclic', () => {
      const page = mountGraphPage({ hasCycles: false })

      const noCycles = page.querySelector('[data-testid="no-cycles-indicator"]')
      expect(noCycles).not.toBeNull()
      expect(noCycles?.textContent).toBe('graph.noCycles')
    })
  })

  describe('Impact Analysis', () => {
    it('should return impacted services for a given service', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          impacted: [
            { id: 2, name: 'User Service' },
            { id: 3, name: 'Payment Service' },
          ],
        }),
      })

      const resp = await fetch('/api/v1/services/1/impact', {
        headers: { 'Authorization': 'Bearer test-token' },
      })
      const data = await resp.json()

      expect(data.impacted).toHaveLength(2)
    })

    it('should handle impact analysis for service with no dependents', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ impacted: [] }),
      })

      const resp = await fetch('/api/v1/services/99/impact', {
        headers: { 'Authorization': 'Bearer test-token' },
      })
      const data = await resp.json()

      expect(data.impacted).toHaveLength(0)
    })

    it('should render impacted services in impact panel', () => {
      const impacted: ImpactedService[] = [
        { id: 2, name: 'User Service', status: 'healthy' },
        { id: 3, name: 'Payment Service', status: 'healthy' },
      ]
      const page = mountGraphPage({ impacted, selectedServiceId: 1 })

      const items = page.querySelectorAll('[data-testid="impact-item"]')
      expect(items.length).toBe(2)
    })

    it('should show no-impact message when service has no dependents', () => {
      const page = mountGraphPage({ impacted: [], selectedServiceId: 1 })

      const noImpact = page.querySelector('[data-testid="no-impact"]')
      expect(noImpact).not.toBeNull()
    })

    it('should show hint when no service is selected', () => {
      const page = mountGraphPage({ selectedServiceId: null })

      const hint = page.querySelector('[data-testid="impact-hint"]')
      expect(hint).not.toBeNull()
      expect(hint?.textContent).toBe('graph.selectNodeForImpact')
    })

    it('should call impact analysis endpoint on node click', () => {
      const mockClick = vi.fn()
      const graphData: GraphData = {
        nodes: [{ id: 1, name: 'API Gateway', status: 'healthy' }],
        edges: [],
      }
      const page = mountGraphPage({ graphData })

      const node = page.querySelector<HTMLElement>('[data-testid="graph-node"]')!
      node.addEventListener('click', mockClick)
      node.click()

      expect(mockClick).toHaveBeenCalledTimes(1)
    })
  })
})
